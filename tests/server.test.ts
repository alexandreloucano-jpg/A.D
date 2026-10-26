import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Store, digest } from "../server/store";
import { handle } from "../server/service";
import { resource, type Config } from "../server/security";
const app: Config = {
  role: "app",
  app: "https://ad.example",
  gateway: "https://scout.example",
  owner: "340639438",
  githubClient: "fixture-client",
  githubSecret: "fixture-secret",
  redirects: ["https://grok.example/callback"],
};
const gateway = { ...app, role: "gateway" } as Config;
let pg: PGlite, s: Store;
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(await readFile("sql/001-private-saver.sql", "utf8"));
  s = new Store(async (sql, params = []) => {
    const result = await pg.query(sql, params);
    return result.rows as Record<string, unknown>[];
  });
}, 30000);
beforeEach(async () => {
  await pg.exec("TRUNCATE ad_records,ad_saver,ad_quota,ad_audit");
});
afterAll(async () => {
  await pg.close();
});
async function session() {
  await s.put(
    "session",
    digest("fixture-session"),
    { owner: app.owner, csrf: "fixture-csrf" },
    3600,
  );
  return {
    cookie: "__Host-ad_session=fixture-session",
    origin: app.app,
    "x-ad-csrf": "fixture-csrf",
  };
}
async function client() {
  const id = randomUUID();
  await s.put("client", id, {
    id,
    name: "Grok fixture",
    secretHash: digest("fixture-client-secret"),
    redirects: app.redirects,
    revoked: false,
  });
  return id;
}
async function issue(clientId?: string) {
  clientId ??= await client();
  const verifier = "A".repeat(43),
    code = "fixture-code-" + randomUUID();
  await s.put(
    "code",
    digest(code),
    {
      owner: app.owner,
      clientId,
      resource: resource(app),
      scope: "saver:read saver:write",
      redirect: app.redirects[0],
      challenge: Buffer.from(digest(verifier), "hex").toString("base64url"),
    },
    120,
  );
  return { clientId, verifier, code };
}
function tokenRequest(
  grant: { clientId: string; verifier: string; code: string },
  overrides: Record<string, string> = {},
) {
  return new Request(gateway.gateway + "/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: grant.clientId,
      client_secret: "fixture-client-secret",
      code: grant.code,
      code_verifier: grant.verifier,
      redirect_uri: app.redirects[0],
      resource: resource(app),
      ...overrides,
    }),
  });
}
async function access() {
  const grant = await issue();
  const r = await handle(tokenRequest(grant), s, gateway);
  expect(r.status).toBe(200);
  return {
    token: (await r.json()).access_token as string,
    clientId: grant.clientId,
  };
}
function rpc(token: string, method: string, params?: unknown) {
  return handle(
    new Request(resource(app), {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
    s,
    gateway,
  );
}
function reference() {
  return {
    id: randomUUID(),
    title: "SQL fixture",
    content: "Isolated test data",
    url: "https://example.org/reference",
    capturedAt: new Date().toISOString(),
    revision: 1,
    origin: "human",
    approvedAt: new Date().toISOString(),
    isInternalQA: false,
  };
}
describe("Persistent Saver and owner isolation", () => {
  it("requires an owner session and rejects a valid Grok bearer at the application API", async () => {
    const { token } = await access();
    expect(
      (await handle(new Request(app.app + "/api/saver"), s, app)).status,
    ).toBe(401);
    expect(
      (
        await handle(
          new Request(app.app + "/api/saver", {
            headers: { authorization: "Bearer " + token },
          }),
          s,
          app,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await handle(
          new Request(app.app + "/mcp", {
            headers: { authorization: "Bearer " + token },
          }),
          s,
          app,
        )
      ).status,
    ).toBe(404);
  });
  it("persists a UUID, verifies read-after-write, isolates owners and preserves conflicts", async () => {
    const ref = reference();
    expect((await s.save(app.owner, ref)).id).toBe(ref.id);
    expect((await s.read(app.owner, ref.id))?.title).toBe(ref.title);
    expect(await s.read("unrelated-owner", ref.id)).toBeNull();
    await expect(
      s.save(app.owner, { ...ref, title: "Changed" }),
    ).rejects.toThrow("uuid_conflict");
    expect((await s.read(app.owner, ref.id))?.title).toBe("SQL fixture");
  });
  it("enforces CSRF and preserves each local UUID during partial non-destructive migration", async () => {
    const headers = await session(),
      ref = reference();
    await s.save(app.owner, ref);
    const bad = await handle(
      new Request(app.app + "/api/migrate", {
        method: "POST",
        headers: { ...headers, origin: "https://attacker.example" },
        body: JSON.stringify({ references: [ref] }),
      }),
      s,
      app,
    );
    expect(bad.status).toBe(403);
    const second = reference();
    const r = await handle(
      new Request(app.app + "/api/migrate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          references: [{ ...ref, title: "conflict" }, second],
        }),
      }),
      s,
      app,
    );
    const j = await r.json();
    expect(j.localDataPreserved).toBe(true);
    expect(j.results.map((x: { verified: boolean }) => x.verified)).toEqual([
      false,
      true,
    ]);
    expect((await s.read(app.owner, ref.id))?.title).toBe(ref.title);
    expect((await s.read(app.owner, second.id))?.id).toBe(second.id);
  });
  it("fails closed during database failures with retryable errors and no sensitive content", async () => {
    const broken = new Store(async () => {
      throw Error("private database URL, credentials and data");
    });
    const r = await handle(
      new Request(app.app + "/api/saver", {
        headers: { cookie: "__Host-ad_session=x" },
      }),
      broken,
      app,
    );
    expect(r.status).toBe(503);
    const data = await r.json();
    expect(data.retryable).toBe(true);
    expect(JSON.stringify(data)).not.toContain("credentials");
  });
});
describe("Resource-bound MCP OAuth", () => {
  it("discloses discovery metadata, only four tools, and denies arbitrary tools and unrelated paths", async () => {
    const metadata = await handle(
      new Request(gateway.gateway + "/.well-known/oauth-protected-resource"),
      s,
      gateway,
    );
    expect((await metadata.json()).resource).toBe(resource(app));
    const { token } = await access();
    const listing = await (await rpc(token, "tools/list")).json();
    expect(listing.result.tools.map((t: { name: string }) => t.name)).toEqual([
      "get_saved_inspiration",
      "get_saver_capture",
      "save_inspiration_reference",
      "save_reference_batch",
    ]);
    const denied = await (
      await rpc(token, "tools/call", { name: "delete_project", arguments: {} })
    ).json();
    expect(denied.error.code).toBe(-32601);
    expect(
      (
        await handle(
          new Request(gateway.gateway + "/api/projects", {
            headers: { authorization: "Bearer " + token },
          }),
          s,
          gateway,
        )
      ).status,
    ).toBe(404);
  });
  it("requires the dedicated resource, confidential client and matching PKCE; codes are one-use", async () => {
    let grant = await issue();
    expect(
      (
        await handle(
          tokenRequest(grant, { resource: app.app + "/mcp" }),
          s,
          gateway,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handle(
          tokenRequest(grant, { client_secret: "wrong" }),
          s,
          gateway,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await handle(
          tokenRequest(grant, { code_verifier: "B".repeat(43) }),
          s,
          gateway,
        )
      ).status,
    ).toBe(400);
    expect((await handle(tokenRequest(grant), s, gateway)).status).toBe(400);
    grant = await issue();
    expect((await handle(tokenRequest(grant), s, gateway)).status).toBe(200);
    expect((await handle(tokenRequest(grant), s, gateway)).status).toBe(400);
  });
  it("rejects an expired code and a token issued for another resource", async () => {
    const grant = await issue();
    await s.put("code", digest(grant.code), {}, -1);
    expect((await handle(tokenRequest(grant), s, gateway)).status).toBe(400);
    const clientId = await client(),
      token = "Z".repeat(43);
    await s.put(
      "token",
      digest(token),
      {
        owner: app.owner,
        clientId,
        scope: "saver:read saver:write",
        resource: app.app + "/mcp",
      },
      3600,
    );
    expect((await rpc(token, "tools/list")).status).toBe(401);
  });
  it("enforces exact callback allowlists and never auto-consents", async () => {
    const clientId = await client();
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: app.redirects[0],
      resource: resource(app),
      scope: "saver:read saver:write",
      response_type: "code",
      code_challenge_method: "S256",
      code_challenge: "A".repeat(43),
      state: "fixture-state",
    });
    let r = await handle(
      new Request(app.app + "/api/oauth/authorize?" + query),
      s,
      app,
    );
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toContain("/api/auth/login?pending=");
    r = await handle(
      new Request(app.app + "/api/oauth/authorize?" + query, {
        headers: await session(),
      }),
      s,
      app,
    );
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("Autoriser Saver");
    query.set("redirect_uri", "https://attacker.example/callback");
    expect(
      (
        await handle(
          new Request(app.app + "/api/oauth/authorize?" + query),
          s,
          app,
        )
      ).status,
    ).toBe(400);
  });
  it("requires explicit approved references; saves no tasks; returns an SQL-backed UUID readable by the same app owner", async () => {
    const { token } = await access();
    let r = await (
      await rpc(token, "tools/call", {
        name: "save_inspiration_reference",
        arguments: {
          title: "Approved fixture",
          url: "https://example.org/approved",
          owner_approved: false,
        },
      })
    ).json();
    expect(r.result.isError).toBe(true);
    expect(await s.list(app.owner)).toHaveLength(0);
    const uuid = randomUUID();
    r = await (
      await rpc(token, "tools/call", {
        name: "save_inspiration_reference",
        arguments: {
          id: uuid,
          title: "Approved fixture",
          url: "https://example.org/approved",
          owner_approved: true,
        },
      })
    ).json();
    expect(r.result.structuredContent.id).toBe(uuid);
    expect(r.result.structuredContent.verified).toBe(true);
    const readback = await (
      await rpc(token, "tools/call", {
        name: "get_saver_capture",
        arguments: { id: uuid },
      })
    ).json();
    expect(readback.result.structuredContent.reference.id).toBe(uuid);
    const appRead = await handle(
      new Request(app.app + "/api/saver/" + uuid, { headers: await session() }),
      s,
      app,
    );
    expect((await appRead.json()).reference.id).toBe(uuid);
    expect((await s.query("SELECT count(*) AS n FROM ad_saver"))[0].n).toBe(1);
    // The least-privilege Scout gateway must not write to the app-only lifecycle namespace.
    expect(
      (await s.query("SELECT count(*) AS n FROM ad_records WHERE namespace=$1", ["lifecycle-event:" + app.owner]))[0].n,
    ).toBe(0);
  });
  it("rejects oversized batches before writes, and quotas persist across service instances", async () => {
    const { token } = await access();
    const refs = Array.from({ length: 21 }, () => ({
      title: "fixture",
      url: "https://example.org",
      owner_approved: true,
    }));
    const r = await (
      await rpc(token, "tools/call", {
        name: "save_reference_batch",
        arguments: { references: refs },
      })
    ).json();
    expect(r.result.isError).toBe(true);
    expect(await s.list(app.owner)).toHaveLength(0);
    await s.quota("fixture", 2);
    await new Store(s.query).quota("fixture", 2);
    await expect(new Store(s.query).quota("fixture", 2)).rejects.toThrow(
      "rate_limited",
    );
  });
  it("revokes credentials server-side, and logs contain metadata without tokens or reference content", async () => {
    const { token, clientId } = await access();
    const headers = await session();
    const r = await handle(
      new Request(app.app + "/api/scout/revoke", {
        method: "POST",
        headers,
        body: JSON.stringify({ clientId }),
      }),
      s,
      app,
    );
    expect(r.status).toBe(200);
    expect((await rpc(token, "tools/list")).status).toBe(401);
    const logs = JSON.stringify(await s.query("SELECT * FROM ad_audit"));
    expect(logs).toContain("client_revoke");
    expect(logs).not.toContain(token);
    expect(logs).not.toContain("fixture-client-secret");
  });
  it("rejects another GitHub identity after verifying browser-bound OAuth state", async () => {
    await s.put(
      "login",
      digest("state"),
      { browser: digest("browser"), pending: "" },
      600,
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "fixture-upstream-token" }),
            { headers: { "content-type": "application/json" } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 999 }), {
            headers: { "content-type": "application/json" },
          }),
        ),
    );
    try {
      const r = await handle(
        new Request(app.app + "/api/auth/callback?state=state&code=code", {
          headers: { cookie: "__Host-ad_login=browser" },
        }),
        s,
        app,
      );
      expect(r.status).toBe(403);
      expect(
        await s.query("SELECT * FROM ad_records WHERE namespace='session'"),
      ).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

it("preserves a recoverable UUID when INSERT succeeds but acknowledgement read-back fails", async () => {
  const { token } = await access();
  const uuid = randomUUID();
  let reads = 0;
  const brokenReadback = new Store(async (sql, params) => {
    if (sql.startsWith("SELECT reference FROM ad_saver") && ++reads === 2)
      throw Error("temporary read failure after durable insert");
    return s.query(sql, params);
  });
  const args = {
    id: uuid,
    title: "Ambiguous isolated fixture",
    url: "https://example.org/ambiguous",
    content: "",
    owner_approved: true,
  };
  const request = new Request(resource(app), {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "save_inspiration_reference", arguments: args },
    }),
  });
  const receipt = await (await handle(request, brokenReadback, gateway)).json();
  expect(receipt.result.structuredContent).toMatchObject({
    id: uuid,
    verified: false,
    possibleWrite: true,
  });
  expect((await s.read(app.owner, uuid))?.id).toBe(uuid);
  const retry = await (
    await rpc(token, "tools/call", {
      name: "save_inspiration_reference",
      arguments: args,
    })
  ).json();
  expect(retry.result.structuredContent).toMatchObject({
    id: uuid,
    verified: true,
  });
  expect(await s.list(app.owner)).toHaveLength(1);
});
it("does not report the internal diagnostic callback as a configured external Grok client", async () => {
  const headers = await session();
  const internalOnly = {
    ...app,
    redirects: [app.app + "/api/scout/check/callback"],
  };
  const status = await handle(
    new Request(app.app + "/api/scout/status", { headers }),
    s,
    internalOnly,
  );
  expect(await status.json()).toMatchObject({
    callbackAllowlistConfigured: false,
    externalRedirects: [],
  });
  const external = await handle(
    new Request(app.app + "/api/scout/status", { headers }),
    s,
    {
      ...internalOnly,
      redirects: [
        ...internalOnly.redirects,
        "https://grok.com/connectors-oauth-exchange-code/",
      ],
    },
  );
  expect(await external.json()).toMatchObject({
    callbackAllowlistConfigured: true,
    externalRedirects: ["https://grok.com/connectors-oauth-exchange-code/"],
  });
});

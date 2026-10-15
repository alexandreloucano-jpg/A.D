import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Store, digest } from "../server/store";
import { handle } from "../server/service";
import { GROK_CALLBACK } from "../server/registration";
import type { Config } from "../server/security";
const app: Config = {
  role: "app",
  app: "https://app.example",
  gateway: "https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app",
  owner: "340639438",
  githubClient: "fixture",
  githubSecret: "fixture",
  redirects: [GROK_CALLBACK],
};
const gateway = { ...app, role: "gateway" } as Config;
let pg: PGlite, s: Store;
beforeAll(async () => {
  pg = new PGlite();
  for (const file of [
    "001-private-saver.sql",
    "002-reader-beta.sql",
    "003-scout-least-privilege.sql",
    "004-scout-automatic-registration.sql",
  ])
    await pg.exec(await readFile("sql/" + file, "utf8"));
  s = new Store(
    async (q, p = []) =>
      (await pg.query(q, p)).rows as Record<string, unknown>[],
  );
}, 30000);
beforeEach(async () => {
  await pg.exec("RESET ROLE; TRUNCATE ad_records,ad_saver,ad_quota,ad_audit");
});
afterAll(async () => pg.close());
async function register(
  auth = "client_secret_post",
  overrides: Record<string, unknown> = {},
) {
  await pg.exec("SET ROLE ad_scout_gateway");
  const response = await handle(
    new Request(gateway.gateway + "/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Grok fixture",
        redirect_uris: [GROK_CALLBACK],
        token_endpoint_auth_method: auth,
        ...overrides,
      }),
    }),
    s,
    gateway,
  );
  return { response, data: await response.json() };
}
async function consent(clientId: string, verifier: string) {
  await pg.exec("RESET ROLE");
  await s.put(
    "session",
    digest("fixture-owner"),
    { owner: app.owner, csrf: "csrf" },
    600,
  );
  const headers = {
    cookie: "__Host-ad_session=fixture-owner",
    origin: app.app,
  };
  const url =
    app.app +
    "/api/oauth/authorize?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: GROK_CALLBACK,
      response_type: "code",
      code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      state: "fixture-state",
    });
  const form = await handle(new Request(url, { headers }), s, app);
  expect(form.status).toBe(200);
  const ticket = (await form.text()).match(
    /name="pending" value="([^"]+)"/,
  )![1];
  const approval = await handle(
    new Request(app.app + "/api/oauth/authorize", {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        pending: ticket,
        csrf: "csrf",
        decision: "approve",
      }),
    }),
    s,
    app,
  );
  expect(approval.status).toBe(303);
  await pg.exec("SET ROLE ad_scout_gateway");
  return new URL(approval.headers.get("location")!).searchParams.get("code")!;
}
function exchange(fields: Record<string, string>) {
  return handle(
    new Request(gateway.gateway + "/token", {
      method: "POST",
      body: new URLSearchParams(fields),
    }),
    s,
    gateway,
  );
}
it("publishes discovery registration and registers through the restricted SQL role without authorizing data access", async () => {
  const metadata = await handle(
    new Request(gateway.gateway + "/.well-known/oauth-authorization-server"),
    s,
    gateway,
  );
  expect(await metadata.json()).toMatchObject({
    registration_endpoint: gateway.gateway + "/register",
    grant_types_supported: ["authorization_code", "refresh_token"],
  });
  const { response, data } = await register();
  expect(response.status).toBe(201);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.has("set-cookie")).toBe(false);
  const stored = await s.get<any>("client", data.client_id);
  expect(stored.resource).toBe(gateway.gateway + "/mcp");
  expect(stored.redirects).toEqual([GROK_CALLBACK]);
  expect(JSON.stringify(stored)).not.toContain(data.client_secret);
  expect(
    (
      await handle(
        new Request(gateway.gateway + "/mcp", {
          method: "POST",
          headers: { authorization: "Bearer " + data.client_secret },
          body: "{}",
        }),
        s,
        gateway,
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await s.query(
        "SELECT data FROM ad_records WHERE namespace IN ('session','x-account','google-owner','instagram-account','collections')",
      )
    ).length,
  ).toBe(0);
  await expect(
    s.query(
      "INSERT INTO ad_records(namespace,key,data) VALUES('session','forged','{}')",
    ),
  ).rejects.toThrow(/row-level security/);
  await expect(
    s.query(
      "UPDATE ad_records SET data=jsonb_set(data,'{revoked}','false') WHERE namespace='client' AND key=$1",
      [data.client_id],
    ),
  ).resolves.toEqual([]);
});
it("supports public PKCE without a copied secret, rotates refresh tokens and revokes the entire connection", async () => {
  const { data } = await register("none");
  expect(data.client_secret).toBeUndefined();
  const verifier = "v".repeat(43),
    code = await consent(data.client_id, verifier);
  const response = await exchange({
    client_id: data.client_id,
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: GROK_CALLBACK,
  });
  expect(response.status).toBe(200);
  const tokens = await response.json();
  expect(tokens.refresh_token).toBeTruthy();
  const rotated = await exchange({
    client_id: data.client_id,
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
  });
  expect(rotated.status).toBe(200);
  const next = await rotated.json();
  expect(next.refresh_token).not.toBe(tokens.refresh_token);
  expect(
    (
      await exchange({
        client_id: data.client_id,
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await exchange({
        client_id: data.client_id,
        grant_type: "refresh_token",
        refresh_token: next.refresh_token,
        resource: "https://global.example/mcp",
      })
    ).status,
  ).toBe(400);
  await pg.exec("RESET ROLE");
  const headers = {
    cookie: "__Host-ad_session=fixture-owner",
    origin: app.app,
    "x-ad-csrf": "csrf",
  };
  const disconnected = await handle(
    new Request(app.app + "/api/connections/grok", {
      method: "DELETE",
      headers,
    }),
    s,
    app,
  );
  expect(await disconnected.json()).toMatchObject({
    disconnected: true,
    referencesPreserved: true,
  });
  await pg.exec("SET ROLE ad_scout_gateway");
  expect(
    (
      await exchange({
        client_id: data.client_id,
        grant_type: "refresh_token",
        refresh_token: next.refresh_token,
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await handle(
        new Request(gateway.gateway + "/mcp", {
          method: "POST",
          headers: { authorization: "Bearer " + next.access_token },
          body: "{}",
        }),
        s,
        gateway,
      )
    ).status,
  ).toBe(401);
});
it("still requires owner consent, PKCE, exact callback and dedicated scope for a dynamically registered client", async () => {
  const { data } = await register("none"),
    verifier = "k".repeat(43);
  await pg.exec("RESET ROLE");
  const url =
    app.app +
    "/api/oauth/authorize?" +
    new URLSearchParams({
      client_id: data.client_id,
      redirect_uri: GROK_CALLBACK,
      response_type: "code",
      code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    });
  expect(
    (await handle(new Request(url), s, app)).headers.get("location"),
  ).toContain("/api/auth/login?pending=");
  const code = await consent(data.client_id, verifier);
  expect(
    (
      await exchange({
        client_id: data.client_id,
        grant_type: "authorization_code",
        code,
        code_verifier: "wrong",
        redirect_uri: GROK_CALLBACK,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await exchange({
        client_id: data.client_id,
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        redirect_uri: GROK_CALLBACK,
      })
    ).status,
  ).toBe(400);
});
it("refuses arbitrary callback registration and global scopes, bounds metadata and persistent registration quotas", async () => {
  for (const changes of [
    { redirect_uris: ["https://evil.example/callback"] },
    { redirect_uris: [GROK_CALLBACK.slice(0, -1)] },
    { scope: "global:read" },
    { grant_types: ["refresh_token"] },
  ])
    expect((await register("none", changes)).response.status).toBe(400);
  for (let i = 0; i < 10; i++)
    expect((await register()).response.status).toBe(201);
  expect((await register()).response.status).toBe(429);
  await pg.exec("RESET ROLE");
  expect(
    (
      await s.query(
        "SELECT key FROM ad_records WHERE namespace IN ('token','refresh')",
      )
    ).length,
  ).toBe(0);
});

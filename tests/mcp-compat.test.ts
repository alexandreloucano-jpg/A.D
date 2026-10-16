import {
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  it,
  expect,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Store, digest } from "../server/store";
import { handle } from "../server/service";
import type { Config } from "../server/security";
const c: Config = {
  role: "gateway",
  app: "https://app.example",
  gateway: "https://gateway.example",
  owner: "340639438",
  githubClient: "",
  githubSecret: "",
  redirects: [],
};
let pg: PGlite, s: Store, clientId: string;
const token = "X".repeat(43),
  version = "2026-07-28";
const meta = {
  "io.modelcontextprotocol/protocolVersion": version,
  "io.modelcontextprotocol/clientCapabilities": {},
};
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(await readFile("sql/001-private-saver.sql", "utf8"));
  s = new Store(
    async (q, p = []) =>
      (await pg.query(q, p)).rows as Record<string, unknown>[],
  );
}, 30000);
beforeEach(async () => {
  await pg.exec("TRUNCATE ad_records,ad_saver,ad_quota,ad_audit");
  clientId = randomUUID();
  await s.put("client", clientId, { id: clientId, revoked: false });
  await s.put(
    "token",
    digest(token),
    {
      owner: c.owner,
      clientId,
      resource: c.gateway + "/mcp",
      scope: "saver:read saver:write",
    },
    600,
  );
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => pg.close());
function req(
  method: string,
  params: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return new Request(c.gateway + "/mcp", {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
      "mcp-protocol-version": version,
      "mcp-method": method,
      ...(method === "tools/call" ? { "mcp-name": String(params.name) } : {}),
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: { ...params, _meta: meta },
    }),
  });
}
it("discovers four Saver tools statelessly on MCP 2026 and preserves a minimal legacy initialize", async () => {
  const logs = vi.spyOn(console, "info").mockImplementation(() => {});
  const discovery = await handle(req("server/discover"), s, c);
  expect(discovery.status).toBe(200);
  expect((await discovery.json()).result).toMatchObject({
    resultType: "complete",
    supportedVersions: expect.arrayContaining([version, "2025-11-25"]),
    capabilities: { tools: {} },
    ttlMs: 0,
    cacheScope: "private",
  });
  const result = await (await handle(req("tools/list"), s, c)).json();
  expect(result.result.resultType).toBe("complete");
  expect(result.result.tools.map((t: any) => t.name)).toEqual([
    "get_saved_inspiration",
    "get_saver_capture",
    "save_inspiration_reference",
    "save_reference_batch",
  ]);
  expect(
    result.result.tools
      .slice(0, 2)
      .every((t: any) => t.annotations.readOnlyHint === true),
  ).toBe(true);
  const legacy = await handle(
    new Request(c.gateway + "/mcp", {
      method: "POST",
      headers: { authorization: "Bearer " + token },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          clientInfo: { name: "Fixture", version: "1" },
          capabilities: {},
        },
      }),
    }),
    s,
    c,
  );
  expect((await legacy.json()).result).toMatchObject({
    protocolVersion: "2025-11-25",
    capabilities: { tools: {} },
  });
  expect(JSON.stringify(logs.mock.calls)).not.toContain(token);
  expect(JSON.stringify(logs.mock.calls)).not.toContain(clientId);
});
it("rejects conflicting required headers and unknown versions with actionable JSON-RPC errors", async () => {
  const invalidHeaders: Record<string, string>[] = [
    { "mcp-protocol-version": "2025-11-25" },
    { "mcp-method": "ping" },
    { "mcp-method": "" },
  ];
  for (const headers of invalidHeaders) {
    const response = await handle(req("tools/list", {}, headers), s, c);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe(-32020);
  }
  const request = new Request(c.gateway + "/mcp", {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "mcp-protocol-version": "2099-01-01",
      "mcp-method": "tools/list",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {
        _meta: {
          ...meta,
          "io.modelcontextprotocol/protocolVersion": "2099-01-01",
        },
      },
    }),
  });
  const response = await handle(request, s, c);
  expect(response.status).toBe(400);
  expect((await response.json()).error).toMatchObject({
    code: -32022,
    data: {
      requested: "2099-01-01",
      supported: expect.arrayContaining([version]),
    },
  });
  const unsupported = await handle(req("resources/list"), s, c);
  expect(unsupported.status).toBe(404);
  expect((await unsupported.json()).error.code).toBe(-32601);
});
it("supports metadata on calls, keeps writes approval-gated and denies global tools and foreign references", async () => {
  const badWrite = await handle(
    req("tools/call", {
      name: "save_inspiration_reference",
      arguments: { title: "Fixture", url: "https://example.org" },
    }),
    s,
    c,
  );
  expect((await badWrite.json()).result.isError).toBe(true);
  expect(await s.list(c.owner)).toHaveLength(0);
  const now = new Date().toISOString(),
    foreignId = randomUUID();
  await s.save("other-owner", {
    id: foreignId,
    title: "Private",
    content: "Unrelated",
    capturedAt: now,
    approvedAt: now,
    origin: "human",
    revision: 1,
    isInternalQA: false,
  });
  const foreign = await (
    await handle(
      req("tools/call", {
        name: "get_saver_capture",
        arguments: { id: foreignId },
      }),
      s,
      c,
    )
  ).json();
  expect(foreign.result.isError).toBe(true);
  const read = await (
    await handle(
      req("tools/call", {
        name: "get_saved_inspiration",
        arguments: { query: "" },
      }),
      s,
      c,
    )
  ).json();
  expect(read.result.structuredContent.references).toEqual([]);
  const denied = await (
    await handle(
      req("tools/call", { name: "create_task", arguments: {} }),
      s,
      c,
    )
  ).json();
  expect(denied.error.code).toBe(-32601);
  const mismatch = await handle(
    req(
      "tools/call",
      { name: "get_saved_inspiration", arguments: {} },
      { "mcp-name": "create_task" },
    ),
    s,
    c,
  );
  expect(mismatch.status).toBe(400);
  const encoded = await handle(
    req(
      "tools/call",
      { name: "get_saved_inspiration", arguments: {} },
      {
        "mcp-name":
          "=?base64?" + Buffer.from("get_saved_inspiration").toString("base64"),
      },
    ),
    s,
    c,
  );
  expect(encoded.status).toBe(200);
});
it("retains authentication, audience, expiry, revocation and quotas for discovery", async () => {
  expect(
    (
      await handle(
        req("tools/list", {}, { authorization: "Bearer invalid" }),
        s,
        c,
      )
    ).status,
  ).toBe(401);
  await s.put(
    "token",
    digest(token),
    {
      owner: c.owner,
      clientId,
      resource: "https://global.example/mcp",
      scope: "saver:read saver:write",
    },
    600,
  );
  expect((await handle(req("tools/list"), s, c)).status).toBe(401);
  await s.put(
    "token",
    digest(token),
    {
      owner: c.owner,
      clientId,
      resource: c.gateway + "/mcp",
      scope: "saver:read saver:write",
    },
    600,
  );
  await s.quota("mcp:" + clientId, 1);
  await s.query("UPDATE ad_quota SET used=30 WHERE principal=$1", [
    "mcp:" + clientId,
  ]);
  expect((await handle(req("tools/list"), s, c)).status).toBe(429);
  await pg.exec("TRUNCATE ad_quota");
  await s.put("client", clientId, { id: clientId, revoked: true });
  expect((await handle(req("tools/list"), s, c)).status).toBe(401);
  await s.put("client", clientId, { id: clientId, revoked: false });
  await s.query(
    "UPDATE ad_records SET expires_at=now()-interval '1 second' WHERE namespace='token'",
  );
  expect((await handle(req("tools/list"), s, c)).status).toBe(401);
});
it("accepts legacy request metadata without making tool argument validation permissive", async () => {
  const r = (args: unknown) =>
    new Request(c.gateway + "/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "mcp-protocol-version": "2025-11-25",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "get_saved_inspiration",
          arguments: args,
          _meta: { progressToken: "not-logged" },
        },
      }),
    });
  expect(
    (await (await handle(r({ query: "" }), s, c)).json()).result
      .structuredContent.references,
  ).toEqual([]);
  expect(
    (await (await handle(r({ query: "", owner: "other-owner" }), s, c)).json())
      .result.isError,
  ).toBe(true);
});

it("saves one explicitly approved reference and reads the identical persistent UUID on MCP 2026", async () => {
  const id = randomUUID();
  const saved = await handle(
    req("tools/call", {
      name: "save_inspiration_reference",
      arguments: {
        id,
        title: "Approved isolated fixture",
        url: "https://example.org/fixture",
        content: "Fixture source",
        owner_approved: true,
      },
    }),
    s,
    c,
  );
  const receipt = await saved.json();
  expect(receipt.result.resultType).toBe("complete");
  expect(receipt.result.structuredContent).toMatchObject({
    id,
    verified: true,
  });
  const read = await (
    await handle(
      req("tools/call", { name: "get_saver_capture", arguments: { id } }),
      s,
      c,
    )
  ).json();
  expect(read.result.structuredContent.reference).toEqual(
    receipt.result.structuredContent.reference,
  );
  expect((await s.list(c.owner)).map((r) => r.id)).toEqual([id]);
});

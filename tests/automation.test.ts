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
import { Store, digest } from "../server/store";
import { handle } from "../server/service";
import { seal } from "../server/secrets";
import type { Config } from "../server/security";
const c: Config = {
  role: "app",
  app: "https://app.example",
  gateway: "https://gateway.example",
  owner: "340639438",
  githubClient: "",
  githubSecret: "",
  redirects: [],
};
let pg: PGlite, s: Store;
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(await readFile("sql/001-private-saver.sql", "utf8"));
  s = new Store(
    async (q, p = []) =>
      (await pg.query(q, p)).rows as Record<string, unknown>[],
  );
}, 30000);
beforeEach(async () => {
  await pg.exec("TRUNCATE ad_records,ad_quota,ad_audit");
  vi.stubEnv("AD_AUTOMATION_SECRET", "a".repeat(43));
  vi.stubEnv(
    "AD_TOKEN_ENCRYPTION_KEY",
    Buffer.alloc(32, 11).toString("base64"),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
afterAll(async () => pg.close());
it("permits only the fixed authenticated job and reports no connected accounts without simulating imports", async () => {
  expect(
    (
      await handle(
        new Request(c.app + "/api/jobs/connections", { method: "POST" }),
        s,
        c,
      )
    ).status,
  ).toBe(401);
  const headers = { authorization: "Bearer " + "a".repeat(43) };
  const response = await handle(
    new Request(c.app + "/api/jobs/connections", { method: "POST", headers }),
    s,
    c,
  );
  expect(await response.json()).toMatchObject({
    completed: true,
    outcomes: [
      { service: "x", status: "not_connected_or_paused" },
      { service: "instagram", status: "not_connected" },
    ],
  });
  expect(
    (await handle(new Request(c.app + "/api/saver", { headers }), s, c)).status,
  ).toBe(401);
  expect((await s.list(c.owner)).length).toBe(0);
  expect(
    (await s.query("SELECT key FROM ad_records WHERE namespace='session'"))
      .length,
  ).toBe(0);
});
it("requires owner + CSRF for foreground automation, and does not run concurrent maintenance", async () => {
  await s.put(
    "session",
    digest("owner"),
    { owner: c.owner, csrf: "csrf" },
    600,
  );
  const headers = { cookie: "__Host-ad_session=owner", origin: c.app };
  expect(
    (
      await handle(
        new Request(c.app + "/api/connections/sync", {
          method: "POST",
          headers,
        }),
        s,
        c,
      )
    ).status,
  ).toBe(403);
  await s.put("connection-job-lock", c.owner, {}, 120);
  const result = await handle(
    new Request(c.app + "/api/connections/sync", {
      method: "POST",
      headers: { ...headers, "x-ad-csrf": "csrf" },
    }),
    s,
    c,
  );
  expect(await result.json()).toMatchObject({
    pending: true,
    completed: false,
  });
});
it("upgrades and renews Instagram server-side without exposing credentials or reviving a disconnected account", async () => {
  vi.stubEnv("INSTAGRAM_OAUTH_CLIENT_ID", "fixture-id");
  vi.stubEnv("INSTAGRAM_OAUTH_CLIENT_SECRET", "fixture-secret");
  await s.put("instagram-account", c.owner, {
    id: "fixture",
    username: "fixture",
    accountType: "BUSINESS",
    permissions: ["instagram_business_basic"],
    connectedAt: new Date().toISOString(),
    encryptedToken: seal(
      { accessToken: "short-fixture" },
      "instagram-account:" + c.owner,
    ),
    expiresAt: Date.now() + 3600000,
  });
  let calls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls++;
      const u = new URL(url);
      expect(u.origin).toBe("https://graph.instagram.com");
      if (calls === 1) {
        expect(u.searchParams.get("grant_type")).toBe("ig_exchange_token");
        expect(u.searchParams.get("client_secret")).toBe("fixture-secret");
      } else expect(u.searchParams.get("grant_type")).toBe("ig_refresh_token");
      return Response.json({
        access_token: "long-fixture-" + calls,
        expires_in: 60 * 86400,
      });
    }),
  );
  const request = () =>
    new Request(c.app + "/api/jobs/connections", {
      method: "POST",
      headers: { authorization: "Bearer " + "a".repeat(43) },
    });
  expect((await handle(request(), s, c)).status).toBe(200);
  const updated = await s.get<any>("instagram-account", c.owner);
  expect(updated.longLived).toBe(true);
  expect(JSON.stringify(updated)).not.toContain("long-fixture");
  await handle(request(), s, c);
  expect(calls).toBe(1);
  await s.put("instagram-account", c.owner, {
    ...updated,
    refreshedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  });
  await handle(request(), s, c);
  expect(calls).toBe(2);
  const latest = await s.get<any>("instagram-account", c.owner);
  await s.put("instagram-account", c.owner, {
    ...latest,
    refreshedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await s.remove("instagram-account", c.owner);
      return Response.json({
        access_token: "must-not-revive",
        expires_in: 60 * 86400,
      });
    }),
  );
  await handle(request(), s, c);
  expect(await s.get("instagram-account", c.owner)).toBeNull();
});

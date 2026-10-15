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
import { unseal } from "../server/secrets";
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
const headers = {
  origin: c.app,
  cookie: "__Host-ad_session=owner",
  "x-ad-csrf": "csrf",
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
  vi.stubEnv("INSTAGRAM_OAUTH_CLIENT_ID", "ig-client");
  vi.stubEnv("INSTAGRAM_OAUTH_CLIENT_SECRET", "ig-secret");
  vi.stubEnv("AD_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));
  await s.put(
    "session",
    digest("owner"),
    { owner: c.owner, csrf: "csrf" },
    600,
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(async () => pg.close());
it("uses Instagram Login only with business basic, verifies owner state, encrypts tokens and exposes no saved-post import", async () => {
  const result = await handle(
    new Request(c.app + "/api/instagram/connect", { method: "POST", headers }),
    s,
    c,
  );
  expect(result.status).toBe(200);
  const url = new URL((await result.json()).url);
  expect(url.origin).toBe("https://www.instagram.com");
  expect(url.searchParams.get("scope")).toBe("instagram_business_basic");
  const state = url.searchParams.get("state")!,
    browser = result.headers.get("set-cookie")!.split(";")[0];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init: any) => {
      if (String(url) === "https://api.instagram.com/oauth/access_token") {
        const p = new URLSearchParams(init.body);
        expect(p.get("client_secret")).toBe("ig-secret");
        expect(p.get("redirect_uri")).toBe(c.app + "/api/instagram/callback");
        return Response.json({
          data: [
            {
              access_token: "fixture-private-token",
              user_id: "app-scoped-id",
              permissions: "instagram_business_basic",
            },
          ],
        });
      }
      expect(String(url)).toBe(
        "https://graph.instagram.com/v25.0/me?fields=user_id,username,account_type",
      );
      expect(init.headers.authorization).toBe("Bearer fixture-private-token");
      return Response.json({
        data: [
          {
            user_id: "professional-id",
            username: "fixture",
            account_type: "Media_Creator",
          },
        ],
      });
    }),
  );
  const callback = await handle(
    new Request(
      c.app +
        "/api/instagram/callback?" +
        new URLSearchParams({ state, code: "fixture" }),
      { headers: { cookie: headers.cookie + "; " + browser } },
    ),
    s,
    c,
  );
  expect(callback.status).toBe(303);
  const account = await s.get<any>("instagram-account", c.owner);
  expect(JSON.stringify(account)).not.toContain("fixture-private-token");
  expect(
    unseal<any>(account.encryptedToken, "instagram-account:" + c.owner)
      .accessToken,
  ).toBe("fixture-private-token");
  const status = await handle(
    new Request(c.app + "/api/instagram/status", { headers }),
    s,
    c,
  );
  const body = await status.json();
  expect(body).toMatchObject({
    connected: true,
    savedPostsImportSupported: false,
    lastImportAt: null,
    permissions: ["instagram_business_basic"],
  });
  expect(JSON.stringify(body)).not.toContain("fixture-private-token");
  const replay = await handle(
    new Request(
      c.app +
        "/api/instagram/callback?" +
        new URLSearchParams({ state, code: "fixture" }),
      { headers: { cookie: headers.cookie + "; " + browser } },
    ),
    s,
    c,
  );
  expect(replay.status).toBe(401);
});
it("explicitly reports missing Meta setup and denies the gateway and unauthenticated callers", async () => {
  vi.stubEnv("INSTAGRAM_OAUTH_CLIENT_ID", "");
  const status = await handle(
    new Request(c.app + "/api/instagram/status", { headers }),
    s,
    c,
  );
  expect(await status.json()).toMatchObject({
    configured: false,
    connected: false,
    savedPostsImportSupported: false,
  });
  expect(
    (
      await handle(
        new Request(c.app + "/api/instagram/connect", {
          method: "POST",
          headers,
        }),
        s,
        c,
      )
    ).status,
  ).toBe(503);
  expect(
    (await handle(new Request(c.app + "/api/instagram/status"), s, c)).status,
  ).toBe(401);
  expect(
    (
      await handle(new Request(c.gateway + "/api/instagram/status"), s, {
        ...c,
        role: "gateway",
      })
    ).status,
  ).toBe(404);
});
it("cannot complete a connect from another browser or with a changed owner session", async () => {
  const result = await handle(
      new Request(c.app + "/api/instagram/connect", {
        method: "POST",
        headers,
      }),
      s,
      c,
    ),
    url = new URL((await result.json()).url);
  const response = await handle(
    new Request(
      c.app +
        "/api/instagram/callback?" +
        new URLSearchParams({
          state: url.searchParams.get("state")!,
          code: "fixture",
        }),
      { headers },
    ),
    s,
    c,
  );
  expect((await response.json()).error).toBe("instagram_state_rejected");
  expect(await s.get("instagram-account", c.owner)).toBeNull();
});
it("disconnects locally without claiming remote revocation when Meta fails, preserving references", async () => {
  await s.put("instagram-account", c.owner, {
    id: "id",
    encryptedToken: "unreadable",
  });
  const result = await handle(
    new Request(c.app + "/api/instagram/disconnect", {
      method: "POST",
      headers,
    }),
    s,
    c,
  );
  expect(await result.json()).toMatchObject({
    disconnected: true,
    revoked: false,
    referencesPreserved: true,
  });
  expect(await s.get("instagram-account", c.owner)).toBeNull();
});

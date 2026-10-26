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
import { createHash, randomUUID } from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { Store, digest } from "../server/store";
import { handle } from "../server/service";
import { verifyGoogleIdToken } from "../server/google";
import { unseal } from "../server/secrets";
import type { Config } from "../server/security";
const c: Config = {
  role: "app",
  app: "https://app.example",
  gateway: "https://gateway.example",
  owner: "340639438",
  githubClient: "github",
  githubSecret: "secret",
  redirects: [],
};
let pg: PGlite, s: Store, key: CryptoKey, jwk: object;
const headers = {
  origin: c.app,
  cookie: "__Host-ad_session=github-owner",
  "x-ad-csrf": "csrf",
};
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(await readFile("sql/001-private-saver.sql", "utf8"));
  s = new Store(
    async (q, p = []) =>
      (await pg.query(q, p)).rows as Record<string, unknown>[],
  );
  const pair = await generateKeyPair("RS256");
  key = pair.privateKey;
  jwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: "fixture-key",
    alg: "RS256",
    use: "sig",
  };
}, 30000);
beforeEach(async () => {
  await pg.exec("TRUNCATE ad_records,ad_saver,ad_quota,ad_audit");
  vi.stubEnv(
    "GOOGLE_OAUTH_CLIENT_ID",
    "1234567890-fixture.apps.googleusercontent.com",
  );
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "google-secret");
  vi.stubEnv("AD_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  await s.put(
    "session",
    digest("github-owner"),
    { owner: c.owner, csrf: "csrf", authMethod: "github" },
    600,
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(async () => pg.close());
async function signed(
  sub: string,
  nonce: string,
  claims: Record<string, unknown> = {},
) {
  return new SignJWT({ sub, nonce, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "fixture-key" })
    .setIssuer("https://accounts.google.com")
    .setAudience("1234567890-fixture.apps.googleusercontent.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}
async function start(mode: "link" | "login" = "link") {
  const response = await handle(
    new Request(c.app + "/api/auth/google/" + mode, {
      method: mode === "link" ? "POST" : "GET",
      headers,
    }),
    s,
    c,
  );
  expect(response.status).toBe(200 + (mode === "login" ? 103 : 0));
  const url = new URL(
    mode === "link"
      ? (await response.json()).url
      : response.headers.get("location")!,
  );
  expect(url.searchParams.get("scope")).toBe("openid");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  const state = url.searchParams.get("state")!;
  const stored = await s.get<{ encrypted: string }>(
    "google-login",
    digest(state),
  );
  const pending = unseal<any>(
    stored!.encrypted,
    "google-login:" + digest(state),
  );
  expect(stored!.encrypted).not.toContain(pending.verifier);
  expect(
    createHash("sha256").update(pending.verifier).digest("base64url"),
  ).toBe(url.searchParams.get("code_challenge"));
  expect(response.headers.get("set-cookie")).toContain(
    "Secure; HttpOnly; SameSite=Lax",
  );
  return {
    state,
    pending,
    cookie: response.headers.get("set-cookie")!.split(";")[0],
  };
}
function mockProvider(idToken: string, verifier: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init: any) => {
      if (String(url).includes("/oauth2/v3/certs"))
        return Response.json({ keys: [jwk] });
      expect(String(url)).toBe("https://oauth2.googleapis.com/token");
      const body = new URLSearchParams(init.body);
      expect(body.get("code_verifier")).toBe(verifier);
      expect(body.get("client_secret")).toBe("google-secret");
      expect(body.get("redirect_uri")).toBe(
        c.app + "/api/auth/google/callback",
      );
      return Response.json({
        id_token: idToken,
        access_token: "must-not-be-stored",
      });
    }),
  );
}
async function callback(
  begin: Awaited<ReturnType<typeof start>>,
  sub = "owner-google",
  overrideCookie?: string,
) {
  mockProvider(await signed(sub, begin.pending.nonce), begin.pending.verifier);
  return handle(
    new Request(
      c.app +
        "/api/auth/google/callback?" +
        new URLSearchParams({ state: begin.state, code: "fixture-code" }),
      {
        headers: {
          cookie: overrideCookie ?? headers.cookie + "; " + begin.cookie,
        },
      },
    ),
    s,
    c,
  );
}
it("links Google only after verified GitHub, then signs into the same owner and reads the same library UUID", async () => {
  const reference = {
    id: randomUUID(),
    title: "Isolated library",
    content: "Same owner",
    capturedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    revision: 1,
    origin: "human",
    isInternalQA: false,
  };
  await s.save(c.owner, reference);
  const linked = await callback(await start());
  expect(linked.status).toBe(303);
  expect(linked.headers.get("location")).toBe(c.app + "/?google=linked#/accueil");
  expect(await s.get("google-owner", c.owner)).toMatchObject({
    sub: "owner-google",
  });
  const begin = await start("login");
  const logged = await callback(begin, "owner-google", begin.cookie);
  expect(logged.status).toBe(303);
  expect(logged.headers.get("location")).toBe(c.app + "/#/accueil");
  const cookie = logged.headers.get("set-cookie")!.split(";")[0];
  expect(cookie).toContain("__Host-ad_session=");
  const session = await handle(
    new Request(c.app + "/api/session", { headers: { cookie } }),
    s,
    c,
  );
  expect(await session.json()).toMatchObject({
    ownerId: c.owner,
    authenticated: true,
  });
  const read = await handle(
    new Request(c.app + "/api/saver/" + reference.id, { headers: { cookie } }),
    s,
    c,
  );
  expect((await read.json()).reference.id).toBe(reference.id);
  const library = await handle(
    new Request(c.app + "/api/saver", { headers: { cookie } }),
    s,
    c,
  );
  expect((await library.json()).references[0].id).toBe(reference.id);
  expect(await s.get("saver-read-proof", c.owner)).toMatchObject({
    authMethod: "google",
    owner: c.owner,
    verified: true,
    sampleUuid: reference.id,
    referenceCount: 1,
  });
  expect(
    JSON.stringify((await pg.query("SELECT data FROM ad_records")).rows),
  ).not.toContain("must-not-be-stored");
  const replay = await callback(begin);
  expect((await replay.json()).error).toBe("google_state_rejected");
});
it("rejects another cryptographically valid Google sub and grants it no session or library access", async () => {
  await callback(await start());
  const before = await pg.query(
    "SELECT count(*) FROM ad_records WHERE namespace='session'",
  );
  const begin = await start("login"),
    response = await callback(begin, "other-person", begin.cookie);
  expect(response.status).toBe(403);
  expect((await response.json()).error).toBe("google_not_linked_owner");
  expect(response.headers.has("set-cookie")).toBe(false);
  expect(
    (
      await pg.query(
        "SELECT count(*) FROM ad_records WHERE namespace='session'",
      )
    ).rows,
  ).toEqual(before.rows);
  expect((await handle(new Request(c.app + "/api/saver"), s, c)).status).toBe(
    401,
  );
});
it("requires owner + exact CSRF to link, rejects Google sessions for linking, and disallows login before binding", async () => {
  expect(
    (
      await handle(
        new Request(c.app + "/api/auth/google/link", {
          method: "POST",
          headers: { origin: c.app },
        }),
        s,
        c,
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await handle(
        new Request(c.app + "/api/auth/google/link", {
          method: "POST",
          headers: { ...headers, "x-ad-csrf": "wrong" },
        }),
        s,
        c,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await handle(new Request(c.app + "/api/auth/google/login"), s, c)
    ).headers.get("location"),
  ).toBe(c.app + "/api/auth/google/setup");
  const binding = {
    sub: "owner-google",
    client: "1234567890-fixture.apps.googleusercontent.com",
    linkedAt: "fixture",
  };
  await s.put("google-owner", c.owner, binding);
  await s.put(
    "session",
    digest("github-owner"),
    {
      owner: c.owner,
      csrf: "csrf",
      authMethod: "google",
      googleBinding: digest(
        JSON.stringify([binding.sub, binding.client, binding.linkedAt]),
      ),
    },
    600,
  );
  expect(
    (
      await handle(
        new Request(c.app + "/api/auth/google/link", {
          method: "POST",
          headers,
        }),
        s,
        c,
      )
    ).status,
  ).toBe(403);
});
it("rejects wrong browser, expired state and a changed linking session before token exchange", async () => {
  const first = await start();
  const rejected = await callback(
    first,
    "owner-google",
    headers.cookie + "; __Host-ad_google=wrong",
  );
  expect((await rejected.json()).error).toBe("google_state_rejected");
  expect(fetch).not.toHaveBeenCalled();
  const second = await start();
  await pg.query(
    "UPDATE ad_records SET expires_at=now()-interval '1 minute' WHERE namespace='google-login'",
  );
  expect((await (await callback(second)).json()).error).toBe(
    "google_state_rejected",
  );
  const third = await start();
  await s.put(
    "session",
    digest("new-session"),
    { owner: c.owner, csrf: "other", authMethod: "github" },
    600,
  );
  expect(
    (
      await (
        await callback(
          third,
          "owner-google",
          "__Host-ad_session=new-session; " + third.cookie,
        )
      ).json()
    ).error,
  ).toBe("google_link_session_changed");
});
it("validates signatures, issuer, audience, expiry and nonce against the actual JWKS verifier", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ keys: [jwk] })),
  );
  const valid = await signed("owner-google", "nonce");
  expect(
    await verifyGoogleIdToken(
      valid,
      "1234567890-fixture.apps.googleusercontent.com",
      "nonce",
    ),
  ).toBe("owner-google");
  await expect(
    verifyGoogleIdToken(valid, "another-client", "nonce"),
  ).rejects.toMatchObject({ code: "google_id_token_rejected" });
  await expect(
    verifyGoogleIdToken(
      valid,
      "1234567890-fixture.apps.googleusercontent.com",
      "wrong",
    ),
  ).rejects.toMatchObject({ code: "google_id_token_rejected" });
  const forged = await new SignJWT({ sub: "owner-google", nonce: "nonce" })
    .setProtectedHeader({ alg: "RS256", kid: "fixture-key" })
    .setIssuer("https://evil.example")
    .setAudience("1234567890-fixture.apps.googleusercontent.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
  await expect(
    verifyGoogleIdToken(
      forged,
      "1234567890-fixture.apps.googleusercontent.com",
      "nonce",
    ),
  ).rejects.toMatchObject({ code: "google_id_token_rejected" });
  const expired = await new SignJWT({ sub: "owner-google", nonce: "nonce" })
    .setProtectedHeader({ alg: "RS256", kid: "fixture-key" })
    .setIssuer("https://accounts.google.com")
    .setAudience("1234567890-fixture.apps.googleusercontent.com")
    .setIssuedAt(Math.floor(Date.now() / 1000) - 1000)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 100)
    .sign(key);
  await expect(
    verifyGoogleIdToken(
      expired,
      "1234567890-fixture.apps.googleusercontent.com",
      "nonce",
    ),
  ).rejects.toMatchObject({ code: "google_id_token_rejected" });
  const other = await generateKeyPair("RS256");
  const badSignature = await new SignJWT({
    sub: "owner-google",
    nonce: "nonce",
  })
    .setProtectedHeader({ alg: "RS256", kid: "fixture-key" })
    .setIssuer("https://accounts.google.com")
    .setAudience("1234567890-fixture.apps.googleusercontent.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(other.privateKey);
  await expect(
    verifyGoogleIdToken(
      badSignature,
      "1234567890-fixture.apps.googleusercontent.com",
      "nonce",
    ),
  ).rejects.toMatchObject({ code: "google_id_token_rejected" });
});
it("unlink preserves the library, revokes Google sessions and prevents another login", async () => {
  await callback(await start());
  const begin = await start("login");
  await callback(begin, "owner-google", begin.cookie);
  const unlinked = await handle(
    new Request(c.app + "/api/auth/google/unlink", { method: "POST", headers }),
    s,
    c,
  );
  expect((await unlinked.json()).referencesPreserved).toBe(true);
  expect(
    (
      await pg.query(
        "SELECT key FROM ad_records WHERE namespace='session' AND data->>'authMethod'='google'",
      )
    ).rows,
  ).toHaveLength(0);
  expect(await s.get("session", digest("github-owner"))).not.toBeNull();
  expect(
    (
      await handle(new Request(c.app + "/api/auth/google/login"), s, c)
    ).headers.get("location"),
  ).toBe(c.app + "/api/auth/google/setup");
});

it("routes first-time Google login through verified GitHub and an explicit same-origin linking form", async () => {
  const login = await handle(
    new Request(c.app + "/api/auth/google/login"),
    s,
    c,
  );
  expect(login.headers.get("location")).toBe(c.app + "/api/auth/google/setup");
  const missing = await handle(
    new Request(c.app + "/api/auth/google/setup"),
    s,
    c,
  );
  expect(missing.headers.get("location")).toBe(
    c.app + "/api/auth/login?return=google",
  );
  const setup = await handle(
    new Request(c.app + "/api/auth/google/setup", { headers }),
    s,
    c,
  );
  expect(setup.status).toBe(200);
  expect(setup.headers.get("referrer-policy")).toBe("same-origin");
  expect(await setup.text()).toContain('name="csrf" value="csrf"');
  const linked = await handle(
    new Request(c.app + "/api/auth/google/link", {
      method: "POST",
      headers: {
        cookie: headers.cookie,
        origin: c.app,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ csrf: "csrf" }),
    }),
    s,
    c,
  );
  expect(linked.status).toBe(303);
  expect(new URL(linked.headers.get("location")!).origin).toBe(
    "https://accounts.google.com",
  );
  expect(await s.get("google-owner", c.owner)).toBeNull();
});
it("rejects a malformed or swapped client ID before Google and normalizes surrounding whitespace", async () => {
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "GOCSPX-not-a-client-id");
  const bad = await handle(
    new Request(c.app + "/api/auth/google/status"),
    s,
    c,
  );
  expect(await bad.json()).toMatchObject({
    configured: false,
    configurationError: "google_client_id_invalid",
  });
  const rejected = await handle(
    new Request(c.app + "/api/auth/google/link", { method: "POST", headers }),
    s,
    c,
  );
  expect((await rejected.json()).error).toBe("google_client_id_invalid");
  vi.stubEnv(
    "GOOGLE_OAUTH_CLIENT_ID",
    " 1234567890-fixture.apps.googleusercontent.com\n",
  );
  const valid = await handle(
    new Request(c.app + "/api/auth/google/link", { method: "POST", headers }),
    s,
    c,
  );
  expect(valid.status).toBe(200);
  expect(new URL((await valid.json()).url).searchParams.get("client_id")).toBe(
    "1234567890-fixture.apps.googleusercontent.com",
  );
});

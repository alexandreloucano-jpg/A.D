import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
const state = vi.hoisted(() => ({
  store: null as any,
  config: {
    role: "gateway" as const,
    app: "https://app.example",
    gateway: "https://gateway.example",
    owner: "340639438",
    githubClient: "",
    githubSecret: "",
    redirects: [] as string[],
  },
}));
vi.mock("../server/store.js", async (actual) => ({
  ...(await actual<any>()),
  database: () => state.store,
}));
vi.mock("../server/security.js", async (actual) => ({
  ...(await actual<any>()),
  configuration: () => state.config,
}));
import handler from "../api/index";
import { Store, digest } from "../server/store";
let pg: PGlite;
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(await readFile("sql/001-private-saver.sql", "utf8"));
  state.store = new Store(
    async (q, p = []) =>
      (await pg.query(q, p)).rows as Record<string, unknown>[],
  );
}, 30000);
beforeEach(async () => pg.exec("TRUNCATE ad_records,ad_quota,ad_audit"));
afterAll(async () => pg.close());
async function exchangeBody(mode: "parsed" | "raw" | "buffer") {
  const clientId = randomUUID(),
    secret = "fixture + & = percent % secret",
    code = randomUUID(),
    verifier = "a".repeat(43),
    resource = state.config.gateway + "/mcp",
    redirect = "https://consumer.example/callback";
  await state.store.put("client", clientId, {
    id: clientId,
    name: "Fixture",
    secretHash: digest(secret),
    redirects: [redirect],
    revoked: false,
  });
  await state.store.put(
    "code",
    digest(code),
    {
      owner: state.config.owner,
      clientId,
      resource,
      scope: "saver:read saver:write",
      redirect,
      challenge: createHash("sha256").update(verifier).digest("base64url"),
    },
    120,
  );
  const fields = {
    client_id: clientId,
    client_secret: secret,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    resource,
    redirect_uri: redirect,
  };
  const raw = new URLSearchParams(fields).toString();
  let output = "";
  const res = {
    statusCode: 0,
    setHeader: vi.fn(),
    end: (value: Buffer | string) => {
      output = value.toString();
    },
  };
  const req = {
    method: "POST",
    url: "/api/index?route=token",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body:
      mode === "parsed" ? fields : mode === "buffer" ? Buffer.from(raw) : raw,
  };
  await handler(req as any, res as any);
  expect(res.statusCode).toBe(200);
  const token = JSON.parse(output);
  expect(token.access_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(
    await state.store.get("token", digest(token.access_token)),
  ).toMatchObject({ resource, clientId });
  await handler(req as any, res as any);
  expect(res.statusCode).toBe(400);
}
it("accepts URL-encoded OAuth fields already parsed by Vercel, preserving reserved characters and PKCE", async () =>
  exchangeBody("parsed"));
it("also accepts an untouched URL-encoded body", async () =>
  exchangeBody("raw"));
it("accepts a raw Buffer without JSON stringifying it", async () =>
  exchangeBody("buffer"));

async function nodeResponse(req: any) {
  let raw = "";
  const headers = new Map<string, string>();
  const res = {
    statusCode: 0,
    setHeader: (key: string, value: string) => headers.set(key, value),
    end: (value: Buffer | string) => {
      raw = value.toString();
    },
  };
  await handler(req, res as any);
  return { status: res.statusCode, headers, body: raw };
}
async function consentFixture() {
  (state.config as any).role = "app";
  await state.store.put(
    "session",
    digest("owner-browser"),
    { owner: state.config.owner, csrf: "csrf-fixture" },
    600,
  );
  const pending = "pending-fixture";
  const clientId = randomUUID();
  state.config.redirects = ["https://consumer.example/callback"];
  await state.store.put("client", clientId, {
    id: clientId,
    name: "Diagnostic",
    secretHash: digest("secret"),
    redirects: state.config.redirects,
    revoked: false,
  });
  await state.store.put(
    "authorization",
    pending,
    {
      owner: state.config.owner,
      clientId,
      redirect: state.config.redirects[0],
      resource: state.config.gateway + "/mcp",
      scope: "saver:read saver:write",
      state: "consumer-state",
      challenge: "a".repeat(43),
    },
    600,
  );
  return pending;
}
it("distinguishes origin errors, missing/wrong CSRF, expired sessions and alias submissions without consuming consent", async () => {
  const pending = await consentFixture();
  const base = {
    method: "POST",
    url: "/api/index?route=api/oauth/authorize",
    headers: {
      host: "app.example",
      origin: state.config.app,
      cookie: "__Host-ad_session=owner-browser",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: { pending, csrf: "csrf-fixture", decision: "approve" },
  };
  const variants: [any, string][] = [
    [
      { headers: { ...base.headers, origin: "https://other.example" } },
      "csrf_origin_mismatch",
    ],
    [{ headers: { ...base.headers, origin: "null" } }, "csrf_origin_opaque"],
    [
      { headers: { ...base.headers, origin: undefined } },
      "csrf_origin_missing",
    ],
    [{ body: { ...base.body, csrf: "" } }, "csrf_token_missing"],
    [{ body: { ...base.body, csrf: "wrong" } }, "csrf_token_invalid"],
    [
      { headers: { ...base.headers, cookie: "__Host-ad_session=expired" } },
      "owner_session_expired",
    ],
    [
      { headers: { ...base.headers, host: "preview.example" } },
      "form_domain_mismatch",
    ],
  ];
  for (const [change, code] of variants) {
    const result = await nodeResponse({ ...base, ...change });
    expect(JSON.parse(result.body).error).toBe(code);
    expect(await state.store.get("authorization", pending)).not.toBeNull();
  }
  const accepted = await nodeResponse(base);
  expect(accepted.status).toBe(303);
  expect(accepted.headers.get("location")).toContain(
    "https://consumer.example/callback?",
  );
  (state.config as any).role = "gateway";
});
it("canonicalizes GET on an alias before setting cookies or consuming OAuth state and never redirects POST", async () => {
  await consentFixture();
  const result = await nodeResponse({
    method: "GET",
    url: "/api/index?route=api/oauth/authorize&pending=pending-fixture",
    headers: { host: "preview.example" },
  });
  expect(result.status).toBe(303);
  expect(result.headers.get("location")).toBe(
    "https://app.example/api/oauth/authorize?pending=pending-fixture",
  );
  expect(result.headers.has("set-cookie")).toBe(false);
  (state.config as any).role = "gateway";
});
it("submits the actual OAuth form in Chromium through the Vercel Node adapter with a valid HTTP Origin", async () => {
  const { chromium } = await import("@playwright/test");
  const pending = await consentFixture();
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: "__Host-ad_session",
        value: "owner-browser",
        url: state.config.app,
        secure: true,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();
    let postedOrigin = "",
      final = "",
      googleDestination = "";
    await page.route("https://consumer.example/**", async (route) => {
      final = route.request().url();
      await route.fulfill({ body: "returned" });
    });
    await page.route(state.config.app + "/**", async (route) => {
      const request = route.request(),
        h = await request.allHeaders();
      if (request.method() === "POST") postedOrigin = h.origin;
      const url = new URL(request.url());
      const response = await nodeResponse({
        method: request.method(),
        url: url.pathname + url.search,
        headers: h,
        body: request.postData()
          ? Object.fromEntries(new URLSearchParams(request.postData()!))
          : undefined,
      });
      const destination = response.headers.get("location");
      if (
        destination &&
        new URL(destination).origin === "https://accounts.google.com"
      ) {
        googleDestination = destination;
        expect(response.status).toBe(303);
        // Do not let the fixture navigate to a real identity provider.
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<p>Google redirect verified in isolated fixture</p>",
        });
        return;
      }
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: response.body,
      });
    });
    await page.goto(
      state.config.app + "/api/oauth/authorize?pending=" + pending,
    );
    await page
      .getByRole("button", { name: "Autoriser Saver", exact: true })
      .click();
    await page.waitForURL("https://consumer.example/**");
    expect(postedOrigin).toBe(state.config.app);
    expect(new URL(final).searchParams.get("code")).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    expect(new URL(final).searchParams.get("state")).toBe("consumer-state");
    vi.stubEnv(
      "GOOGLE_OAUTH_CLIENT_ID",
      "1234567890-fixture.apps.googleusercontent.com",
    );
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "google-secret-fixture");
    vi.stubEnv(
      "AD_TOKEN_ENCRYPTION_KEY",
      Buffer.alloc(32, 31).toString("base64"),
    );
    await page.route("https://accounts.google.com/**", (route) =>
      route.fulfill({ body: "Google consent fixture" }),
    );
    await page.goto(state.config.app + "/api/auth/google/setup");
    await page
      .getByRole("button", { name: "Lier mon compte Google", exact: true })
      .click();
    await vi.waitFor(() => expect(googleDestination).not.toBe(""));
    expect(postedOrigin).toBe(state.config.app);
    expect(
      new URL(googleDestination).searchParams.get("code_challenge_method"),
    ).toBe("S256");
  } finally {
    await browser.close();
    vi.unstubAllEnvs();
    (state.config as any).role = "gateway";
  }
}, 45000);

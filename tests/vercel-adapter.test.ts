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

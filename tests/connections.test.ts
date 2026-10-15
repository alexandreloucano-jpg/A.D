import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Store, digest } from "../server/store";
import { handle } from "../server/service";
import { GROK_CALLBACK } from "../server/registration";
import type { Config } from "../server/security";
const c: Config = {
  role: "app",
  app: "https://app.example",
  gateway: "https://gateway.example",
  owner: "340639438",
  githubClient: "",
  githubSecret: "",
  redirects: [GROK_CALLBACK],
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
  await pg.exec("TRUNCATE ad_records,ad_saver,ad_quota,ad_audit");
  await s.put(
    "session",
    digest("owner"),
    { owner: c.owner, csrf: "csrf" },
    600,
  );
});
afterAll(async () => pg.close());
const req = (method = "GET", csrf = "csrf") =>
  new Request(c.app + "/api/connections/grok", {
    method,
    headers: {
      cookie: "__Host-ad_session=owner",
      origin: c.app,
      "x-ad-csrf": csrf,
    },
  });
async function client() {
  const id = randomUUID();
  await s.put("client", id, {
    id,
    owner: c.owner,
    resource: c.gateway + "/mcp",
    redirects: [GROK_CALLBACK],
    revoked: false,
  });
  return id;
}
const status = async () => (await handle(req(), s, c)).json();
it("does not confuse registration, consent, token issuance and a verified dedicated consumer exchange", async () => {
  expect(await status()).toMatchObject({ state: "ready", connected: false });
  const id = await client();
  expect(await status()).toMatchObject({ state: "ready", connected: false });
  const grant = {
    owner: c.owner,
    resource: c.gateway + "/mcp",
    clientId: id,
    scope: "saver:read saver:write",
  };
  await s.put("authorization", "pending", grant, 600);
  expect(await status()).toMatchObject({
    state: "consent_required",
    connected: false,
  });
  await s.remove("authorization", "pending");
  await s.audit(c.owner, id, "oauth_consent", "approved");
  await s.put("token", "test", grant, 600);
  expect(await status()).toMatchObject({
    state: "verification_required",
    connected: false,
  });
  await s.audit("other-owner", id, "get_saved_inspiration", "completed");
  await s.audit(c.owner, "other-client", "get_saved_inspiration", "completed");
  await s.audit(c.owner, id, "get_saved_inspiration", "failed");
  expect((await status()).connected).toBe(false);
  await s.audit(c.owner, id, "get_saved_inspiration", "completed");
  expect((await status()).connected).toBe(false);
  const referenceId = randomUUID(),
    now = new Date().toISOString();
  await s.save(c.owner, {
    id: referenceId,
    title: "Approved fixture",
    url: "https://example.org/approved-fixture",
    content: "",
    origin: "grok",
    capturedAt: now,
    approvedAt: now,
    revision: 1,
    isInternalQA: false,
  });
  await s.audit(
    c.owner,
    id,
    "save_inspiration_reference",
    "verified:" + referenceId,
  );
  await s.audit(c.owner, id, "get_saver_capture", "verified:" + randomUUID());
  expect((await status()).connected).toBe(false);
  await s.audit(c.owner, id, "get_saver_capture", "verified:" + referenceId);
  expect(await status()).toMatchObject({ state: "connected", connected: true });
  await s.remove("token", "test");
  expect(await status()).toMatchObject({ state: "expired", connected: false });
});
it("protects disconnect with CSRF, revokes outstanding codes and grants and preserves all references", async () => {
  const id = await client(),
    now = new Date().toISOString(),
    referenceId = randomUUID();
  const grant = {
    owner: c.owner,
    resource: c.gateway + "/mcp",
    clientId: id,
    scope: "saver:read saver:write",
  };
  for (const ns of ["code", "authorization", "token", "refresh"])
    await s.put(ns, "test-" + ns, grant, 600);
  await s.save(c.owner, {
    id: referenceId,
    title: "Human",
    content: "Keep",
    capturedAt: now,
    approvedAt: now,
    revision: 1,
    origin: "human",
    isInternalQA: false,
  });
  expect((await handle(req("DELETE", ""), s, c)).status).toBe(403);
  expect((await s.get<any>("client", id)).revoked).toBe(false);
  expect((await handle(req("DELETE"), s, c)).status).toBe(200);
  for (const ns of ["code", "authorization", "token", "refresh"])
    expect(await s.get(ns, "test-" + ns)).toBeNull();
  expect(await s.read(c.owner, referenceId)).not.toBeNull();
  expect(await status()).toMatchObject({ state: "ready", connected: false });
  expect(
    (await handle(new Request(c.app + "/api/connections/grok"), s, c)).status,
  ).toBe(401);
});

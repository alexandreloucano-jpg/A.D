import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Store, digest } from "../server/store";
import { handle } from "../server/service";
import { collectionsSchema, validateProposals } from "../src/collections/model";
import { parseSharedCapture } from "../src/share";
import type { Config } from "../server/security";
let pg: PGlite, s: Store;
const c: Config = {
  role: "app",
  app: "https://app.example",
  gateway: "https://gateway.example",
  owner: "340639438",
  githubClient: "",
  githubSecret: "",
  redirects: [],
};
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(await readFile("sql/001-private-saver.sql", "utf8"));
  s = new Store(
    async (sql, params = []) =>
      (await pg.query(sql, params)).rows as Record<string, unknown>[],
  );
  await s.put(
    "session",
    digest("owner-fixture"),
    { owner: c.owner, csrf: "csrf" },
    600,
  );
}, 30000);
afterAll(async () => pg.close());
function request(method = "GET", body?: unknown, authenticated = true) {
  return new Request(c.app + "/api/collections", {
    method,
    headers: {
      ...(authenticated ? { cookie: "__Host-ad_session=owner-fixture" } : {}),
      origin: c.app,
      "x-ad-csrf": "csrf",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
it("persists groups with readback, protects concurrency and never deletes references", async () => {
  const now = new Date().toISOString(),
    id = randomUUID();
  await s.save(c.owner, {
    id,
    title: "Fixture",
    content: "isolated",
    capturedAt: now,
    approvedAt: now,
    revision: 1,
    origin: "human",
    isInternalQA: true,
  });
  const input = {
    version: 1,
    revision: 0,
    groups: [
      {
        id: randomUUID(),
        name: "Matières",
        referenceIds: [id],
        createdAt: now,
      },
    ],
  };
  const saved = await handle(request("PUT", input), s, c);
  expect(saved.status).toBe(200);
  expect(await saved.json()).toMatchObject({
    verified: true,
    collections: { revision: 1 },
  });
  const read = await handle(request(), new Store(s.query), c);
  expect((await read.json()).collections.groups[0].referenceIds).toEqual([id]);
  expect((await handle(request("PUT", input), s, c)).status).toBe(409);
  const empty = { version: 1, revision: 1, groups: [] };
  expect((await handle(request("PUT", empty), s, c)).status).toBe(200);
  expect(await s.read(c.owner, id)).not.toBeNull();
});
it("rejects unauthenticated access, bearer-only access, cross-owner references and forged revisions", async () => {
  expect((await handle(request("GET", undefined, false), s, c)).status).toBe(
    401,
  );
  const bearer = new Request(c.app + "/api/collections", {
    headers: { authorization: "Bearer fixture" },
  });
  expect((await handle(bearer, s, c)).status).toBe(401);
  const now = new Date().toISOString();
  const foreign = {
    version: 1,
    revision: 2,
    groups: [
      {
        id: randomUUID(),
        name: "Foreign",
        referenceIds: [randomUUID()],
        createdAt: now,
      },
    ],
  };
  expect((await handle(request("PUT", foreign), s, c)).status).toBe(400);
  const csrf = new Request(c.app + "/api/collections", {
    method: "PUT",
    headers: {
      cookie: "__Host-ad_session=owner-fixture",
      origin: "https://other.example",
    },
    body: JSON.stringify({ version: 1, revision: 2, groups: [] }),
  });
  expect((await handle(csrf, s, c)).status).toBe(403);
  expect(
    collectionsSchema.safeParse({
      version: 1,
      revision: 0,
      groups: [],
      tasks: ["NOW"],
    }).success,
  ).toBe(false);
});
it("validates untrusted Grok groups without accepting unknown IDs or duplicate names", () => {
  const id = randomUUID();
  expect(
    validateProposals(
      { groups: [{ name: "Images", referenceIds: [id] }] },
      new Set([id]),
      [],
    ),
  ).toHaveLength(1);
  expect(() =>
    validateProposals(
      { groups: [{ name: "Images", referenceIds: [id] }] },
      new Set(),
      [],
    ),
  ).toThrow();
  expect(() =>
    validateProposals(
      { groups: [{ name: "Images", referenceIds: [id] }] },
      new Set([id]),
      ["images"],
    ),
  ).toThrow();
  expect(() =>
    validateProposals(
      { groups: [{ name: "Images", referenceIds: [id], task: "NOW" }] },
      new Set([id]),
      [],
    ),
  ).toThrow();
});
it("accepts X/Instagram shared text as an unsaved draft and rejects unsafe links/oversized payloads", () => {
  expect(
    parseSharedCapture(
      "#/saver?share=1&text=" +
        encodeURIComponent("À lire https://x.com/example/status/123"),
    ),
  ).toMatchObject({ url: "https://x.com/example/status/123", shared: true });
  expect(
    parseSharedCapture(
      "#/saver?share=1&url=" +
        encodeURIComponent("https://www.instagram.com/p/abc/"),
    ),
  ).toMatchObject({ url: "https://www.instagram.com/p/abc/" });
  expect(() =>
    parseSharedCapture("#/saver?share=1&url=javascript:alert(1)"),
  ).toThrow();
  expect(() =>
    parseSharedCapture("#/saver?share=1&text=" + "x".repeat(10001)),
  ).toThrow();
  expect(parseSharedCapture("#/saver")).toBeNull();
});

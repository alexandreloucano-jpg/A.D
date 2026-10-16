import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { Store, digest } from "../server/store";
import { handle } from "../server/service";
import { ReaderStore } from "../server/reader";
import { parseBookmarkFile } from "../src/intake/parse";
import { canonicalSource, uniqueIntake } from "../src/intake/model";
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
  for (const file of ["001-private-saver.sql", "002-reader-beta.sql"])
    await pg.exec(await readFile("sql/" + file, "utf8"));
  s = new Store(
    async (q, p = []) =>
      (await pg.query(q, p)).rows as Record<string, unknown>[],
  );
  await s.put(
    "session",
    digest("intake-fixture"),
    { owner: c.owner, csrf: "csrf" },
    600,
  );
}, 30000);
afterAll(async () => pg.close());
const request = (items: unknown[], csrf = "csrf") =>
  new Request(c.app + "/api/intake", {
    method: "POST",
    headers: {
      cookie: "__Host-ad_session=intake-fixture",
      origin: c.app,
      "x-ad-csrf": csrf,
    },
    body: JSON.stringify({ method: "file", items }),
  });
it("canonicalizes shared post URLs without retaining tracking or accepting secret parameters", () => {
  expect(
    canonicalSource("https://twitter.com/author/status/12345/photo/1?s=20"),
  ).toBe("https://x.com/i/web/status/12345");
  expect(() =>
    canonicalSource("https://example.com/?access_token=private"),
  ).toThrow();
});
it("preserves quoted CSV notes and deduplicates equivalent X links", () => {
  const parsed = parseBookmarkFile(
    'url,title,notes\nhttps://x.com/a/status/123,"A, B","human\nnote"\nhttps://twitter.com/b/status/123,Other,second',
    "bookmarks.csv",
  );
  expect(parsed.items).toHaveLength(1);
  expect(parsed.duplicates).toBe(1);
  expect(parsed.items[0].notes).toEqual(["human\nnote", "second"]);
  expect(parsed.items[0].text).toBe("");
});
it("rejects malformed files and full workspace backups without silently dropping rows", () => {
  expect(() =>
    parseBookmarkFile('url,title\nhttps://example.com,"unfinished', "bad.csv"),
  ).toThrow();
  expect(() =>
    parseBookmarkFile(
      JSON.stringify({ version: 1, projects: [], tasks: [] }),
      "backup.json",
    ),
  ).toThrow();
  expect(() => uniqueIntake([{ url: "javascript:alert(1)" }])).toThrow();
});
it("requires CSRF and keeps the intake endpoint unavailable on the MCP gateway", async () => {
  expect(
    (await handle(request([{ url: "https://example.com" }], "wrong"), s, c))
      .status,
  ).toBe(403);
  expect(
    (
      await handle(new Request(c.gateway + "/api/intake"), s, {
        ...c,
        role: "gateway",
      })
    ).status,
  ).toBe(404);
});
it("persists and reads the same UUID, preserves human edits, merges imported notes and isolates metadata/search", async () => {
  const item = {
    url: "https://x.com/a/status/123456",
    title: "Original",
    text: "Source",
    notes: ["Imported thought"],
    tags: ["Architecture"],
  };
  const first = await handle(request([item]), s, c);
  expect(first.status).toBe(200);
  const a = (await first.json()).results[0];
  expect(a.verified).toBe(true);
  const original = await s.read(c.owner, a.id);
  expect(original?.title).toBe("Original");
  await s.query(
    "UPDATE ad_saver SET reference=jsonb_set(reference, '{title}', '\"Human corrected\"'::jsonb) WHERE owner_id=$1 AND id=$2",
    [c.owner, a.id],
  );
  const again = await handle(
    request([
      {
        ...item,
        url: "https://twitter.com/a/status/123456",
        notes: ["Another thought"],
      },
    ]),
    s,
    c,
  );
  const b = (await again.json()).results[0];
  expect(b.id).toBe(a.id);
  expect(b.existing).toBe(true);
  expect((await s.read(c.owner, a.id))?.title).toBe("Human corrected");
  const meta = await handle(
    new Request(c.app + "/api/intake?ids=" + a.id, {
      headers: { cookie: "__Host-ad_session=intake-fixture" },
    }),
    s,
    c,
  );
  expect((await meta.json()).sources[0].notes).toEqual([
    "Imported thought",
    "Another thought",
  ]);
  const reader = new ReaderStore(s);
  expect((await reader.search(c.owner, "Another thought"))[0].referenceId).toBe(
    a.id,
  );
  expect(await reader.search("different-owner", "Another thought")).toEqual([]);
  expect(await s.read("different-owner", a.id)).toBeNull();
});
it("retains an existing human UUID and content when an export contains the same URL", async () => {
  const id = "ad30e354-e9d5-4d81-a72d-063ad65b1fad",
    now = new Date().toISOString();
  await s.save(c.owner, {
    id,
    title: "Human title",
    content: "Human notes",
    url: "https://twitter.com/me/status/5555555",
    origin: "human",
    capturedAt: now,
    approvedAt: now,
    revision: 1,
    isInternalQA: false,
  });
  const res = await handle(
    request([
      {
        url: "https://x.com/me/status/5555555",
        title: "Export title",
        text: "Export text",
      },
    ]),
    s,
    c,
  );
  expect((await res.json()).results[0]).toMatchObject({
    id,
    verified: true,
    existing: true,
  });
  expect((await s.read(c.owner, id))?.content).toBe("Human notes");
});
it("rejects unauthenticated requests and enforces a persistent owner quota", async () => {
  expect((await handle(new Request(c.app + "/api/intake"), s, c)).status).toBe(
    401,
  );
  await s.query(
    "INSERT INTO ad_quota(principal,bucket_window,used) VALUES($1,$2,500) ON CONFLICT(principal,bucket_window) DO UPDATE SET used=500",
    ["intake:" + c.owner, Math.floor(Date.now() / 3600000)],
  );
  expect(
    (await handle(request([{ url: "https://example.com/over-quota" }]), s, c))
      .status,
  ).toBe(429);
});

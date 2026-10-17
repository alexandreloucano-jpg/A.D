import { it, expect, vi, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { Store } from "../../server/store";
const state = vi.hoisted(() => ({ articleCalls: 0 }));
vi.mock("../../server/market/fetch.js", async (original) => ({
  ...(await original<any>()),
  publicFetch: vi.fn(async (url: string) => {
    const u = new URL(url);
    let text = "";
    if (u.pathname === "/robots.txt") text = "User-agent: *\nAllow: /";
    else if (url === "https://www.doitinparis.com/fr")
      text =
        '<a href="/fr/maison-orbe-12345">Maison Orbe ouvrira un hôtel à Paris</a>';
    else if (url === "https://wsn-events.com/blog")
      text =
        '<a href="/blog/article/maison-orbe">Maison Orbe nouvelle ouverture</a>';
    else if (u.pathname.includes("maison-orbe")) {
      state.articleCalls++;
      text =
        '<h1>Maison Orbe ouvrira un hôtel à Paris 8e</h1><time datetime="' +
        new Date().toISOString() +
        '"></time><article>La marque hospitality prépare une ouverture le 20 novembre 2026 au 75008 Paris.</article>';
    }
    return { text, status: 200, etag: null, modified: null };
  }),
}));
import { scan } from "../../server/market/jobs";
import { SOURCES } from "../../server/market/sources";
let pg: PGlite;
afterAll(async () => pg?.close());
it("bounds discovery per source, resumes all thematic collectors, and marks connected only after stored extraction", async () => {
  pg = new PGlite();
  await pg.exec(await readFile("sql/001-private-saver.sql", "utf8"));
  await pg.exec(await readFile("sql/005-market-intelligence.sql", "utf8"));
  const s = new Store(
    async (q, p = []) =>
      (await pg.query(q, p)).rows as Record<string, unknown>[],
  );
  let run = await scan(s, "fixture-owner");
  expect(run.paused).toBe(true);
  expect(state.articleCalls).toBe(0);
  expect(
    (
      await s.query(
        "SELECT data FROM ad_market_sources WHERE source_id='do-it-paris'",
      )
    )[0].data,
  ).toHaveProperty("ingestionVerifiedAt", null);
  for (let i = 1; i < SOURCES.length; i++) {
    run = await scan(s, "fixture-owner", run.id);
    expect(state.articleCalls).toBe(0);
  }
  run = await scan(s, "fixture-owner", run.id);
  expect(run.paused).toBe(false);
  expect(run.status).toBe("succeeded");
  expect(state.articleCalls).toBe(2);
  expect(run.insertedCount + run.deduplicatedCount).toBe(2);
  expect(
    (
      await s.query(
        "SELECT data FROM ad_market_sources WHERE source_id='do-it-paris'",
      )
    )[0].data,
  ).toHaveProperty("ingestionVerifiedAt");
  expect((await s.query("SELECT * FROM ad_market_actions")).length).toBe(0);
}, 30000);

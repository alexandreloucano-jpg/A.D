import { it, expect } from "vitest";
import registry from "../../docs/radar-user-sources-2026-10-17.json" with { type: "json" };
import { SOURCE_REGISTRY, SOURCES } from "../../server/market/sources";
import { parseArticle } from "../../server/market/analyze";
import { homepageFinding } from "../../src/scout-market/qualification";
const now = new Date("2026-10-17T12:00:00Z");
it("registers all six exact supplied URLs and preserves legacy sources without duplicate network collection", () => {
  for (const entry of registry.sources) {
    const saved = SOURCE_REGISTRY.find((s) => s.id === entry.id);
    expect(saved?.registeredUrl).toBe(entry.url);
    expect(saved?.userSupplied).toBe(true);
    expect(saved?.cautions).toEqual(entry.cautions);
  }
  for (const id of [
    "journal-du-luxe",
    "fashion-network",
    "hospitality-on",
    "maddyness",
    "do-it-paris",
    "wsn",
  ])
    expect(SOURCE_REGISTRY.some((s) => s.id === id)).toBe(true);
  expect(
    SOURCES.filter((s) => s.domain === "fr.fashionnetwork.com"),
  ).toHaveLength(0);
});
it("never enables blocked agency scraping, BoF, Scholar or references with no validated ingester", () => {
  for (const id of [
    "fashion-pr-firm",
    "bof-paris",
    "fashionnetwork-fr",
    "scholar-rhode",
    "creatoriq",
    "fairway",
  ])
    expect(SOURCE_REGISTRY.find((s) => s.id === id)?.enabled).toBe(false);
  expect(SOURCE_REGISTRY.find((s) => s.id === "scholar-rhode")?.purpose).toBe(
    "research",
  );
  expect(SOURCES.find((s) => s.id === "glossy-luxury")?.connector).toBe(
    "article",
  );
});
it("keeps Rhode popup dates historical and European distribution a distinct unconfirmed development", () => {
  const source = SOURCE_REGISTRY.find((s) => s.id === "cosmetics-business")!;
  const f = parseArticle(
    '<h1>Rhode lands in Sephora Europe with Café Rhode pop-up</h1><byline class="article-byline">Published: 30-Sep-2026</byline><article>Rhode is available in Sephora Europe. Café Rhode in Paris is running from 30 September to 4 October.</article>',
    source.url,
    now,
  )!;
  expect(f).not.toBeNull();
  expect(f.companyName).toBe("Rhode");
  expect(f.classification).toBe("strategic");
  expect(f.eventStart).toBe("2026-09-30T00:00:00.000Z");
  expect(f.eventEnd).toBe("2026-10-04T23:59:59.999Z");
  expect(f.timing).toBe("past");
  expect(f.qualification).toBe("past");
  expect(f.publishedAt).toBe("2026-09-30T00:00:00.000Z");
  expect(homepageFinding(f)).toBe(false);
  expect(f.relatedDevelopments?.[0].commercialNeed).toBeNull();
  expect(f.assessment?.commercial_need_hypothesis).toBeNull();
  expect(Object.keys(f.assessment!)).toEqual(
    expect.arrayContaining(registry.required_fields),
  );
});
it("treats Glossy EMV as strategic vendor estimates, never as Dior revenue, budget or buying intent", () => {
  const source = SOURCE_REGISTRY.find((s) => s.id === "glossy-luxury")!;
  const f = parseArticle(
    '<h1>Luxury Briefing: Dior drove Paris Fashion Week’s record buzz</h1><time datetime="2026-10-16"></time><article>Lefty and Karla Otto estimate 30 million dollars in earned media value (EMV) from the fashion collection. New record buzz.</article>',
    source.url,
    now,
  )!;
  expect(f.companyName).toBe("Dior");
  expect(f.classification).toBe("strategic");
  expect(f.metricCautions?.[0]).toContain("ni ventes");
  expect(f.assessment?.budget_evidence).toBeNull();
  expect(f.budgetMaxEur).toBeNull();
  expect(homepageFinding(f)).toBe(false);
});

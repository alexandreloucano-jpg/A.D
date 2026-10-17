import { describe, expect, it } from "vitest";
import { assessLookalike, isReferenceOnly } from "../../src/scout-market/lookalike";
import type { Finding } from "../../src/scout-market/schema";

function item(patch: Partial<Finding> = {}) {
  const sample: Finding = {
    id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
    companyId: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
    signalId: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
    evidenceId: "dddddddd-dddd-4ddd-dddd-dddddddddddd",
    companyName: "Le Nouveau Comptoir",
    sector: "hospitality, restaurants et bar",
    city: "Paris",
    arrondissement: "75011",
    eventType: "store_opening",
    headline: "Le Nouveau Comptoir ouvrira bientôt à Paris",
    reportedFact: "Nouvelle adresse annoncée",
    canonicalUrl: "https://example.org/ouverture",
    publisher: "Source test",
    sourceId: "test",
    publishedAt: "2026-10-17T10:00:00Z",
    eventDate: "2026-12-01T00:00:00Z",
    firstSeenAt: "2026-10-17T10:00:00Z",
    lastSeenAt: "2026-10-17T10:00:00Z",
    sourceCount: 1,
    sourceClass: "press",
    status: "source_confirmed",
    excerpt: "",
    contentHash: "hash",
    whyNow: "Annonce d'une ouverture à venir",
    potentialNeed: "À vérifier",
    services: [],
    creativeAngle: "",
    knownUnknowns: [],
    score: null,
    coverage: 0,
    factors: {},
    confidence: "low",
    budgetMinEur: null,
    budgetMaxEur: null,
    reviewState: "new",
    stage: "discovered",
    projectId: null,
    updatedAt: "2026-10-17T10:00:00Z",
    timing: "upcoming",
    classification: "commercial",
    qualification: "actionable",
    contactApproach: { department: "Direction du lieu", basis: "role_hypothesis", name: null },
    ...patch,
  };
  return assessLookalike(sample);
}

describe("Paris solo DA lookalike qualification", () => {
  it("keeps the owner's archetypes out of cold prospecting", () => {
    expect(isReferenceOnly("Caché")).toBe(true);
    expect(isReferenceOnly("Maison François 1er")).toBe(true);
    expect(item({ companyName: "Caché" }).gate).toBe("reference_only");
    expect(item({ companyName: "François 1er" }).gate).toBe("reference_only");
    expect(item({ companyName: "Schiaparelli" }).gate).toBe("reference_only");
  });
  it("recognizes an independent restaurant-bar's genuine similarities with Caché", () => {
    const v = item({
      reportedFact:
        "Les fondateurs annoncent une adresse de restaurant-bar dans un ancien atelier sous verrière. Cocktail, chef, invités et soirées musique à Paris.",
      corroboratingPrimarySource: "https://example.org/restaurant",
    });
    expect(v.archetype).toBe("cache-paris");
    expect(v.similarity.score).not.toBeNull();
    expect(v.soloOpportunity.score).not.toBeNull();
    expect(v.gate).toBe("prospect_review");
    expect(v.serviceHypothesis).toContain("rituel");
  });
  it("selects François 1er for a convivial independent French brasserie rather than nightlife", () => {
    const v = item({
      reportedFact:
        "Des associés annoncent leur nouvelle brasserie française à Paris 8e : banquettes de velours, déjeuner, dîner et service convivial.",
      corroboratingPrimarySource: "https://example.org/brasserie",
    });
    expect(v.archetype).toBe("maison-francois-1er");
    expect(v.similarity.score).not.toBeNull();
  });
  it("does not claim aesthetic similarity when the source merely mentions a Paris restaurant", () => {
    const v = item({ reportedFact: "Un restaurant ouvrira à Paris.", headline: "Restaurant à Paris" });
    expect(v.similarity.score).toBeNull();
    expect(v.observedMatches).toHaveLength(0);
    expect(v.gate).not.toBe("prospect_review");
  });
  it("does not elevate media buzz from a global luxury house into a solo lead", () => {
    const v = item({
      companyName: "Dior",
      sector: "Mode et luxe",
      reportedFact: "La campagne mondiale à Paris bat un record de visibilité.",
      eventType: "campaign_launch",
    });
    expect(v.gate).toBe("cultural");
    expect(v.similarity.score).toBeNull();
  });
  it("keeps a completed activation out of urgent commercial opportunities", () => {
    const v = item({
      reportedFact: "Ancien pop-up parisien avec chef et soirée",
      timing: "past",
      qualification: "past",
    });
    expect(v.gate).toBe("past");
  });
  it("never invents a creative budget or an identified buyer from sector and media coverage", () => {
    const v = item({ reportedFact: "Restaurant chic indépendant à Paris" });
    expect(v.soloOpportunity.reasons.some((r) => /budget/i.test(r))).toBe(false);
    expect(v.missingEvidence).toContain("Interlocuteur et accès commercial non vérifiés");
    expect(v.missingEvidence).toContain("Budget de production créative non confirmé");
  });
});

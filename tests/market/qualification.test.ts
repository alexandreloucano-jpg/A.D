import { it, expect } from "vitest";
import { parseArticle } from "../../server/market/analyze";
import {
  qualifyFinding,
  homepageFinding,
  compareFindings,
} from "../../src/scout-market/qualification";
import { SOURCE_REGISTRY, SOURCES } from "../../server/market/sources";
import { robotsAllows } from "../../server/market/fetch";
const now = new Date("2026-10-17T12:00:00Z");
function fixture(headline: string, text: string, date = "2026-10-16") {
  return parseArticle(
    `<h1>${headline}</h1><time datetime="${date}"></time><article>${text}</article>`,
    "https://www.journalduluxe.fr/fr/business/fixture",
    now,
  )!;
}
it("separates runway reviews and published campaigns from commercial triggers", () => {
  for (const [head, text] of [
    [
      "Chanel présente sa collection à Paris",
      "Un magnifique défilé et une collection applaudie.",
    ],
    [
      "Dior dévoile sa campagne à Paris",
      "Cette campagne déjà publiée est magnifique.",
    ],
  ]) {
    const f = fixture(head, text);
    expect(f.classification).toBe("cultural");
    expect(f.score).toBeNull();
    expect(homepageFinding(f)).toBe(false);
  }
});
it("finds an unseen premium brand and a future Paris opening without a hardcoded brand list", () => {
  const f = fixture(
    "Maison Orbe ouvrira son hôtel à Paris 8e",
    "La nouvelle marque hospitality prépare une ouverture le 20 novembre 2026 au 75008 Paris.",
  );
  expect(f.companyName).toBe("Maison Orbe");
  expect(f.classification).toBe("commercial");
  expect(f.timing).toBe("upcoming");
  expect(f.eventDate).toBe("2026-11-20T00:00:00.000Z");
  expect(f.targetPriority).toBe("paris");
  expect(f.arrondissement).toBe("75008");
  expect(homepageFinding(f)).toBe(true);
  expect(f.contactApproach?.basis).toBe("role_hypothesis");
  expect(f.budgetMinEur).toBeNull();
  expect(f.services).toContain("storytelling architectural");
});
it("does not treat a newly published recap or expired popup as an urgent opportunity", () => {
  const f = fixture(
    "Maison Orbe ouvre un pop-up à Paris",
    "Retour sur ce pop-up terminé : ouverture le 10 septembre 2026.",
  );
  expect(f.qualification).toBe("past");
  expect(f.classification).toBe("cultural");
  expect(homepageFinding(f)).toBe(false);
});
it("does not infer the date of an opening from publication alone", () => {
  const f = fixture(
    "Maison Orbe ouvre une boutique à Paris",
    "La marque ouvre une boutique ; aucun calendrier communiqué.",
  );
  expect(f.timing).toBe("unknown");
  expect(f.qualification).toBe("verify");
  expect(homepageFinding(f)).toBe(false);
  expect(f.factors.time_relevance.value).toBeNull();
});
it("keeps financing distinct from a creative budget and recognizes only an explicitly cited role", () => {
  const f = fixture(
    "Numa lève 8 millions pour sa marque de nutrition",
    "Cette marque de nutrition prépare une nouvelle gamme. Levée de fonds de 8 millions d’euros. La directrice marketing présente le projet.",
  );
  expect(f.companyName).toBe("Numa");
  expect(f.factors.budget_evidence.value).toBe(0.5);
  expect(f.budgetBasis).toContain("n’est pas un budget créatif");
  expect(f.budgetMaxEur).toBeNull();
  expect(f.contactApproach?.basis).toBe("reported_role");
  expect(f.contactApproach?.name).toBeNull();
});
it("respects known relationships, human blocks, and excludes cultural signals from home", () => {
  for (const companyName of ["Caché", "François 1er", "Schiaparelli"]) {
    const f = fixture(
      "Maison Orbe ouvrira une boutique à Paris",
      "La marque prépare une boutique.",
    );
    expect(
      qualifyFinding({ ...f, companyName, relationshipStatus: "cold" }, now)
        .relationshipStatus,
    ).toBe("existing");
    expect(
      qualifyFinding({ ...f, companyName, relationshipStatus: "blocked" }, now)
        .relationshipStatus,
    ).toBe("blocked");
  }
  const a = fixture(
    "Maison Orbe ouvrira un hôtel à Paris 8e",
    "Le projet hôtelier prépare une ouverture.",
  );
  const b = fixture(
    "Chanel présente sa collection",
    "La collection est magnifique.",
  );
  expect([b, a].sort(compareFindings)[0].id).toBe(a.id);
});
it("keeps strategic sources and unlicensed press releases out of commercial collection", () => {
  expect(SOURCE_REGISTRY.filter((s) => s.purpose === "strategic")).toHaveLength(
    5,
  );
  expect(SOURCES.every((s) => s.purpose === "commercial" && s.enabled)).toBe(
    true,
  );
  expect(SOURCE_REGISTRY.find((s) => s.id === "pr-newswire")?.enabled).toBe(
    false,
  );
  expect(SOURCES.some((s) => s.id === "do-it-paris")).toBe(true);
  expect(SOURCE_REGISTRY.find((s) => s.id === "fairway")?.accessStatus).toBe(
    "directory_only",
  );
});
it("respects the matching robots group, longest rule and allow exceptions without bypassing AD restrictions", () => {
  expect(
    robotsAllows(
      "User-agent: TTD-Content\nDisallow: /\nUser-agent: *\nDisallow: /private/",
      "/article",
    ),
  ).toBe(true);
  expect(robotsAllows("User-agent: *\nDisallow: /private/", "/private/a")).toBe(
    false,
  );
  expect(
    robotsAllows(
      "User-agent: *\nDisallow: /private/\nAllow: /private/public/",
      "/private/public/a",
    ),
  ).toBe(true);
  expect(
    robotsAllows(
      "User-agent: AD-Market\nDisallow: /\nUser-agent: *\nAllow: /",
      "/article",
    ),
  ).toBe(false);
});
it("does not turn marketing language or historical collaborations into future events", () => {
  const review = fixture(
    "Le Petit Brochant : nouvelle brasserie préférée",
    "La nouvelle adresse est déjà ouverte. Ce sera votre futur QG ; découvrez le décor.",
  );
  expect(review.timing).not.toBe("upcoming");
  expect(homepageFinding(review)).toBe(false);
  const heritage = fixture(
    "Spoturno, la renaissance de la parfumerie",
    "Cette maison de parfum raconte sa collaboration historique avec son parfumeur en 1904.",
  );
  expect(heritage.classification).toBe("cultural");
  const tech = fixture(
    "Dougs lève 50 millions",
    "La société d’expertise comptable utilise son nouveau modèle de logiciel.",
  );
  expect(tech.classification).toBe("cultural");
});
it("keeps an old announcement when its explicit event date is still upcoming", () => {
  const f = fixture(
    "Maison Orbe ouvrira un hôtel à Paris 8e",
    "L’ouverture du lieu est prévue : ouverture le 20 novembre 2026 au 75008 Paris.",
    "2026-06-01",
  );
  expect(f).not.toBeNull();
  expect(f.timing).toBe("upcoming");
  expect(f.classification).toBe("commercial");
  expect(homepageFinding(f)).toBe(true);
});

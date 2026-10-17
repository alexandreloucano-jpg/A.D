import type { Finding } from "./schema.js";

/**
 * Evidence-first, small-studio targeting. These are public comparative
 * archetypes, NEVER leads or assertions of an existing client relationship.
 * A press description can reveal a place's concept, but it cannot verify
 * photographs, an open mandate, revenue or the owner's personal connections.
 */
export const REFERENCE_ARCHETYPES = [
  {
    id: "cache-paris",
    label: "Caché",
    location: "Paris 20e",
    traits: "Adresse à caractère, restaurant-bar, rituels, soirée, lieux de rencontre",
  },
  {
    id: "maison-francois-1er",
    label: "Maison François 1er",
    location: "Paris 8e",
    traits: "Brasserie chic et vivante, service, déjeuner et dîner, convivialité",
  },
] as const;
export type ArchetypeId = (typeof REFERENCE_ARCHETYPES)[number]["id"];
export type EvidenceScore = {
  score: number | null;
  coverage: number;
  reasons: string[];
};
export interface LookalikeAssessment {
  archetype: ArchetypeId | null;
  archetypeLabel: string | null;
  observedMatches: string[];
  differences: string[];
  missingEvidence: string[];
  similarity: EvidenceScore;
  soloOpportunity: EvidenceScore;
  gate:
    | "reference_only"
    | "prospect_review"
    | "verify"
    | "lookalike_watchlist"
    | "cultural"
    | "past";
  serviceHypothesis: string | null;
}
type Factor = { weight: number; value: 0 | 0.5 | 1 | null; reason: string };
const clean = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const has = (s: string, re: RegExp) => re.test(s);
const references = new Set([
  "cache", "cache paris", "maison francois 1er", "francois 1er",
  "francois ier", "hotel francois 1er", "schiaparelli",
]);
export const isReferenceOnly = (name: string) =>
  references.has(clean(name).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim());
const giants = /\b(chanel|dior|guerlain|ritz|lvmh|kering|louis vuitton|hermes|sephora|schiaparelli|galeries lafayette|richemont|augustinus bader)\b/i;
const hospitality = /\b(restaurant|brasserie|bistrot|bistro|bar|cafe|hotel|hotellerie|hospitality|table|supper club|nightlife|club prive|cocktail|chef|cuisine|terrasse|auberge)\b/;
const cache = {
  identity: /\b(restaurant.bar|bar.restaurant|bar a (vin|cocktail)|cocktail|bar|speakeasy|listening bar|club prive|supper club|restaurant)\b/,
  atmosphere: /\b(cache|confidentiel|discret|intimiste|cour|impasse|atelier|verriere|ancien atelier|marbre|industriel|hidden)\b/,
  people: /\b(dj|musique|soiree|afterwork|residence|communaute|habitu|invites|evenement|diner|nuit|night)\b/,
  story: /\b(chef|poisson|huitre|oyster|bar|cocktail|carte|rituel|programmation|cuisine)\b/,
};
const francois = {
  identity: /\b(brasserie|bistrot|bistro|restaurant|table francaise|cuisine francaise)\b/,
  atmosphere: /\b(boiserie|velours|banquette|bois|lumiere tamisee|chic|elegan|maison d.amis|chaleureu|convivial)\b/,
  people: /\b(dejeuner|diner|habitu|service|quartier|convivial|matin|soir|terrasse)\b/,
  story: /\b(chef|service|cuisine francaise|carte|table|rituel|brasserie)\b/,
};
function score(factors: Factor[], threshold: number): EvidenceScore {
  const weight = factors.reduce((n, f) => n + f.weight, 0);
  const known = factors.filter((f) => f.value !== null);
  const used = known.reduce((n, f) => n + f.weight, 0);
  const coverage = weight ? Number((used / weight).toFixed(2)) : 0;
  return {
    score:
      coverage >= threshold
        ? Math.round(known.reduce((n, f) => n + f.weight * (f.value ?? 0), 0))
        : null,
    coverage,
    reasons: known.filter((f) => (f.value ?? 0) > 0).map((f) => f.reason),
  };
}
type Input = Pick<Finding,
  | "companyName" | "sector" | "city" | "arrondissement"
  | "headline" | "reportedFact" | "excerpt" | "analysisText"
  | "eventType" | "timing" | "classification" | "qualification"
  | "status" | "sourceClass" | "corroboratingPrimarySource"
  | "selfPromotional" | "relationshipStatus" | "contactApproach"
>;
export function assessLookalike(f: Input): LookalikeAssessment {
  // Sector taxonomy alone is NOT evidence of a venue’s aesthetic, people or rituals.
  const text = clean([f.headline, f.reportedFact, f.excerpt, f.analysisText || ""].join(" "));
  const sector = clean(f.sector);
  const paris = f.city === "Paris" || !!f.arrondissement ||
    /\bparis\b|\b750(?:0\d|1\d|20)\b/.test(text);
  const venue = has(text + " " + sector, hospitality);
  const independent = has(text, /\b(independant|fondateurs?|fondatrices?|associes?|proprietaires?|nouveaux exploitants|petit groupe|maison familiale)\b/);
  const global = giants.test(f.companyName) ||
    has(text, /\b(multinationale|groupe international|palace|leader mondial)\b/);
  const seed = (id: ArchetypeId, pattern: typeof cache) => {
    const concept = venue && has(text, pattern.identity);
    const atm = has(text, pattern.atmosphere);
    const people = has(text, pattern.people);
    const story = has(text, pattern.story);
    const evidence: Factor[] = [
      { weight: 20, value: venue ? (concept ? 1 : 0.5) : 0, reason: "Type de lieu et offre mentionnés dans la source" },
      { weight: 25, value: atm ? 1 : null, reason: "Caractère du lieu décrit par la source (pas analyse photographique)" },
      { weight: 15, value: people ? 1 : null, reason: "Usage social ou rituel explicitement décrit" },
      { weight: 15, value: global ? 0 : independent ? 1 : null, reason: "Exploitation indépendante ou fondateur signalé" },
      { weight: 15, value: story ? 1 : null, reason: "Récit du service, produit ou programmation documenté" },
      { weight: 10, value: paris ? 1 : f.city ? 0 : null, reason: "Lieu situé à Paris" },
    ];
    return { id, output: score(evidence, 0.6), matchingTraits: [concept, atm, people, story].filter(Boolean).length };
  };
  const candidates = [
    seed("cache-paris", cache),
    seed("maison-francois-1er", francois),
  ].sort((a, b) =>
    (b.output.score ?? -1) - (a.output.score ?? -1) ||
    b.matchingTraits - a.matchingTraits,
  );
  const best = venue && candidates[0].matchingTraits >= 2 ? candidates[0] : null;
  const selected = best?.output ?? { score: null, coverage: 0, reasons: [] };
  const timing = f.timing || "unknown";
  const upcoming = timing === "upcoming" || timing === "ongoing";
  const trigger = f.eventType !== "other_verified_event" && !!f.eventType;
  const commercial = f.classification === "commercial";
  const contactCited = f.contactApproach?.basis === "reported_role";
  const match = !!best && selected.score !== null;
  const solo = score([
    { weight: 25, value: venue ? 1 : commercial ? 0.5 : 0, reason: "Production éditoriale liée au lieu envisageable, sans mandat confirmé" },
    { weight: 25, value: timing === "past" ? 0 : upcoming && trigger ? 1 : null, reason: "Déclencheur actuel ou futur identifié dans la source" },
    { weight: 20, value: contactCited ? 0.5 : null, reason: "Fonction de décision citée ; contact et mandat non vérifiés" },
    { weight: 15, value: global ? 0 : independent ? 1 : null, reason: "Taille de projet compatible avec une petite équipe, à confirmer" },
    { weight: 10, value: paris ? 1 : f.city ? 0 : null, reason: "Production parisienne envisageable" },
    { weight: 5, value: null, reason: "Aucune enveloppe de création prouvée" },
  ], 0.65);
  const reference = isReferenceOnly(f.companyName) || f.relationshipStatus === "existing";
  let gate: LookalikeAssessment["gate"] = "cultural";
  if (reference) gate = "reference_only";
  else if (timing === "past" || f.qualification === "past") gate = "past";
  else if (!commercial || !venue || global) gate = "cultural";
  else if (!upcoming || !trigger) gate = best ? "lookalike_watchlist" : "verify";
  else if (match && solo.score !== null && !f.selfPromotional &&
    (f.status === "corroborated" || !!f.corroboratingPrimarySource) &&
    (contactCited || independent)) gate = "prospect_review";
  else gate = "verify";

  const difference = best?.id === "cache-paris"
    ? "L'activité nocturne et la programmation doivent être confirmées pour cette adresse."
    : "Le rythme déjeuner / soirée et l'autonomie créative du lieu doivent être confirmés.";
  return {
    archetype: best?.id || null,
    archetypeLabel: best
      ? REFERENCE_ARCHETYPES.find((a) => a.id === best.id)!.label
      : null,
    observedMatches: selected.score !== null ? best?.output.reasons || [] : [],
    differences: best ? [difference] : [],
    missingEvidence: [
      ...(selected.score === null ? ["Similarité encore insuffisamment documentée"] : []),
      ...(!independent ? ["Indépendance et circuit de décision inconnus"] : []),
      ...(!contactCited ? ["Interlocuteur et accès commercial non vérifiés"] : []),
      ...(!upcoming ? ["Fenêtre d'achat et calendrier du projet non établis"] : []),
      "Budget de production créative non confirmé",
    ],
    similarity: selected,
    soloOpportunity: solo,
    gate,
    serviceHypothesis:
      venue && best?.id === "cache-paris"
        ? "Hypothèse : portraits du lieu et de ses hôtes, films courts de rituel, lancement d'une programmation."
        : venue && best?.id === "maison-francois-1er"
          ? "Hypothèse : série photographique du service et des espaces, film d'atmosphère, contenus de lancement."
          : null,
  };
}

// Public research with short cited excerpts only; no paywall or login traversal.
// Source-specific robots checked on every discovery slice. Reviewed 2026-10-17.
const newsSources = [
  {
    id: "hospitality-on",
    name: "Hospitality ON",
    url: "https://hospitality-on.com/fr",
    domain: "hospitality-on.com",
    sourceClass: "trade" as const,
    policyUrl: "https://hospitality-on.com/fr/mentions-legales",
    sectorTags: ["hospitality", "investissements", "ouvertures"],
    articlePattern:
      /^\/fr\/(?:hotellerie|ouvertures|developpement|investissement|investissements|restauration|tendances|projets)\/[^/]+$/,
  },
  {
    id: "sortir-paris",
    name: "Sortir à Paris",
    url: "https://www.sortiraparis.com/hotel-restaurant",
    domain: "www.sortiraparis.com",
    sourceClass: "press" as const,
    policyUrl: "https://www.sortiraparis.com/infos-legales/tou",
    sectorTags: ["restaurants", "hôtels", "Paris"],
    articlePattern:
      /^\/hotel-restaurant\/(?:restaurant|hotel|bar-cafes|cafe-tea-time|tendances-food)\/articles\/[^/]+$/,
  },
  {
    id: "fashion-network",
    name: "FashionNetwork",
    url: "https://fr.fashionnetwork.com/",
    domain: "fr.fashionnetwork.com",
    sourceClass: "trade" as const,
    policyUrl: "https://fr.fashionnetwork.com/robots.txt",
    sectorTags: ["marques", "retail", "beauté"],
    articlePattern: /^\/news\/[^/]+,\d+\.html$/,
  },
  {
    id: "maddyness",
    name: "Maddyness",
    url: "https://www.maddyness.com/",
    domain: "www.maddyness.com",
    sourceClass: "trade" as const,
    policyUrl: "https://www.maddyness.com/mentions-legales/",
    sectorTags: ["financements", "nouveaux modèles"],
    articlePattern: /^\/20\d\d\/\d\d\/\d\d\/[^/]+\/?$/,
  },
  {
    id: "journal-du-luxe",
    name: "Journal du Luxe",
    url: "https://www.journalduluxe.fr/",
    domain: "www.journalduluxe.fr",
    sourceClass: "trade" as const,
    policyUrl: "https://www.journalduluxe.fr/fr/mentions-legales",
    sectorTags: ["mode et luxe", "beauté", "hospitality"],
    articlePattern:
      /^\/fr\/(mode|beaute|lifestyle|business|montres-joaillerie)\/[^/]+$/,
  },
];

export type SourceEntry = {
  id: string;
  name: string;
  url: string;
  domain: string;
  sourceClass: "official" | "trade" | "press";
  policyUrl: string;
  sectorTags: string[];
  articlePattern: RegExp;
  purpose: "commercial" | "strategic";
  connector: "news" | "directory" | "reference";
  enabled: boolean;
  accessStatus: string;
  accessNote: string;
  reviewedAt: string;
};
const candidate = (
  id: string,
  name: string,
  url: string,
  purpose: SourceEntry["purpose"],
  accessStatus: string,
  accessNote: string,
  policyUrl = url,
): SourceEntry => ({
  id,
  name,
  url,
  domain: new URL(url).hostname,
  sourceClass: "official",
  policyUrl,
  sectorTags: [],
  articlePattern: /^$/,
  purpose,
  connector: "reference",
  enabled: false,
  accessStatus,
  accessNote,
  reviewedAt: "2026-10-17",
});
export const SOURCE_REGISTRY: SourceEntry[] = [
  {
    id: "do-it-paris",
    name: "Do It In Paris",
    url: "https://www.doitinparis.com/fr",
    domain: "www.doitinparis.com",
    sourceClass: "press",
    policyUrl: "https://www.doitinparis.com/fr/mentions-legales.html",
    sectorTags: ["Paris", "ouvertures", "concepts"],
    articlePattern: /^\/fr\/[^/]+-\d+$/,
    purpose: "commercial",
    connector: "news",
    enabled: true,
    accessStatus: "public_listing_verified",
    accessNote:
      "Pages publiques ; dates et événement à vérifier article par article. Aucun avis de restaurant transformé mécaniquement en prospect.",
    reviewedAt: "2026-10-17",
  },
  {
    id: "wsn",
    name: "WSN / Première Classe",
    url: "https://wsn-events.com/blog",
    domain: "wsn-events.com",
    sourceClass: "official",
    policyUrl: "https://wsn-events.com/cgv",
    sectorTags: ["créateurs", "marques émergentes", "salons"],
    articlePattern: /^\/blog\/article\/[^/]+$/,
    purpose: "commercial",
    connector: "news",
    enabled: true,
    accessStatus: "public_listing_verified",
    accessNote:
      "Éditorial officiel public ; ne déduire ni participation ni besoin actuel d’une ancienne édition de salon. Le catalogue exposants externe n’est pas collecté.",
    reviewedAt: "2026-10-17",
  },
  ...newsSources.map((s) => ({
    ...s,
    purpose: "commercial" as const,
    connector: "news" as const,
    enabled: true,
    accessStatus: "public_listing_verified",
    accessNote:
      "Collecte publique bornée ; connexion confirmée uniquement après extraction persistée. Aucun accès réservé.",
    reviewedAt: "2026-10-17",
  })),
  candidate(
    "fairway",
    "Fairway Luxury Real Estate",
    "https://fairwayluxuryrealestate.com/fr/",
    "commercial",
    "directory_only",
    "Catalogue immobilier accessible ; aucun flux daté de projets ou de mandats créatifs vérifié. Le prix d’un bien n’est pas un budget de production.",
    "https://fairwayluxuryrealestate.com/fr/mentions-legales",
  ),
  candidate(
    "pr-newswire",
    "PR Newswire",
    "https://www.prnewswire.com/news-releases/consumer-products-retail-latest-news/",
    "commercial",
    "permission_required",
    "Conditions : collecte automatisée interdite sans autorisation. Connecteur désactivé ; utiliser une source officielle de l’annonceur autorisée ou un accès sous licence.",
    "https://www.prnewswire.com/terms-of-use/",
  ),
  candidate(
    "official-announcements",
    "Annonces officielles — marques et promoteurs",
    "https://wsn-events.com/press",
    "commercial",
    "curated_only",
    "Seuls les domaines officiels explicitement enregistrés sont autorisés. Aucun domaine tiers découvert n’est ajouté automatiquement au crawler.",
  ),
  candidate(
    "creatoriq",
    "CreatorIQ",
    "https://www.creatoriq.com/blog",
    "strategic",
    "reference_only",
    "Blog accessible ; référence de stratégie creator marketing. Aucun connecteur d’extraction validé et aucune donnée Taste confirmée modifiée.",
  ),
  candidate(
    "ops-engine",
    "The Ops Engine",
    "https://www.theopsengine.com/",
    "strategic",
    "endpoint_unverified",
    "Adresse candidate non confirmée ; essai HTTP 503. L’URL canonique et l’accès restent à vérifier.",
  ),
  candidate(
    "the-cut",
    "The Cut",
    "https://www.thecut.com/",
    "strategic",
    "reference_only",
    "Page publique accessible ; droits et accès article par article à vérifier, aucun contournement de paywall.",
  ),
  candidate(
    "steve-jobs-archive",
    "Steve Jobs Archive",
    "https://stevejobsarchive.com/",
    "strategic",
    "reference_only",
    "Archive de réflexion et de méthode : référence documentaire, pas un flux d’opportunités commerciales.",
  ),
  candidate(
    "david-protein",
    "David Protein — étude de cas",
    "https://davidprotein.com/",
    "strategic",
    "reference_only",
    "Étude de positionnement et de modèle consumer ; le site e-commerce n’est ni un flux daté de signaux ni une preuve de besoin créatif.",
  ),
];
export const SOURCES = SOURCE_REGISTRY.filter(
  (s) => s.enabled && s.connector === "news" && s.purpose === "commercial",
);

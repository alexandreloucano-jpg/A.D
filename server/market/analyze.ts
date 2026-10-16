import { parseHTML } from "linkedom";
import { randomUUID } from "node:crypto";
import { digest } from "../store.js";
import { weights, scoreFactors } from "../../src/scout-market/scoring.js";
import type { Finding, Factor } from "../../src/scout-market/schema.js";
import { SOURCES } from "./sources.js";
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
export function canonical(raw: string) {
  const u = new URL(raw);
  u.search = "";
  u.hash = "";
  return u.href.replace(/\/$/, "");
}
export function parseArticle(
  html: string,
  url: string,
  now = new Date(),
): Finding | null {
  const { document: d } = parseHTML(html);
  const headline = clean(d.querySelector("h1")?.textContent || "");
  const article =
    d.querySelector(".article-content") || d.querySelector("article");
  if (!article || !headline) return null;
  article.querySelectorAll("script,style,nav,form").forEach((n) => n.remove());
  const text = clean(article.textContent || "");
  const rawDate = d.querySelector("time[datetime]")?.getAttribute("datetime");
  const date = rawDate ? new Date(rawDate) : null;
  const publishedAt =
    date && !isNaN(+date) && +date <= +now + 86400000
      ? date.toISOString()
      : null;
  if (publishedAt && +now - new Date(publishedAt).getTime() > 45 * 86400000)
    return null;
  // No named-entity guessing: only explicit brand names in the headline qualify automatically.
  const companyName = [
    "Louis Vuitton",
    "Alexander McQueen",
    "Marc-Antoine Barrois",
    "Relais & Châteaux",
    "Relais-Châteaux",
    "Cheval Blanc",
    "Audemars Piguet",
    "Kim Jones",
    "L’Oréal",
    "L'Oréal",
    "Lancôme",
    "Sephora",
    "Blancpain",
    "Chanel",
    "Dior",
    "Kering",
    "Ruinart",
    "LVMH",
    "Spoturno",
    "Fashionphile",
    "F.P. Journe",
    "Ebel",
  ].find((n) =>
    headline.toLocaleLowerCase("fr").includes(n.toLocaleLowerCase("fr")),
  );
  if (!companyName) return null;
  const eventRules: [RegExp, string][] = [
    [/lance|lancer|nouvelle marque|marque éponyme/i, "brand_launch"],
    [/boutique|ouvre|ouverture/i, "store_opening"],
    [/collabor|alliance|signe avec|partenariat/i, "brand_collaboration"],
    [/collection|nouveaux sacs|nouveau parfum/i, "product_launch"],
    [/nomm|directeur|départ|conseil.*administration/i, "major_hire"],
    [/campagne|influence|réseaux sociaux/i, "campaign_launch"],
    [/rénov/i, "hospitality_renovation"],
    [/hôtel|palace|dégustation/i, "commercial_event"],
  ];
  const eventType =
    eventRules.find(([re]) => re.test(headline))?.[1] || "other_verified_event";
  const sector = url.includes("/beaute/")
    ? "beauté et parfumerie"
    : url.includes("/lifestyle/")
      ? "hospitality et lifestyle"
      : "mode et luxe";
  const city = /\bparis\b/i.test(headline + " " + text) ? "Paris" : null;
  const id = randomUUID(),
    evidenceId = randomUUID(),
    stamp = now.toISOString();
  const strong = [
    "brand_launch",
    "store_opening",
    "product_launch",
    "brand_collaboration",
    "hospitality_renovation",
  ].includes(eventType);
  const factors: Record<string, Factor> = {};
  for (const [k, weight] of Object.entries(weights))
    factors[k] = {
      weight,
      value: null,
      reason: "Information non établie.",
      evidenceIds: [],
      assessedAt: stamp,
    };
  const set = (k: string, value: 0 | 0.5 | 1 | null, reason: string) =>
    Object.assign(factors[k], { value, reason, evidenceIds: [evidenceId] });
  set(
    "service_fit",
    0.5,
    "Photo, film et direction de contenu potentiellement pertinents ; aucun besoin acheté confirmé.",
  );
  set(
    "trigger_strength",
    strong ? 1 : 0.5,
    `Déclencheur rapporté : ${eventType}.`,
  );
  set(
    "time_relevance",
    publishedAt ? 1 : null,
    publishedAt
      ? "Publication dans la fenêtre de 45 jours ; date exacte du fait inconnue."
      : "Date de publication inconnue.",
  );
  set(
    "creative_opportunity",
    strong ? 0.5 : null,
    strong
      ? "Un lancement ou une activation peut appeler un récit visuel ; vérifier les prestataires en place."
      : "Espace créatif non établi.",
  );
  return {
    id,
    companyId: randomUUID(),
    signalId: randomUUID(),
    evidenceId,
    companyName,
    sector,
    city,
    eventType,
    headline,
    reportedFact: headline,
    canonicalUrl: canonical(url),
    publisher: SOURCES[0].name,
    sourceId: SOURCES[0].id,
    publishedAt,
    eventDate: null,
    firstSeenAt: stamp,
    lastSeenAt: stamp,
    sourceCount: 1,
    sourceClass: "trade",
    status: publishedAt ? "source_confirmed" : "stale",
    excerpt: clean(
      d.querySelector('meta[name="description"]')?.getAttribute("content") ||
        text,
    ).slice(0, 320),
    contentHash: digest(text),
    whyNow: publishedAt
      ? `Annonce publiée le ${publishedAt.slice(0, 10)}. Examiner son calendrier et la présence d’une équipe créative avant toute approche.`
      : "Chronologie à vérifier avant qualification.",
    potentialNeed:
      "Hypothèse : documenter le lancement ou l’activation avec un contenu photo/film. Aucun mandat ni budget confirmé.",
    services: [
      "photographie éditoriale",
      "direction artistique",
      "production film de marque",
    ],
    creativeAngle:
      "Préparer une lecture visuelle à partir du projet annoncé, puis vérifier sa pertinence avec un interlocuteur autorisé.",
    knownUnknowns: [
      "Date exacte du fait",
      "Besoin et calendrier d’achat",
      "Budget",
      "Prestataires en place",
      "Décisionnaire",
      "Relation existante à confirmer",
      ...(city ? [] : ["Zone géographique à vérifier"]),
    ],
    ...scoreFactors(factors),
    factors,
    confidence: "low",
    budgetMinEur: null,
    budgetMaxEur: null,
    reviewState: "new",
    stage: "discovered",
    projectId: null,
    updatedAt: stamp,
  };
}

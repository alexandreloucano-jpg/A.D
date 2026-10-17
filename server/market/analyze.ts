import { parseHTML } from "linkedom";
import { randomUUID } from "node:crypto";
import { digest } from "../store.js";
import { qualifyFinding } from "../../src/scout-market/qualification.js";
import type { Finding } from "../../src/scout-market/schema.js";
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
  const source = SOURCES.find((s) => s.domain === new URL(url).hostname);
  if (!source) return null;
  const { document: d } = parseHTML(html);
  const headline = clean(
    d.querySelector("h1")?.textContent ||
      d.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      "",
  );
  const article =
    d.querySelector(".article-content") ||
    d.querySelector(".entry-content") ||
    d.querySelector(".article-body") ||
    d.querySelector('[itemprop="articleBody"]') ||
    d.querySelector("article") ||
    d.querySelector("main");
  if (!article || !headline) return null;
  // Structured brand entities only; publisher and author are never treated as prospects.
  const entities: any[] = [];
  for (const node of d.querySelectorAll('script[type="application/ld+json"]'))
    try {
      const value = JSON.parse(node.textContent || "{}");
      entities.push(
        ...(Array.isArray(value) ? value : value["@graph"] || [value]),
      );
    } catch {
      /* malformed publisher metadata is not evidence */
    }
  article
    .querySelectorAll("script,style,nav,form,footer,aside")
    .forEach((n) => n.remove());
  const text = clean(article.textContent || "");
  const rawDate =
    d.querySelector("time[datetime]")?.getAttribute("datetime") ||
    d
      .querySelector('meta[property="article:published_time"]')
      ?.getAttribute("content") ||
    entities.find((x) => x.datePublished)?.datePublished;
  const date = rawDate ? new Date(rawDate) : null;
  const publishedAt =
    date && !isNaN(+date) && +date <= +now + 86400000
      ? date.toISOString()
      : null;

  const about = entities
    .flatMap((x) => (Array.isArray(x.about) ? x.about : [x.about]))
    .find(
      (x) =>
        x &&
        ["Brand", "Organization", "Hotel", "Restaurant"].includes(x["@type"]) &&
        typeof x.name === "string" &&
        headline
          .toLocaleLowerCase("fr")
          .includes(x.name.toLocaleLowerCase("fr")),
    );
  const lead =
    /^(?:La marque |Le groupe |La maison |L’hôtel |L'hôtel |Le restaurant |La startup |La start-up )?(.{2,70}?)\s+(?:lève|leve|annonce|recrute|prépare|prepare|ouvrira|ouvre|va ouvrir|se lance|lance|dévoile|devoile|présente|presente|s’installe|s'installe|accélère|accelere|s’étend|s'etend|étend|etend|inaugure|réinvente|reinvente|rénove|renove|change|nomme|signe|développe|developpe)\b/i.exec(
      headline,
    )?.[1];
  const colon = /^([\p{Lu}\d][\p{L}\p{N} ’'&.\-]{1,55})\s*[:：]/u.exec(
    headline,
  )?.[1];
  const comma =
    /^([\p{Lu}\d][\p{L}\p{N} ’'&.\-]{1,55}),\s+(?:le|la|un|une|nouveau|nouvelle)/u.exec(
      headline,
    )?.[1];
  let companyName = clean(
    about?.name || lead?.split("…").at(-1) || colon || comma || "",
  );
  const marketSignal =
    !companyName &&
    /nouveaux? (mod[eè]les?|concepts?|comportements?)|business model|nouvelle cat[eé]gorie|consommation|tendances? (food|beaut[eé]|retail)|abonnement/i.test(
      headline,
    );
  if (
    marketSignal ||
    /^(Europe|Deeptech|Live shopping|Paris Fashion Week|Défaillances|Lever des fonds)/i.test(
      companyName,
    ) ||
    companyName.split(/\s+/).length > 7
  )
    companyName = "Signal de marché";
  if (
    !companyName ||
    /^(comment|pourquoi|les |des |nouveau |nouvelle |paris$|ouverture|le luxe|la mode|le marche)/i.test(
      companyName,
    )
  )
    return null;
  const stamp = now.toISOString();
  const eventMatch =
    /(?:ouvrira|ouverture|inauguration|jusqu[’']au|se termine le)[^.!?]{0,70}?(\d{1,2})(?:er)? (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) (20\d{2})/i.exec(
      text,
    );
  const months = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];
  const eventDate = eventMatch
    ? new Date(
        Date.UTC(
          Number(eventMatch[3]),
          months.indexOf(eventMatch[2].toLowerCase()),
          Number(eventMatch[1]),
        ),
      ).toISOString()
    : null;
  if (
    publishedAt &&
    +now - Date.parse(publishedAt) > 45 * 86400000 &&
    !(
      eventDate &&
      Date.parse(eventDate) >= +now - 14 * 86400000 &&
      Date.parse(eventDate) <= +now + 365 * 86400000
    )
  )
    return null;
  const f: Finding = {
    id: randomUUID(),
    companyId: randomUUID(),
    signalId: randomUUID(),
    evidenceId: randomUUID(),
    companyName,
    entityType:
      companyName === "Signal de marché" ? "market_signal" : "company",
    sector: /hotel|restaurant|hospitality|palace|immobilier|club privé/i.test(
      headline + " " + text,
    )
      ? "hospitality et immobilier premium"
      : /beauté|cosmé|parfum|beauty/i.test(headline + " " + text)
        ? "beauté et parfumerie"
        : /mode|fashion|couture|vêtement|joaill/i.test(headline + " " + text)
          ? "mode et luxe"
          : /aliment|nutrition|boisson|food|wellness/i.test(
                headline + " " + text,
              )
            ? "consumer et lifestyle"
            : "secteur à qualifier",
    city: /\bparis\b|\b750\d\d\b/i.test(headline + " " + text) ? "Paris" : null,
    eventType: "other_verified_event",
    headline,
    reportedFact: headline,
    canonicalUrl: canonical(url),
    publisher: source.name,
    sourceId: source.id,
    publishedAt,
    eventDate,
    firstSeenAt: stamp,
    lastSeenAt: stamp,
    sourceCount: 1,
    sourceClass: source.sourceClass,
    status: publishedAt ? "source_confirmed" : "stale",
    excerpt: clean(
      d.querySelector('meta[name="description"]')?.getAttribute("content") ||
        text,
    ).slice(0, 320),
    analysisText: text.slice(0, 1000),
    contentHash: digest(text),
    whyNow: "Chronologie à qualifier.",
    potentialNeed: "Besoin non confirmé.",
    services: [],
    creativeAngle:
      "Évaluer le projet annoncé et vérifier les prestataires déjà mandatés.",
    knownUnknowns: [
      "Date exacte du fait",
      "Besoin et calendrier d’achat",
      "Budget",
      "Prestataires en place",
      "Décisionnaire",
      "Relation existante à confirmer",
    ],
    score: null,
    coverage: 0,
    factors: {},
    confidence: "low",
    budgetMinEur: null,
    budgetMaxEur: null,
    reviewState: "new",
    stage: "discovered",
    projectId: null,
    updatedAt: stamp,
  };
  return qualifyFinding(f, now);
}

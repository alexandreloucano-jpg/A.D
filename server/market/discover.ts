import { parseHTML } from "linkedom";
import type { SourceEntry } from "./sources.js";
import { robotsAllows } from "./fetch.js";
import { canonical } from "./analyze.js";
export const DISCOVERY_VERSION = "paris-solo-da-opportunity-v3";
export function discoverUrls(
  html: string,
  source: SourceEntry,
  robots: string,
) {
  if (source.connector === "article")
    return robotsAllows(robots, new URL(source.url).pathname)
      ? [canonical(source.url)]
      : [];
  const { document } = parseHTML(html);
  document.querySelectorAll("header,footer,nav").forEach((n) => n.remove());
  // Place-first discovery: the source list remains permission-gated. A title
  // about an upcoming indie restaurant is more useful than global runway buzz.
  const headlinePriority = (caption: string) => {
    const t = caption.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    let score = 0;
    if (/restaurant|brasserie|bistrot|bar a vin|cocktail|nightlife|club prive|hotel|hotellerie|chef/.test(t)) score += 5;
    if (/paris|marais|pigalle|saint.germain|champs.elysees|montmartre|bastille|oberkampf/.test(t)) score += 3;
    if (/ouvrira|ouverture|s.installe|nouvelle adresse|nouveau lieu|nouvelle table|renovation|reprise|nouveaux associes/.test(t)) score += 5;
    if (/programmation|residence|chef|supper club|soiree|lancement|popup|pop.up/.test(t)) score += 2;
    if (/nouvelle marque|premiere boutique|jeune creat|designer emergent/.test(t)) score += 2;
    if (/defile|fashion week|campagne deja|record buzz|collection printemps|replay/.test(t)) score -= 7;
    return score;
  };
  const urls = [...document.querySelectorAll("a[href]")]
    .filter(
      (a) =>
        !source.focusPattern ||
        source.focusPattern.test(a.textContent + " " + a.getAttribute("href")),
    )
    .sort(
      (a, b) =>
        headlinePriority(b.textContent + " " + b.getAttribute("href")) -
        headlinePriority(a.textContent + " " + a.getAttribute("href")),
    )
    .flatMap((a) => {
      try {
        const u = new URL(a.getAttribute("href")!, source.url);
        return u.protocol === "https:" &&
          !u.username &&
          !u.password &&
          u.hostname === source.domain &&
          source.articlePattern.test(u.pathname) &&
          robotsAllows(robots, u.pathname)
          ? [canonical(u.href)]
          : [];
      } catch {
        return [];
      }
    });
  return [...new Set(urls)].slice(0, source.id === "do-it-paris" || source.id === "sortir-paris" ? 6 : 4);
}

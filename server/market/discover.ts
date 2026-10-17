import { parseHTML } from "linkedom";
import type { SourceEntry } from "./sources.js";
import { robotsAllows } from "./fetch.js";
import { canonical } from "./analyze.js";
export const DISCOVERY_VERSION = "creative-topics-v2.1";
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
  const relevant =
    /ouverture|ouvre|renov|levée|beauté|lancement|concept|marketing|brasserie|restaurant/i;
  const urls = [...document.querySelectorAll("a[href]")]
    .filter(
      (a) =>
        !source.focusPattern ||
        source.focusPattern.test(a.textContent + " " + a.getAttribute("href")),
    )
    .sort(
      (a, b) =>
        Number(relevant.test(b.textContent + " " + b.getAttribute("href"))) -
        Number(relevant.test(a.textContent + " " + a.getAttribute("href"))),
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
  return [...new Set(urls)].slice(0, 4);
}

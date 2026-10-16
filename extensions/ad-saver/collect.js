// Runs only after an explicit action on the active X tab. No fetch, cookies,
// authorization headers or private APIs. Reads only rendered post elements.
export async function collectRenderedPosts(walk) {
  if (
    !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(
      location.hostname,
    )
  )
    throw Error("Ouvrez un onglet X avant de capturer.");
  if (walk && !/^\/i\/bookmarks\/?$/.test(location.pathname))
    throw Error("Ouvrez la page Signets de X pour collecter la liste.");
  const found = new Map(),
    start = Date.now(),
    originalY = scrollY;
  let cancelled = false,
    stagnant = 0;
  const panel = document.createElement("aside");
  panel.setAttribute("role", "status");
  panel.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#202d38;color:#fff;padding:16px;border-radius:12px;font:14px system-ui;max-width:300px;box-shadow:0 8px 32px #0005";
  const label = document.createElement("span"),
    stop = document.createElement("button");
  stop.textContent = "Arrêter la collecte";
  stop.style.cssText =
    "display:block;margin-top:10px;min-height:44px;padding:8px;border:1px solid #fff;border-radius:6px;color:#fff;background:transparent";
  stop.addEventListener("click", () => {
    cancelled = true;
  });
  panel.append(label, stop);
  document.body.append(panel);
  try {
    for (
      let step = 0;
      step < (walk ? 80 : 1) &&
      !cancelled &&
      found.size < 500 &&
      Date.now() - start < 65000;
      step++
    ) {
      const before = found.size;
      for (const article of document.querySelectorAll(
        'article[data-testid="tweet"]',
      )) {
        const timestamp = article.querySelector("time"),
          anchor = timestamp?.closest("a[href]");
        if (!anchor) continue;
        const url = new URL(anchor.getAttribute("href"), location.origin),
          match = url.pathname.match(/^\/[\w]+\/status\/(\d+)/);
        if (!match) continue;
        const canonical = "https://x.com/i/web/status/" + match[1],
          text = (
            article.querySelector('[data-testid="tweetText"]')?.textContent ||
            ""
          )
            .trim()
            .slice(0, 10000);
        const images = [
          ...article.querySelectorAll('[data-testid="tweetPhoto"] img'),
        ]
          .map((i) => i.currentSrc || i.src)
          .filter((v) => {
            try {
              const u = new URL(v);
              return u.protocol === "https:" && u.hostname === "pbs.twimg.com";
            } catch {
              return false;
            }
          })
          .slice(0, 8);
        const datetime = timestamp?.getAttribute("datetime");
        const publishedAt =
          datetime && !Number.isNaN(Date.parse(datetime))
            ? new Date(datetime).toISOString()
            : undefined;
        // No invented text/media when the post is unavailable or only a video blob.
        if (!text && !images.length) continue;
        found.set(canonical, {
          url: canonical,
          title: text.slice(0, 100) || "Publication X",
          text,
          images,
          tags: [],
          ...(publishedAt ? { publishedAt } : {}),
        });
        if (found.size >= 500) break;
      }
      label.textContent = `A.D Saver · ${found.size} publication(s) collectée(s). Rien n’est encore enregistré dans Saver.`;
      if (!walk) break;
      stagnant = found.size === before ? stagnant + 1 : 0;
      if (stagnant >= 8) break;
      window.scrollBy({
        top: Math.max(innerHeight * 0.8, 500),
        behavior: "instant",
      });
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    return {
      items: [...found.values()],
      limited: found.size >= 500 || Date.now() - start >= 65000,
      cancelled,
    };
  } finally {
    panel.remove();
    if (!walk) window.scrollTo({ top: originalY, behavior: "instant" });
  }
}

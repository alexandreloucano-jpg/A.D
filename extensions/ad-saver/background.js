import { fetchMedia } from "./media.js";
import "./xarchive/background.js";
import { collectRenderedPosts } from "./collect.js";
const ORIGIN = "https://ad-saver-reader-beta-alexandreloucano-3399.vercel.app";
const TTL = 24 * 60 * 60 * 1000;
let running = false;
async function prune() {
  const all = await chrome.storage.local.get(null);
  for (const [key, value] of Object.entries(all))
    if (
      key.startsWith("capture:") &&
      (!value || Date.now() - value.createdAt > TTL)
    )
      await chrome.storage.local.remove(key);
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  void (async () => {
    if (message?.type === "PREPARE_X_ARCHIVE") {
      if (sender.url !== chrome.runtime.getURL("xarchive/options.html"))
        throw Error("Transfert réservé au collecteur A.D.");
      if (
        !Array.isArray(message.bookmarks) ||
        !message.bookmarks.length ||
        message.bookmarks.length > 2000 ||
        !/^\d+$/.test(message.archiveUser)
      )
        throw Error("Archive invalide.");
      const items = message.bookmarks.map((b) => {
        if (
          !/^\d+$/.test(b.tweet_id) ||
          (typeof b.full_text !== "string" && b.status !== "unavailable")
        )
          throw Error("Publication non reconnue.");
        const media = Array.isArray(b.media) ? b.media : [];
        const videos = media
          .filter((m) => ["video", "animated_gif"].includes(m.type))
          .flatMap((m) => {
            const variants = (m.variants || [])
              .filter(
                (v) =>
                  v.content_type === "video/mp4" && typeof v.url === "string",
              )
              .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
            return variants.length
              ? [
                  variants.find((v) => v.bitrate >= 256000)?.url ||
                    variants[0].url,
                ]
              : [];
          })
          .slice(0, 4);
        const quote = b.quoted_tweet;
        const context = quote?.full_text
          ? "\n\nPublication citée" +
            (/^\d+$/.test(quote.tweet_id || "")
              ? " https://x.com/i/web/status/" + quote.tweet_id
              : "") +
            "\n" +
            quote.full_text
          : "";
        const originalText = ((b.full_text || "") + context).slice(0, 200000);
        return {
          url: "https://x.com/i/web/status/" + b.tweet_id,
          title: originalText.slice(0, 100) || "Publication X indisponible",
          text: originalText.slice(0, 10000),
          originalText,
          ...(typeof b.author?.screen_name === "string"
            ? { author: b.author.screen_name.slice(0, 200) }
            : {}),
          images: media
            .map((m) => (m.type === "photo" ? m.url : m.thumbnail_url))
            .filter((v) => typeof v === "string")
            .slice(0, 8),
          videos,
          tags: Array.isArray(b.folders)
            ? b.folders.filter((v) => typeof v === "string").slice(0, 30)
            : [],
          notes: [],
          ...(b.created_at && !Number.isNaN(Date.parse(b.created_at))
            ? { publishedAt: new Date(b.created_at).toISOString() }
            : {}),
        };
      });
      const nonce = crypto.randomUUID(),
        key = "capture:" + nonce;
      const record = {
        createdAt: Date.now(),
        items,
        tabId: null,
        archiveUser: message.archiveUser,
        nextOffset: message.nextOffset,
        signature: message.signature,
      };
      await chrome.storage.local.set({ [key]: record });
      const target = await chrome.tabs.create({
        url: ORIGIN + "/#/saver?capture=" + nonce,
      });
      record.tabId = target.id;
      await chrome.storage.local.set({ [key]: record });
      return { prepared: items.length };
    }
    if (message?.type === "START_CAPTURE") {
      if (sender.tab || running) throw Error("Une collecte est déjà en cours.");
      running = true;
      try {
        await prune();
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (
          !tab?.id ||
          !/^https:\/\/(www\.)?(x|twitter)\.com\//.test(tab.url || "")
        )
          throw Error("Ouvrez X dans l’onglet actif.");
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: collectRenderedPosts,
          args: [message.walk === true],
        });
        const result = results[0]?.result;
        if (!result?.items?.length)
          throw Error(
            "Aucune publication lisible affichée. Ouvrez une publication ou vos signets X puis réessayez.",
          );
        const nonce = crypto.randomUUID(),
          key = "capture:" + nonce;
        await chrome.storage.local.set({
          [key]: { createdAt: Date.now(), items: result.items, tabId: null },
        });
        const target = await chrome.tabs.create({
          url: ORIGIN + "/#/saver?capture=" + nonce,
        });
        await chrome.storage.local.set({
          [key]: {
            createdAt: Date.now(),
            items: result.items,
            tabId: target.id,
          },
        });
        return {
          prepared: result.items.length,
          limited: result.limited,
          cancelled: result.cancelled,
        };
      } finally {
        running = false;
      }
    }
    if (
      ![
        "READ_CAPTURE",
        "CONFIRM_CAPTURE",
        "FETCH_MEDIA",
        "FETCH_PUBLIC_MEDIA",
      ].includes(message?.type) ||
      sender.frameId !== 0 ||
      sender.origin !== ORIGIN ||
      !sender.tab?.id ||
      !sender.url?.startsWith(ORIGIN + "/")
    )
      throw Error("Origine refusée.");
    if (message.type === "FETCH_PUBLIC_MEDIA")
      return await fetchMedia(message.url);
    if (!/^[a-f0-9-]{36}$/i.test(message.nonce || ""))
      throw Error("Capture invalide.");
    const key = "capture:" + message.nonce,
      record = (await chrome.storage.local.get(key))[key];
    if (
      !record ||
      record.tabId !== sender.tab.id ||
      Date.now() - record.createdAt > TTL
    )
      throw Error("Capture expirée ou réservée à un autre onglet.");
    if (message.type === "FETCH_MEDIA") {
      if (
        !record.items.some((item) =>
          [...(item.images || []), ...(item.videos || [])].includes(
            message.url,
          ),
        )
      )
        throw Error("Média absent de cette capture.");
      return await fetchMedia(message.url);
    }
    if (message.type === "CONFIRM_CAPTURE") {
      if (record.archiveUser) {
        if (!record.confirmed)
          await chrome.storage.local.set({
            ["ad-transfer-offset:" + record.archiveUser]: {
              offset: record.nextOffset,
              signature: record.signature,
            },
          });
        await chrome.storage.local.set({
          [key]: { ...record, confirmed: true },
        });
      } else await chrome.storage.local.remove(key);
      return { cleared: true };
    }
    if (record.confirmed) return { confirmed: true };
    return { items: record.items, nonce: message.nonce };
  })()
    .then((value) => respond({ ok: true, ...value }))
    .catch((e) =>
      respond({
        ok: false,
        error: e instanceof Error ? e.message : "Capture non confirmée.",
      }),
    );
  return true;
});

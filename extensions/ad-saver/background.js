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
      !["READ_CAPTURE", "CONFIRM_CAPTURE"].includes(message?.type) ||
      sender.frameId !== 0 ||
      sender.origin !== ORIGIN ||
      !sender.tab?.id ||
      !sender.url?.startsWith(ORIGIN + "/")
    )
      throw Error("Origine refusée.");
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
    if (message.type === "CONFIRM_CAPTURE") {
      await chrome.storage.local.remove(key);
      return { cleared: true };
    }
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

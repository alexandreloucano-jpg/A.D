import "./xarchive/lib/archive.js";
import { getSessionUserId } from "./xarchive/lib/identity.js";
import { assembleExport } from "./xarchive/lib/exporter.js";
const button = document.querySelector("#ad-transfer"),
  status = document.querySelector("#ad-transfer-status");
button.addEventListener("click", async () => {
  button.disabled = true;
  try {
    const user = await getSessionUserId();
    if (!user) throw Error("Ouvrez X et connectez-vous avant de relancer.");
    const record = await new XArchive.ArchiveStore().get("user:" + user);
    const data =
      record?.data ||
      (await assembleExport({
        userId: user,
        screenName: null,
        durationSeconds: 0,
      }));
    if (data.export_metadata?.user_id !== user)
      throw Error(
        "Le compte de l’archive ne correspond pas au compte X ouvert.",
      );
    const cursorKey = "ad-transfer-offset:" + user,
      saved = await chrome.storage.local.get(cursorKey);
    // A new archive revision starts from zero; A.D deduplicates previously saved URLs.
    const signature = String(
      record?.revision || data.export_metadata?.exported_at || "snapshot",
    );
    const offset =
      saved[cursorKey]?.signature === signature ? saved[cursorKey].offset : 0;
    const bookmarks = data.bookmarks.slice(offset, offset + 2000);
    if (!bookmarks.length)
      throw Error(
        "Tous les lots ont été confirmés dans Saver. Relancez une collecte pour les nouveaux signets.",
      );
    const reply = await chrome.runtime.sendMessage({
      type: "PREPARE_X_ARCHIVE",
      bookmarks,
      archiveUser: user,
      nextOffset: offset + bookmarks.length,
      signature,
    });
    if (!reply?.ok) throw Error(reply?.error || "Transfert non confirmé.");
    status.textContent = `${bookmarks.length} signet(s) préparé(s) dans Saver. Confirmez leur enregistrement là-bas. ${Math.max(0, data.bookmarks.length - offset - bookmarks.length)} restant(s) pour le prochain lot. L’archive originale reste conservée ici.`;
  } catch (e) {
    status.textContent = e.message;
  } finally {
    button.disabled = false;
  }
});

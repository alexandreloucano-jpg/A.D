import { normalizeIntake, type IntakeItem } from "./model";
export type ArchivedMedia = {
  url: string;
  state: "pending" | "saved" | "error";
  error?: string;
  bytes?: number;
};
export type LocalCopy = {
  id: string;
  item: IntakeItem;
  nonce?: string;
  media: ArchivedMedia[];
  savedAt: string;
};
const NAME = "ad-saver-content-v1";
let opening: Promise<IDBDatabase> | undefined;
function db() {
  return (opening ||= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded = () => {
      for (const name of ["copies", "assets", "versions"])
        r.result.createObjectStore(name);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => {
      opening = undefined;
      reject(Error("Le stockage local des contenus est indisponible."));
    };
  }));
}
async function read<T>(store: string, key: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction(store).objectStore(store).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function write(store: string, key: string, value: unknown) {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const t = d.transaction(store, "readwrite");
    t.objectStore(store).put(value, key);
    t.oncomplete = () => resolve();
    t.onerror = () =>
      reject(
        Error(
          "Le contenu local n’a pas été enregistré. Vérifiez l’espace disponible.",
        ),
      );
    t.onabort = () => reject(Error("Écriture locale interrompue."));
  });
}
export const readLocalCopy = (id: string) => read<LocalCopy>("copies", id);
export const readLocalAsset = (url: string) =>
  read<{ blob: Blob; sha256: string }>("assets", url);
function changed(id: string) {
  window.dispatchEvent(new CustomEvent("ad-local-archive", { detail: id }));
}
export async function saveLocalCopies(
  items: IntakeItem[],
  ids: string[],
  nonce?: string,
) {
  if (items.length !== ids.length)
    throw Error("Les UUID du lot ne correspondent pas aux contenus.");
  for (let i = 0; i < items.length; i++) {
    const item = normalizeIntake(items[i]),
      id = ids[i];
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw Error("UUID non valide.");
    const old = await readLocalCopy(id),
      savedAt = new Date().toISOString();
    if (old && JSON.stringify(old.item) !== JSON.stringify(item))
      await write(
        "versions",
        id + ":" + old.savedAt + ":" + crypto.randomUUID(),
        old,
      );
    const media = [] as ArchivedMedia[];
    for (const url of [...new Set([...item.images, ...item.videos])]) {
      const asset = await readLocalAsset(url);
      media.push({
        url,
        state: asset ? "saved" : "pending",
        ...(asset ? { bytes: asset.blob.size } : {}),
      });
    }
    const copy: LocalCopy = {
      id,
      item,
      media,
      savedAt,
      nonce: nonce || old?.nonce,
    };
    await write("copies", id, copy);
    const verified = await readLocalCopy(id);
    if (verified?.savedAt !== savedAt)
      throw Error("Relecture locale non confirmée.");
    changed(id);
  }
}
function fromExtension(url: string, nonce: string): Promise<{ blob: Blob }> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID(),
      timer = window.setTimeout(
        () =>
          finish(
            Error(
              "Extension absente ou média trop lent. Rouvrez la capture avec l’extension A.D.",
            ),
          ),
        70000,
      );
    function finish(error?: Error, value?: { blob: Blob }) {
      clearTimeout(timer);
      window.removeEventListener("message", receive);
      if (error) reject(error);
      else resolve(value!);
    }
    function receive(e: MessageEvent) {
      if (
        e.source !== window ||
        e.origin !== location.origin ||
        e.data?.type !== "AD_SAVER_MEDIA_RESULT" ||
        e.data.id !== id ||
        e.data.nonce !== nonce
      )
        return;
      try {
        if (e.data.error) throw Error(String(e.data.error));
        if (
          ![
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "video/mp4",
          ].includes(e.data.mime) ||
          typeof e.data.base64 !== "string" ||
          e.data.base64.length > 34 * 1024 * 1024
        )
          throw Error("Réponse média invalide.");
        const raw = atob(e.data.base64),
          bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        finish(undefined, { blob: new Blob([bytes], { type: e.data.mime }) });
      } catch (err) {
        finish(err instanceof Error ? err : Error("Média invalide."));
      }
    }
    window.addEventListener("message", receive);
    window.postMessage(
      { type: "AD_SAVER_MEDIA_REQUEST", id, nonce, url },
      location.origin,
    );
  });
}
let downloading = false;
const queue = new Set<string>();
export async function downloadLocalMedia(ids: string[]) {
  for (const id of ids) queue.add(id);
  if (downloading) return;
  downloading = true;
  try {
    while (queue.size) {
      const id = queue.values().next().value!;
      queue.delete(id);
      const copy = await readLocalCopy(id);
      if (!copy) continue;
      for (const media of copy.media) {
        if (media.state === "saved") continue;
        try {
          if (!copy.nonce)
            throw Error(
              "Lien conservé ; fichier à récupérer depuis l’extension X.",
            );
          const { blob } = await fromExtension(media.url, copy.nonce),
            hash = await crypto.subtle.digest(
              "SHA-256",
              await blob.arrayBuffer(),
            );
          await write("assets", media.url, {
            blob,
            sha256: Array.from(new Uint8Array(hash), (b) =>
              b.toString(16).padStart(2, "0"),
            ).join(""),
          });
          const verified = await readLocalAsset(media.url);
          if (verified?.blob.size !== blob.size)
            throw Error("Relecture du fichier non confirmée.");
          media.state = "saved";
          media.bytes = blob.size;
          delete media.error;
        } catch (e) {
          media.state = "error";
          media.error =
            e instanceof Error ? e.message : "Téléchargement non confirmé.";
        }
        const latest = await readLocalCopy(id);
        if (latest) {
          latest.media = latest.media.map((m) =>
            m.url === media.url ? { ...media } : m,
          );
          await write("copies", id, latest);
        }
        changed(id);
      }
    }
  } finally {
    downloading = false;
  }
}
const LOCAL_ONLY = "ad.saver.local-only.v1";
export function localOnlyIds(): Set<string> {
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_ONLY) || "[]");
    if (!Array.isArray(list)) throw Error("invalid");
    return new Set(
      Array.isArray(list)
        ? list.filter(
            (v) => typeof v === "string" && /^[a-f0-9-]{36}$/i.test(v),
          )
        : [],
    );
  } catch {
    throw Error(
      "Les préférences de stockage local sont illisibles. Aucun transfert cloud autorisé.",
    );
  }
}
export function setLocalOnly(ids: string[], local: boolean) {
  const set = localOnlyIds();
  for (const id of ids) local ? set.add(id) : set.delete(id);
  localStorage.setItem(LOCAL_ONLY, JSON.stringify([...set]));
  if (localOnlyIds().size !== set.size)
    throw Error("Le choix local n’a pas été confirmé.");
}
export async function searchLocalCopies(q: string) {
  const d = await db();
  const rows = await new Promise<LocalCopy[]>((resolve, reject) => {
    const r = d.transaction("copies").objectStore("copies").getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const needle = q.toLocaleLowerCase();
  return rows
    .filter((r) =>
      [r.item.originalText || r.item.text, ...r.item.notes, ...r.item.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle),
    )
    .map((r) => r.id);
}

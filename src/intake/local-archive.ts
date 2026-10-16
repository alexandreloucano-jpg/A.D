import { fetchPublicMedia, MediaSourceError } from "./public-media";
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
    let blocked = false;
    r.onblocked = () => {
      blocked = true;
      opening = undefined;
      reject(
        Error(
          "Un autre onglet bloque le stockage local. Fermez les autres onglets A.D puis reprenez le lot conservé.",
        ),
      );
    };
    r.onupgradeneeded = () => {
      for (const name of ["copies", "assets", "versions"])
        r.result.createObjectStore(name);
    };
    r.onsuccess = () => {
      if (blocked) r.result.close();
      else resolve(r.result);
    };
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
async function readMany<T>(
  store: string,
  keys: string[],
): Promise<(T | undefined)[]> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store),
      values: (T | undefined)[] = new Array(keys.length);
    keys.forEach((key, i) => {
      const r = t.objectStore(store).get(key);
      r.onsuccess = () => {
        values[i] = r.result;
      };
    });
    t.oncomplete = () => resolve(values);
    t.onerror = () =>
      reject(Error("Lecture locale interrompue. Le lot reste disponible."));
    t.onabort = t.onerror;
  });
}
export async function saveLocalCopies(
  items: IntakeItem[],
  ids: string[],
  nonce?: string,
  onProgress?: (done: number, total: number) => void,
) {
  if (items.length !== ids.length)
    throw Error("Les UUID du lot ne correspondent pas aux contenus.");
  const d = await db();
  onProgress?.(0, items.length);
  for (let start = 0; start < items.length; start += 50) {
    const chunk = items.slice(start, start + 50).map(normalizeIntake),
      keys = ids.slice(start, start + 50);
    if (keys.some((id) => !/^[a-f0-9-]{36}$/i.test(id)))
      throw Error("UUID non valide.");
    const old = await readMany<LocalCopy>("copies", keys),
      urls = [
        ...new Set(chunk.flatMap((item) => [...item.images, ...item.videos])),
      ];
    const cached = await readMany<{ blob: Blob }>("assets", urls),
      assets = new Map(urls.map((url, i) => [url, cached[i]]));
    const copies = chunk.map((item, i): LocalCopy => ({
      id: keys[i],
      item,
      nonce: nonce || old[i]?.nonce,
      savedAt: new Date().toISOString(),
      media: [...new Set([...item.images, ...item.videos])].map((url) => {
        const asset = assets.get(url);
        return {
          url,
          state: asset ? "saved" : "pending",
          ...(asset ? { bytes: asset.blob.size } : {}),
        };
      }),
    }));
    await new Promise<void>((resolve, reject) => {
      const t = d.transaction(["copies", "versions"], "readwrite");
      copies.forEach((copy, i) => {
        if (
          old[i] &&
          JSON.stringify(old[i]!.item) !== JSON.stringify(copy.item)
        )
          t.objectStore("versions").put(
            old[i],
            keys[i] + ":" + old[i]!.savedAt + ":" + crypto.randomUUID(),
          );
        t.objectStore("copies").put(copy, keys[i]);
      });
      t.oncomplete = () => resolve();
      t.onerror = () =>
        reject(
          Error(
            "Stockage local insuffisant ou indisponible. Les lots déjà conservés restent intacts.",
          ),
        );
      t.onabort = t.onerror;
    });
    const verified = await readMany<LocalCopy>("copies", keys);
    if (
      copies.some(
        (copy, i) =>
          verified[i]?.savedAt !== copy.savedAt ||
          JSON.stringify(verified[i]?.item) !== JSON.stringify(copy.item),
      )
    )
      throw Error("Relecture du contenu local non confirmée. Reprenez ce lot.");
    keys.forEach(changed);
    onProgress?.(start + chunk.length, items.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
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
        20000,
      );
    function finish(error?: Error, value?: { blob: Blob }) {
      clearTimeout(timer);
      window.removeEventListener("message", receive);
      if (error) reject(error);
      else resolve(value!);
    }
    let processing = false;
    async function receive(e: MessageEvent) {
      if (
        e.source !== window ||
        e.origin !== location.origin ||
        e.data?.type !== "AD_SAVER_MEDIA_RESULT" ||
        e.data.id !== id ||
        e.data.nonce !== nonce
      )
        return;
      if (processing) return;
      processing = true;
      try {
        if (e.data.error)
          throw Error(
            "Le fichier reste indisponible. La reprise globale continue avec les autres médias.",
          );
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
export type MediaProgress = {
  running: boolean;
  total: number;
  done: number;
  saved: number;
  failed: number;
  references: number;
};
let progress: MediaProgress = {
  running: false,
  total: 0,
  done: 0,
  saved: 0,
  failed: 0,
  references: 0,
};
export const getMediaProgress = () => ({ ...progress });
let reportTimer: ReturnType<typeof setTimeout> | undefined;
function emitProgress() {
  window.dispatchEvent(
    new CustomEvent("ad-media-progress", { detail: getMediaProgress() }),
  );
}
function report() {
  if (!progress.running) {
    clearTimeout(reportTimer);
    reportTimer = undefined;
    emitProgress();
  } else if (!reportTimer)
    reportTimer = setTimeout(() => {
      reportTimer = undefined;
      emitProgress();
    }, 250);
}
const queue = new Set<string>(),
  activeIds = new Set<string>();
let job: Promise<void> | undefined;
async function mediaBlob(url: string, nonce?: string): Promise<Blob> {
  const cached = await readLocalAsset(url);
  if (cached) return cached.blob;
  try {
    return await fetchPublicMedia(url);
  } catch (error) {
    if (error instanceof MediaSourceError) throw error;
    return (await fromExtension(url, nonce || crypto.randomUUID())).blob;
  }
}
export const readLocalCopies = (ids: string[]) =>
  readMany<LocalCopy>("copies", ids);
export async function ensureLocalAsset(id: string, url: string) {
  const copy = await readLocalCopy(id);
  if (!copy || !copy.media.some((m) => m.url === url))
    throw Error("Média absent de cette capture.");
  const cached = await readLocalAsset(url);
  if (cached) return cached;
  const blob = await mediaBlob(url, copy.nonce);
  const sha256 = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  await write("assets", url, { blob, sha256 });
  const readback = await readLocalAsset(url);
  if (readback?.blob.size !== blob.size || readback.sha256 !== sha256)
    throw Error("Copie locale non confirmée.");
  const latest = await readLocalCopy(id);
  if (latest) {
    latest.media = latest.media.map((m) =>
      m.url === url ? { url, state: "saved", bytes: blob.size } : m,
    );
    await write("copies", id, latest);
    changed(id);
  }
  return readback;
}
export function downloadLocalMedia(ids: string[]): Promise<void> {
  ids.forEach((id) => {
    if (!activeIds.has(id)) queue.add(id);
  });
  if (job) return job;
  if (!queue.size) return Promise.resolve();
  progress = {
    running: true,
    total: 0,
    done: 0,
    saved: 0,
    failed: 0,
    references: 0,
  };
  report();
  job = (async () => {
    try {
      while (queue.size) {
        const keys = [...queue];
        queue.clear();
        keys.forEach((id) => activeIds.add(id));
        const copies = (await readMany<LocalCopy>("copies", keys)).filter(
          (c): c is LocalCopy => !!c,
        );
        progress.total += copies.reduce(
          (n, c) => n + c.media.filter((m) => m.state !== "saved").length,
          0,
        );
        report();
        let cursor = 0;
        await Promise.all(
          Array.from({ length: 4 }, async () => {
            while (cursor < copies.length) {
              const copy = copies[cursor++];
              for (const media of copy.media) {
                if (media.state === "saved") continue;
                try {
                  const blob = await mediaBlob(media.url, copy.nonce),
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
                  progress.saved++;
                } catch (e) {
                  media.state = "error";
                  media.error =
                    e instanceof Error ? e.message : "Fichier non confirmé.";
                  progress.failed++;
                }
                const latest = await readLocalCopy(copy.id);
                if (latest) {
                  latest.media = latest.media.map((m) =>
                    m.url === media.url ? { ...media } : m,
                  );
                  await write("copies", copy.id, latest);
                }
                progress.done++;
                changed(copy.id);
                report();
              }
              progress.references++;
              activeIds.delete(copy.id);
            }
          }),
        );
        keys.forEach((id) => activeIds.delete(id));
      }
    } finally {
      progress.running = false;
      activeIds.clear();
      job = undefined;
      report();
    }
  })();
  return job;
}
export async function resumeInterruptedMedia(ids: string[]) {
  const copies = await readMany<LocalCopy>("copies", ids);
  const pending = copies
    .filter(
      (c): c is LocalCopy =>
        !!c &&
        c.media.some(
          (m) =>
            m.state === "pending" ||
            (m.state === "error" &&
              /capture expir|autre onglet/i.test(m.error || "")),
        ),
    )
    .map((c) => c.id);
  if (pending.length) await downloadLocalMedia(pending);
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

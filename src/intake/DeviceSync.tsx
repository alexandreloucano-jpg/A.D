import { COLLECTIONS_KEY, collectionsSchema } from "../collections/model";
import { useState } from "react";
import type { Reference } from "../domain";
import type { RemoteSaver } from "../remote-saver";
import { localOnlyIds, readLocalCopy, setLocalOnly } from "./local-archive";
import { publicImage, type IntakeItem } from "./model";
export async function syncDeviceReferences(
  rows: Reference[],
  remote: Pick<
    RemoteSaver,
    "connected" | "migrate" | "reader" | "refresh" | "references"
  >,
  progress: (done: number, total: number) => void,
) {
  if (!remote.connected)
    throw Error(
      "Connectez-vous à A.D sur cet appareil avant la synchronisation.",
    );
  const candidates = rows.filter((r) => !r.isInternalQA);
  let done = 0;
  progress(0, candidates.length);
  for (let start = 0; start < candidates.length; start += 20) {
    const batch = candidates.slice(start, start + 20);
    await remote.migrate(batch);
    const items: IntakeItem[] = [];
    const ids = new Map<string, string>();
    for (const ref of batch) {
      const copy = await readLocalCopy(ref.id);
      if (copy) {
        items.push(copy.item);
        ids.set(copy.item.url, ref.id);
      }
    }
    while (items.length) {
      const chunk: IntakeItem[] = [];
      while (items.length && chunk.length < 20) {
        if (
          chunk.length &&
          new TextEncoder().encode(
            JSON.stringify({ method: "file", items: [...chunk, items[0]] }),
          ).length > 300000
        )
          break;
        chunk.push(items.shift()!);
      }
      const receipt = await remote.reader<{
        results: {
          url: string;
          id?: string;
          verified: boolean;
          sourceTextVerified?: boolean;
        }[];
      }>("/api/intake", "POST", { method: "file", items: chunk });
      if (
        receipt.results.length !== chunk.length ||
        chunk.some(
          (item) =>
            !receipt.results.some(
              (r) =>
                r.url === item.url &&
                r.verified &&
                r.sourceTextVerified === true &&
                r.id === ids.get(item.url),
            ),
        )
      )
        throw Error(
          "Copie partielle : les originaux restent sur cet appareil. Réessayez pour poursuivre sans changer les UUID.",
        );
    }
    setLocalOnly(
      batch.map((r) => r.id),
      false,
    );
    done += batch.length;
    progress(done, candidates.length);
  }
  const localGroupsRaw = localStorage.getItem(COLLECTIONS_KEY);
  if (localGroupsRaw) {
    const localGroups = collectionsSchema.parse(JSON.parse(localGroupsRaw));
    const current = collectionsSchema.parse(
      (await remote.reader<{ collections: unknown }>("/api/collections"))
        .collections,
    );
    const known = new Set(
      [...remote.references, ...candidates].map((r) => r.id),
    );
    const additions = localGroups.groups.filter(
      (g) => !current.groups.some((existing) => existing.id === g.id),
    );
    if (additions.some((g) => g.referenceIds.some((id) => !known.has(id))))
      throw Error(
        "Références copiées ; certains groupes contiennent des références non synchronisées. Les groupes locaux restent intacts.",
      );
    if (additions.length) {
      const saved = await remote.reader<{
        collections: unknown;
        verified: boolean;
      }>("/api/collections", "PUT", {
        ...current,
        groups: [...current.groups, ...additions],
      });
      const verified = collectionsSchema.parse(saved.collections);
      if (
        !saved.verified ||
        additions.some(
          (g) =>
            !verified.groups.some(
              (x) => JSON.stringify(x) === JSON.stringify(g),
            ),
        )
      )
        throw Error(
          "Copie des groupes non confirmée. Les originaux locaux restent conservés.",
        );
    }
  }
  await remote.refresh();
}
export function DeviceSync({
  rows,
  remote,
  serverIds,
  onSynced,
}: {
  rows: Reference[];
  remote: RemoteSaver;
  serverIds: Set<string>;
  onSynced?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [groupsCopied, setGroupsCopied] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  let local: Set<string>;
  try {
    local = localOnlyIds();
  } catch {
    local = new Set(rows.map((r) => r.id));
  }
  let hasLocalGroups = false;
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    hasLocalGroups =
      !!raw && collectionsSchema.parse(JSON.parse(raw)).groups.length > 0;
  } catch {
    hasLocalGroups = true;
  }
  const pending = rows.filter(
    (r) => !r.isInternalQA && (local.has(r.id) || !serverIds.has(r.id)),
  );
  const needsCopy = pending.length > 0 || (hasLocalGroups && !groupsCopied);
  return (
    <section
      aria-label="Disponibilité sur vos appareils"
      className="saver-device-sync"
    >
      <p>
        {pending.length
          ? `${pending.length} référence(s) sont encore réservées à cet appareil ou non confirmées sur le serveur.`
          : remote.connected
            ? "Références serveur accessibles avec le même compte A.D sur iPhone."
            : "Connectez-vous au même compte A.D pour retrouver les références synchronisées."}
      </p>
      {needsCopy && (
        <>
          <p>
            Pour les retrouver sur iPhone, lancez cette copie depuis
            l’ordinateur qui contient vos signets. Les originaux restent
            conservés.
          </p>
          {remote.connected ? (
            <button
              disabled={busy || remote.busy}
              onClick={() => {
                setBusy(true);
                setError("");
                void syncDeviceReferences(pending, remote, (done, total) =>
                  setMessage(`Synchronisation vérifiée : ${done}/${total}`),
                )
                  .then(() => {
                    setGroupsCopied(true);
                    onSynced?.();
                    setMessage(
                      "Texte, références et liens des médias synchronisés et relus. Actualisez Saver sur iPhone.",
                    );
                  })
                  .catch((e) =>
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Synchronisation interrompue.",
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              {busy
                ? "Synchronisation en cours…"
                : "Retrouver mes références sur iPhone"}
            </button>
          ) : (
            <a className="text-button" href="/api/auth/google/login">
              Se connecter avec Google
            </a>
          )}
          <p>
            Les fichiers image/vidéo archivés uniquement dans ce navigateur ne
            sont pas téléversés ; leurs liens source sont conservés.
          </p>
        </>
      )}
      {!remote.connected && !needsCopy && (
        <a className="text-button" href="/api/auth/google/login">
          Se connecter avec Google
        </a>
      )}
      {remote.error && <p role="alert">{remote.error}</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function SyncedContent({
  id,
  remote,
}: {
  id: string;
  remote: RemoteSaver;
}) {
  const [text, setText] = useState(""),
    [videos, setVideos] = useState<string[]>([]),
    [images, setImages] = useState<string[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  return (
    <details
      onToggle={(e) => {
        if (!e.currentTarget.open || loaded) return;
        setLoaded(true);
        void remote
          .reader<{
            sources: {
              sourceText?: string;
              videos?: string[];
              images?: string[];
            }[];
          }>("/api/intake?content=1&ids=" + encodeURIComponent(id))
          .then((r) => {
            setText(
              r.sources[0]?.sourceText ||
                "Aucun texte source supplémentaire synchronisé.",
            );
            setVideos((r.sources[0]?.videos || []).filter(publicImage));
            setImages((r.sources[0]?.images || []).filter(publicImage));
            setError("");
          })
          .catch(() => {
            setError(
              "Lecture interrompue : fermez puis rouvrez pour réessayer.",
            );
            setLoaded(false);
          });
      }}
    >
      <summary>Texte et vidéos synchronisés</summary>
      {error && <p role="alert">{error}</p>}
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {text || "Lecture du contenu privé…"}
      </p>
      {images.map((url, index) => (
        <img
          key={url}
          src={url}
          alt={"Image source " + (index + 1)}
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{ maxWidth: "100%", height: "auto" }}
        />
      ))}
      {videos.map((url) => (
        <div key={url}>
          <video
            src={url}
            controls
            preload="none"
            style={{ maxWidth: "100%" }}
          />
          <a href={url} target="_blank" rel="noreferrer">
            Ouvrir la vidéo source ↗
          </a>
        </div>
      ))}
    </details>
  );
}

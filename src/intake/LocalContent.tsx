import { useEffect, useState, useRef } from "react";
import {
  readLocalCopy,
  readLocalAsset,
  downloadLocalMedia,
  type LocalCopy,
} from "./local-archive";
export function LocalContent({ id }: { id: string }) {
  const [copy, setCopy] = useState<LocalCopy>(),
    [assets, setAssets] = useState<Record<string, string>>({});
  const gate = useRef<HTMLDivElement>(null),
    [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    if (gate.current)
      observer.observe(gate.current.closest(".reference-card") || gate.current);
    return () => observer.disconnect();
  }, [id]);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    let urls: string[] = [];
    async function load() {
      const row = await readLocalCopy(id);
      if (!active) return;
      setCopy(row);
      const next: Record<string, string> = {};
      for (const media of row?.media || []) {
        const value = await readLocalAsset(media.url);
        if (value) {
          const url = URL.createObjectURL(value.blob);
          urls.push(url);
          next[media.url] = url;
        }
      }
      if (active) {
        setAssets(next);
        const stale = urls.splice(
          0,
          Math.max(0, urls.length - Object.keys(next).length),
        );
        stale.forEach((u) => URL.revokeObjectURL(u));
      }
    }
    const update = (e: Event) => {
      if ((e as CustomEvent).detail === id) void load().catch(() => {});
    };
    void load().catch(() => {});
    window.addEventListener("ad-local-archive", update);
    return () => {
      active = false;
      window.removeEventListener("ad-local-archive", update);
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [id, visible]);
  if (!copy) return <div ref={gate} className="local-content-gate" />;
  const saved = copy.media.filter((m) => m.state === "saved").length,
    pending = copy.media.length - saved;
  return (
    <div ref={gate} className="local-content-gate">
      <details className="local-content">
        <summary>
          Contenu conservé sur cet appareil · {saved}/{copy.media.length}{" "}
          fichiers
        </summary>
        <p>
          Texte conservé localement. Les fichiers confirmés restent lisibles
          sans la source. Effacer les données du navigateur supprime cette
          copie.
        </p>
        {copy.item.author && <p>Auteur : @{copy.item.author}</p>}
        {!!copy.item.tags.length && (
          <p>Dossiers / tags source : {copy.item.tags.join(" · ")}</p>
        )}
        {copy.item.notes.map((note, i) => (
          <p key={i}>Note importée : {note}</p>
        ))}
        <p className="local-original">
          {copy.item.originalText ||
            copy.item.text ||
            "Le texte n’était pas disponible à la collecte."}
        </p>
        {copy.item.images.map((url) =>
          assets[url] ? (
            <img
              key={url}
              src={assets[url]}
              alt="Image conservée de la publication"
              loading="lazy"
            />
          ) : (
            <p key={url}>Image : lien conservé, fichier non confirmé.</p>
          ),
        )}
        {copy.item.videos.map((url) =>
          assets[url] ? (
            <video
              key={url}
              src={assets[url]}
              controls
              preload="metadata"
              playsInline
            />
          ) : (
            <p key={url}>Vidéo : lien conservé, fichier non confirmé.</p>
          ),
        )}
        {pending > 0 && (
          <button onClick={() => void downloadLocalMedia([id])}>
            Reprendre la conservation des médias
          </button>
        )}
        {[
          ...new Set(
            copy.media.filter((m) => m.state === "error").map((m) => m.error),
          ),
        ].map((message, i) => (
          <p role="status" key={i}>
            {message}
          </p>
        ))}
      </details>
    </div>
  );
}

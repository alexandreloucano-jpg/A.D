import { ImageOff, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
export function ReferenceMedia({ url, title }: { url: string; title: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, [url]);
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(
      () =>
        setStatus((current) => (current === "loading" ? "failed" : current)),
      8000,
    );
    return () => clearTimeout(timer);
  }, [url, attempt, visible]);
  return (
    <div ref={stage} className="reference-media" data-state={status}>
      {visible && status !== "failed" && (
        <img
          key={url + attempt}
          src={url}
          alt={title}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("failed")}
        />
      )}
      {status === "loading" && (
        <span className="media-loading" role="status">
          Chargement de l’aperçu…
        </span>
      )}
      {status === "failed" && (
        <div className="media-fallback">
          <ImageOff size={24} strokeWidth={1.3} />
          <p>
            Aperçu indisponible.
            <br />
            <span>Votre lien reste enregistré.</span>
          </p>
          <button
            className="text-button"
            onClick={() => {
              setStatus("loading");
              setAttempt((n) => n + 1);
            }}
          >
            <RotateCcw size={14} />
            Réessayer l’aperçu
          </button>
        </div>
      )}
    </div>
  );
}

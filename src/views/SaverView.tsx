import { useEffect, useState } from "react";
import { Reader } from "../reader/Reader";
import type { RemoteSaver } from "../remote-saver";
import { ReferenceMedia } from "../components/ReferenceMedia";
import { directImageUrl } from "../media";
import { ArrowRight, ArrowUpRight, Bookmark, Check } from "lucide-react";
import { Empty } from "../components/ui";
import { dateLabel } from "../display";
import { type Workspace } from "../domain";
export function SaverView({
  refs,
  expanded,
  setExpanded,
  query,
  data,
  filter,
  setFilter,
  serverIds = new Set<string>(),
  remote,
  readerMatches = [],
}: {
  serverIds?: Set<string>;
  remote: RemoteSaver;
  readerMatches?: {
    referenceId: string;
    annotationId: string | null;
    quote?: string;
    note?: string;
  }[];
  refs: Workspace["references"];
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  query: string;
  data: Workspace;
  filter: "all" | "links" | "notes";
  setFilter: (filter: "all" | "links" | "notes") => void;
}) {
  const [reading, setReading] = useState<string | null>(() => {
    const p = new URLSearchParams(location.hash.split("?")[1] || "");
    return p.get("reader") === "1" ? p.get("reference") : null;
  });
  useEffect(() => {
    const change = () => {
      const p = new URLSearchParams(location.hash.split("?")[1] || "");
      setReading(p.get("reader") === "1" ? p.get("reference") : null);
    };
    window.addEventListener("popstate", change);
    window.addEventListener("hashchange", change);
    return () => {
      window.removeEventListener("popstate", change);
      window.removeEventListener("hashchange", change);
    };
  }, []);
  function openReader(id: string) {
    setExpanded(id);
    setReading(id);
    const p = new URLSearchParams(location.hash.split("?")[1] || "");
    p.set("reference", id);
    p.set("reader", "1");
    const match = readerMatches.find(
      (row) => row.referenceId === id && row.annotationId,
    );
    if (match?.annotationId) p.set("annotation", match.annotationId);
    window.history.replaceState(null, "", "#/saver?" + p.toString());
  }
  function closeReader() {
    setReading(null);
    const p = new URLSearchParams(location.hash.split("?")[1] || "");
    p.delete("reader");
    p.delete("annotation");
    window.history.replaceState(
      null,
      "",
      "#/saver" + (p.size ? "?" + p.toString() : ""),
    );
  }
  const readingReference = refs.find((row) => row.id === reading);
  const visible = refs.filter(
    (r) => filter === "all" || (filter === "links" ? !!r.url : !r.url),
  );
  return (
    <>
      {readingReference && (
        <Reader
          key={readingReference.id}
          reference={readingReference}
          remote={remote}
          persisted={serverIds.has(readingReference.id)}
          close={closeReader}
          annotationId={
            new URLSearchParams(location.hash.split("?")[1] || "").get(
              "annotation",
            ) || undefined
          }
        />
      )}
      <div
        className="library-filters"
        role="group"
        aria-label="Type de référence"
      >
        {(
          [
            ["all", "Tout"],
            ["links", "Liens"],
            ["notes", "Notes"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
            <span>
              {
                refs.filter(
                  (r) => key === "all" || (key === "links" ? !!r.url : !r.url),
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      {visible.length ? (
        <div className="reference-grid">
          {visible
            .slice()
            .reverse()
            .map((r) => (
              <article
                className="reference-card"
                key={r.id}
                data-expanded={expanded === r.id}
                data-has-media={!!directImageUrl(r.url)}
              >
                {directImageUrl(r.url) && (
                  <ReferenceMedia
                    key={r.url}
                    url={directImageUrl(r.url)!}
                    title={r.title}
                  />
                )}
                <div className="reference-body">
                  <div className="card-meta">
                    <span>
                      {r.origin === "grok"
                        ? "GROK · VALIDÉ PAR VOUS"
                        : r.url
                          ? "LIEN ENREGISTRÉ"
                          : "NOTE PERSONNELLE"}
                    </span>
                    <Bookmark size={17} />
                  </div>
                  <h2>
                    <button
                      onClick={() => openReader(r.id)}
                      aria-haspopup="dialog"
                    >
                      {r.title}
                    </button>
                  </h2>
                  {readerMatches
                    .filter((hit) => hit.referenceId === r.id && hit.note)
                    .slice(0, 2)
                    .map((hit, i) => (
                      <p className="reader-search-hit" key={i}>
                        Note : {hit.note}
                      </p>
                    ))}
                  <p className="excerpt">
                    {r.content ||
                      "Lien enregistré. Aucune analyse automatique."}
                  </p>
                  {r.url && (
                    <a
                      className="source-link"
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {new URL(r.url).hostname}
                      <ArrowUpRight size={16} />
                    </a>
                  )}
                  <div className="card-bottom">
                    <time>{dateLabel(r.capturedAt)}</time>
                    <button
                      className="text-button"
                      onClick={() =>
                        setExpanded(expanded === r.id ? null : r.id)
                      }
                    >
                      {expanded === r.id ? "Réduire" : "Reçu de sauvegarde"}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  {expanded === r.id && (
                    <div className="receipt">
                      <Check size={15} />
                      <strong>
                        {serverIds.has(r.id)
                          ? "Sauvegarde serveur relue"
                          : "Sauvegarde locale relue"}
                      </strong>
                      <code>{r.id}</code>
                      <span>
                        Révision {r.revision} ·{" "}
                        {r.projectId
                          ? data.projects.find((p) => p.id === r.projectId)
                              ?.title
                          : "Sans projet associé"}
                      </span>
                      <span>Analyse Taste non connectée.</span>
                    </div>
                  )}
                </div>
              </article>
            ))}
        </div>
      ) : (
        <Empty
          icon={<Bookmark size={30} strokeWidth={1} />}
          title={
            query || filter !== "all"
              ? "Aucune correspondance."
              : "Ce qui vous inspire commence ici."
          }
        >
          {query || filter !== "all"
            ? "Essayez un autre mot."
            : "Capturez une référence ou une pensée. Aucun classement obligatoire."}
        </Empty>
      )}
    </>
  );
}

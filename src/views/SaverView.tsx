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
}: {
  refs: Workspace["references"];
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  query: string;
  data: Workspace;
}) {
  return refs.length ? (
    <div className="reference-grid">
      {refs
        .slice()
        .reverse()
        .map((r) => (
          <article className="reference-card" key={r.id}>
            <div className="card-meta">
              <span>
                {r.origin === "grok"
                  ? "GROK · VALIDÉ PAR VOUS"
                  : "CAPTURE PERSONNELLE"}
              </span>
              <Bookmark size={17} />
            </div>
            <h2>
              <button
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                aria-expanded={expanded === r.id}
              >
                {r.title}
              </button>
            </h2>
            <p className="excerpt">
              {r.content || "Lien enregistré. Aucune analyse automatique."}
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
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                {expanded === r.id ? "Réduire" : "Reçu de sauvegarde"}
                <ArrowRight size={14} />
              </button>
            </div>
            {expanded === r.id && (
              <div className="receipt">
                <Check size={15} />
                <strong>Sauvegarde locale relue</strong>
                <code>{r.id}</code>
                <span>
                  Révision {r.revision} ·{" "}
                  {r.projectId
                    ? data.projects.find((p) => p.id === r.projectId)?.title
                    : "Sans projet associé"}
                </span>
                <span>Analyse Taste non connectée.</span>
              </div>
            )}
          </article>
        ))}
    </div>
  ) : (
    <Empty
      icon={<Bookmark size={30} strokeWidth={1} />}
      title={
        query ? "Aucune correspondance." : "Ce qui vous inspire commence ici."
      }
    >
      {query
        ? "Essayez un autre mot."
        : "Capturez une référence ou une pensée. Aucun classement obligatoire."}
    </Empty>
  );
}

import { ArrowUpRight, Compass, Plus } from "lucide-react";
import { Empty } from "../components/ui";
import { dateLabel } from "../display";
import type { Workspace } from "../domain";
export function ExplorerView({
  signals,
  query,
  onCapture,
}: {
  signals: Workspace["signals"];
  query: string;
  onCapture: (source: { url: string; title: string }) => void;
}) {
  return signals.length ? (
    <div className="signal-list">
      {signals
        .slice()
        .reverse()
        .map((s, index) => (
          <article className="signal-card" key={s.id}>
            <div className="signal-observation">
              <div className="signal-topline">
                <span className="eyebrow">
                  {(index + 1).toString().padStart(2, "0")} / FAIT RAPPORTÉ
                </span>
                <span className="verification-state">À vérifier</span>
              </div>
              <h2>{s.brand}</h2>
              <p>{s.observedFact}</p>
              <p className="fact-disclaimer">
                Observation ajoutée par vous. Vérification externe non
                effectuée.
              </p>
            </div>
            <div className="signal-evidence">
              <h3>Source & chronologie</h3>
              <a
                className="source-link"
                href={s.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  {new URL(s.sourceUrl).hostname}
                  <small>Voir la source</small>
                </span>
                <ArrowUpRight size={17} />
              </a>
              <dl>
                <div>
                  <dt>Date du fait</dt>
                  <dd>{dateLabel(s.occurredAt)}</dd>
                </div>
                <div>
                  <dt>Collecté le</dt>
                  <dd>{dateLabel(s.collectedAt)}</dd>
                </div>
              </dl>
            </div>
            <div className="signal-thinking">
              <details className="interpretation">
                <summary>Interprétation · à examiner</summary>
                <p>{s.inference || "Aucune interprétation ajoutée."}</p>
                <span className="thinking-note">
                  Une lecture possible, distincte du fait rapporté.
                </span>
              </details>
              <div className="signal-action">
                <div>
                  <h3>Piste d’action</h3>
                  <p>Aucune action créée. Vous décidez de la suite.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() =>
                    onCapture({ url: s.sourceUrl, title: s.brand })
                  }
                >
                  <Plus size={16} />
                  Noter une piste
                </button>
              </div>
            </div>
          </article>
        ))}
    </div>
  ) : (
    <Empty
      icon={<Compass size={30} strokeWidth={1} />}
      title={
        query ? "Aucune correspondance." : "Votre radar, sans bruit inventé."
      }
    >
      Ajoutez un fait et sa source pour commencer. Aucune veille automatique
      n’est connectée.
    </Empty>
  );
}

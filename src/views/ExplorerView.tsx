import { ArrowUpRight, Compass } from "lucide-react";
import { Empty } from "../components/ui";
import { dateLabel } from "../display";
import { type Workspace } from "../domain";
export function ExplorerView({
  signals,
  query,
}: {
  signals: Workspace["signals"];
  query: string;
}) {
  return signals.length ? (
    <div className="signal-list">
      {signals
        .slice()
        .reverse()
        .map((s, index) => (
          <article className="signal-card" key={s.id}>
            <div className="signal-observation">
              <span className="eyebrow">
                <span className="signal-number">
                  {(index + 1).toString().padStart(2, "0")} /{" "}
                </span>
                OBSERVATION SOURCÉE
              </span>
              <h2>{s.brand}</h2>
              <p>{s.observedFact}</p>
            </div>
            <div className="signal-evidence">
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
              <a
                className="source-link"
                href={s.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Voir la source <ArrowUpRight size={16} />
              </a>
            </div>
            {s.inference && (
              <details className="interpretation">
                <summary>Interprétation · à examiner</summary>
                <p>{s.inference}</p>
              </details>
            )}
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

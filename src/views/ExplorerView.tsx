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
        .map((s) => (
          <article className="signal-card" key={s.id}>
            <span className="eyebrow">SOURCE AJOUTÉE PAR VOUS</span>
            <h2>{s.brand}</h2>
            <p>{s.observedFact}</p>
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
            {s.inference && (
              <div className="interpretation">
                <strong>Interprétation · à examiner</strong>
                <p>{s.inference}</p>
              </div>
            )}
            <a
              className="source-link"
              href={s.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Voir la source <ArrowUpRight size={16} />
            </a>
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

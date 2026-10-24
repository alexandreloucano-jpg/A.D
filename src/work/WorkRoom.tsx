import { useState, type ReactNode } from "react";
import type { Workspace } from "../domain";
import type { RemoteSaver } from "../remote-saver";
import { CreativeCanvas } from "../creative/CreativeCanvas";
import { ArrowUpRight } from "lucide-react";
import "./work-room.css";

type Props = {
  project: Workspace["projects"][number];
  data: Workspace;
  remote: RemoteSaver;
  commit: (data: Workspace, message: string) => boolean;
  openReference: (id: string) => void;
  capture: () => void;
  children: ReactNode;
};
const steps = [
  ["work-evidence", "Comprendre", "La preuve"],
  ["work-sources", "Relier", "Les références"],
  ["work-brief", "Créer", "Deux directions"],
  ["work-actions", "Décider", "La suite"],
] as const;

export function WorkRoom({ project, data, remote, commit, openReference, capture, children }: Props) {
  const [active, setActive] = useState<string>("work-evidence");
  const links = (data.opportunityLinks || []).filter(link => link.projectId === project.id);
  function go(id: string) {
    setActive(id);
    const target = document.getElementById(id);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  return <div className="work-room">
    <header className="work-room-intro">
      <p>WORK / DOSSIER DE CRÉATION</p>
      <h1>{project.title}</h1>
      <span>Une preuve, des références, une réponse créative.</span>
    </header>
    <nav className="work-room-steps" aria-label="Parcours du dossier">
      {steps.map(([id, title, detail], index) => <button key={id} type="button"
        aria-current={active === id ? "step" : undefined} onClick={() => go(id)}>
        <span>0{index + 1}</span><strong>{title}</strong><small>{detail}</small>
      </button>)}
    </nav>
    <section id="work-evidence" tabIndex={-1} className="work-room-evidence" aria-label="Preuves de l'opportunité">
      <div className="work-room-section-label">01 / POINT DE DÉPART</div>
      {links.length ? links.map(link => <article key={link.id}>
        <p className="work-room-link-state">{link.status === "LINKED" ? "LIEN SERVEUR CONFIRMÉ" : "LIEN SERVEUR À REPRENDRE"}</p>
        <h3>{link.companyName}</h3>
        <p className="work-room-fact"><strong>Fait rapporté</strong>{link.reportedFact}</p>
        <a href={link.sourceUrl} target="_blank" rel="noreferrer noopener">{link.publisher || "Publication originale"} <ArrowUpRight size={14} aria-hidden="true" /></a>
        <p className="work-room-date">Preuve capturée le {new Date(link.capturedAt).toLocaleDateString("fr-FR")} · Le besoin commercial reste à vérifier.</p>
        <div className="work-room-proof-columns">
          <details><summary>Preuves figées ({link.evidence.length})</summary>
            {link.evidence.map(e => <div key={e.id}><a href={e.url} target="_blank" rel="noreferrer noopener">{e.publisher || "Source originale"} <ArrowUpRight size={14} aria-hidden="true" /></a>
              <p>{e.claimSupported}</p><small>Publication : {e.publishedAt ? new Date(e.publishedAt).toLocaleDateString("fr-FR") : "date inconnue"}</small></div>)}
          </details>
          <div><h4>À vérifier avant d’agir</h4>{link.unknowns.length
            ? <ul>{link.unknowns.map((u, i) => <li key={i}>{u}</li>)}</ul>
            : <p>Aucune inconnue consignée. Cela ne constitue pas une validation du besoin.</p>}</div>
        </div>
        {link.status !== "LINKED" && <p role="status">Le dossier est conservé sur cet appareil. Retournez sur l’opportunité Radar pour reprendre la liaison ; ne créez pas un autre dossier.</p>}
      </article>) : <div><h3>Partir d’une source.</h3><p>Ce dossier n’est pas lié à une opportunité Radar. Vous pouvez choisir des références Saver et rédiger votre intention sans inventer de preuve commerciale.</p></div>}
      <button type="button" className="work-room-next" onClick={() => go("work-sources")}>Choisir mes références <ArrowUpRight size={18} aria-hidden="true" /></button>
    </section>
    <CreativeCanvas project={project} data={data} references={data.references} remote={remote}
      commit={commit} openReference={openReference} capture={capture} />
    <section id="work-actions" tabIndex={-1} className="work-room-actions" aria-label="Décisions et actions du dossier">
      <div className="work-room-section-label">04 / PROCHAIN GESTE</div>
      <p>Une idée reste dans LATER jusqu’à votre acceptation.</p>
      {children}
    </section>
  </div>;
}

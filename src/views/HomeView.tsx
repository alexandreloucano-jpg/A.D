import { MarketPanel } from "../scout-market/MarketPanel";
import type { Finding } from "../scout-market/schema";
import type { EvidenceReceipt } from "../opportunity/model";
import { latestCreative } from "../creative/model";
import { ArrowUpRight, Plus, Upload } from "lucide-react";
import { dateLabel, type Route } from "../display";
import { rediscover, type Task, type Workspace } from "../domain";

export function HomeView({data,now,navigate,setProjectId,openReference,setModal,onRestore,onOpenDossier}: {
 data:Workspace; now:Task[]; navigate:(r:Route)=>void; setProjectId:(id:string|null)=>void;
 openReference:(id:string)=>void; setModal:(v:"project")=>void; onRestore:()=>void; onOpenDossier:(finding:Finding,evidence:EvidenceReceipt[])=>Promise<void>;
}) {
 const priority=now[0];
 const project=priority?data.projects.find(p=>p.id===priority.projectId):undefined;
 const pending=data.tasks.filter(t=>t.lane==="LATER").length;
 const references=rediscover(data);
 const recent=data.projects.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,3);
 const directions=(data.creativeBoards||[])
   .flatMap(board=>{
     const project=data.projects.find(p=>p.id===board.projectId);
     const revision=latestCreative(board);
     return project&&revision?[{board,project,revision}]:[];
   })
   .sort((a,b)=>b.revision.createdAt.localeCompare(a.revision.createdAt));
 const latest=references.at(-1);
 function continueWork(){
   if(data.projects.length){navigate("projets");if(project)setProjectId(project.id);}
   else navigate("explorer");
 }
 return (
  <div className="home-layout ad-v2-home">
   <section className={"home-focus ad-v2-focus"+(priority?" has-priority":"")}>
    <div className="ad-v2-heading-line"><span>A.D / AUJOURD’HUI</span><span>ESPACE DE TRAVAIL</span></div>
    <div className="ad-v2-priority">
      <p className="ad-v2-overline">{priority?"PRIORITÉ VALIDÉE PAR VOUS":"AUCUNE PRIORITÉ VALIDÉE"}</p>
      <h1>{priority?priority.title:<>Aucune priorité<br/><em>en cours.</em></>}</h1>
      <p className="ad-v2-description">{priority
       ?"Vous avez validé cette action. Ouvrez son dossier pour poursuivre."
       :pending?pending+" proposition"+(pending>1?"s":"")+" à examiner. Aucune priorité n'a été créée automatiquement."
       :"Commencez dans le Radar : examinez une opportunité sourcée, puis ouvrez-la en dossier de travail."}</p>
      {priority?.acceptedAt&&<p className="ad-v2-date">Décision du {dateLabel(priority.acceptedAt)}</p>}
      <button className="primary ad-v2-cta" onClick={continueWork}>
       {priority?"Ouvrir le dossier":data.projects.length?"Examiner les dossiers":"Voir les opportunités"}
       <ArrowUpRight size={17} aria-hidden="true"/>
      </button>
      {!data.projects.length && (
       <details className="ad-v2-restore">
        <summary>Dossiers d’une ancienne version ?</summary>
        <p>Déjà des dossiers dans une ancienne version d’A.D ? Les données locales ne suivent pas automatiquement un changement de domaine.</p>
        <button type="button" onClick={onRestore}>Récupérer mes anciens dossiers <Upload size={15} aria-hidden="true"/></button>
       </details>
      )}
    </div>
    <div className="ad-v2-counters" aria-label="État de l'espace de travail">
      <div><strong>{String(data.projects.length).padStart(2,"0")}</strong><span>Dossiers</span></div>
      <div><strong>{String(pending).padStart(2,"0")}</strong><span>À examiner</span></div>
      <div><strong>{String(references.length).padStart(2,"0")}</strong><span>Références</span></div>
    </div>
   </section>
   <aside className="home-rail ad-v2-rail" aria-label="Radar, directions artistiques et actualités">
    <div className="ad-v2-heading-line"><span>RADAR · DA · NEWS</span><span>AU MÊME ENDROIT</span></div>
    <MarketPanel mode="home" onOpenDossier={onOpenDossier}/>
    <section aria-label="Directions artistiques">
      <div className="section-label">
       <h2>Directions artistiques</h2>
       <button aria-label="Voir le travail" onClick={()=>navigate("projets")}><ArrowUpRight size={17}/></button>
      </div>
      {directions.length?directions.map(({board,project,revision})=>
       <article key={board.id} className="home-direction-row">
        <button className="project-row" onClick={()=>{navigate("projets");setProjectId(project.id);}}>
         <span className="row-index">DA</span>
         <span>{project.title}<small>V{revision.number} · {revision.approvedDirection?"Piste "+revision.approvedDirection+" approuvée":"Deux pistes à examiner"}</small></span>
         <ArrowUpRight size={16} aria-hidden="true"/>
        </button>
        <p className="market-meta">A · {revision.directions[0].title || "Sans titre"} <span aria-hidden="true"> · </span> B · {revision.directions[1].title || "Sans titre"}</p>
       </article>
      ):<div className="ad-v2-no-content"><p>Aucune direction enregistrée.</p>
       <button className="text-button" onClick={continueWork}>Ouvrir un dossier et créer sa DA <ArrowUpRight size={15}/></button>
      </div>}
    </section>
    <section>
      <div className="section-label">
       <h2>Dossiers actifs</h2>
       <button aria-label="Voir les projets" onClick={()=>navigate("projets")}><ArrowUpRight size={17}/></button>
      </div>
      {recent.length?recent.map((p,i)=>
       <button key={p.id} className="project-row" onClick={()=>{navigate("projets");setProjectId(p.id);}}>
         <span className="row-index">{String(i+1).padStart(2,"0")}</span>
         <span>{p.title}<small>Mis à jour le {dateLabel(p.updatedAt)}</small></span>
         <ArrowUpRight size={16} aria-hidden="true"/>
       </button>
      ):<div className="ad-v2-no-content"><p>Aucun dossier pour le moment.</p>
       <button className="text-button" onClick={()=>setModal("project")}>Créer un dossier <Plus size={15}/></button>
      </div>}
    </section>
    <section>
      <div className="section-label"><h2>Mémoire récente</h2><span>{String(references.length).padStart(2,"0")}</span></div>
      {latest?<button className="reference-row" onClick={()=>openReference(latest.id)}>
       <span className="row-index">SAVER</span>
       <span>{latest.title}<small>{latest.url?"Source enregistrée":"Note personnelle"}</small></span>
       <ArrowUpRight size={16} aria-hidden="true"/>
      </button>:<p className="ad-v2-no-content">Aucune référence enregistrée.</p>}
    </section>
    <button className="ad-v2-plain-link" onClick={()=>navigate("explorer")}>Explorer les opportunités <ArrowUpRight size={17}/></button>
   </aside>
  </div>
 );
}

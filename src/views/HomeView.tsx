import { MarketPanel } from "../scout-market/MarketPanel";
import { StudioLeadsPanel } from "../marketing/StudioLeadsPanel";
import type { RemoteSaver } from "../remote-saver";
import { ArrowUpRight, Plus } from "lucide-react";
import { dateLabel, type Route } from "../display";
import { rediscover, type Task, type Workspace } from "../domain";

export function HomeView({data,now,navigate,setProjectId,openReference,setModal,remote}: {
 data:Workspace; now:Task[]; navigate:(r:Route)=>void; setProjectId:(id:string|null)=>void;
 openReference:(id:string)=>void; setModal:(v:"project")=>void; remote:RemoteSaver;
}) {
 const priority=now[0];
 const project=priority?data.projects.find(p=>p.id===priority.projectId):undefined;
 const pending=data.tasks.filter(t=>t.lane==="LATER").length;
 const references=rediscover(data);
 const recent=data.projects.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,3);
 const latest=references.at(-1);
 function continueWork(){
   if(data.projects.length){navigate("projets");if(project)setProjectId(project.id);}
   else setModal("project");
 }
 return (
  <div className="home-layout ad-v2-home">
   <section className={"home-focus ad-v2-focus"+(priority?" has-priority":"")}>
    <div className="ad-v2-heading-line"><span>01 / TODAY</span><span>PRIVATE CREATIVE INTELLIGENCE</span></div>
    <div className="ad-v2-priority">
      <p className="ad-v2-overline">{priority?"DÉCISION PRIORITAIRE · VALIDÉE":"AUCUNE DÉCISION PRIORITAIRE"}</p>
      <h1>{priority?priority.title:<>Aucune priorité<br/><em>en cours.</em></>}</h1>
      <p className="ad-v2-description">{priority
       ?"Vous avez validé cette action. Ouvrez son dossier pour poursuivre."
       :pending?pending+" proposition"+(pending>1?"s":"")+" à examiner. Aucune priorité n'a été créée automatiquement."
       :"Aucune décision en attente. Consultez vos dossiers ou les nouvelles opportunités."}</p>
      {priority?.acceptedAt&&<p className="ad-v2-date">Décision du {dateLabel(priority.acceptedAt)}</p>}
      <button className="primary ad-v2-cta" onClick={continueWork}>
       {priority?"Ouvrir le dossier":data.projects.length?"Examiner les dossiers":"Créer un dossier"}
       <ArrowUpRight size={17} aria-hidden="true"/>
      </button>
    </div>
    <div className="ad-v2-counters" aria-label="État de l'espace de travail">
      <div><strong>{String(data.projects.length).padStart(2,"0")}</strong><span>Dossiers</span></div>
      <div><strong>{String(pending).padStart(2,"0")}</strong><span>À examiner</span></div>
      <div><strong>{String(references.length).padStart(2,"0")}</strong><span>Références</span></div>
    </div>
   </section>
   <aside className="home-rail ad-v2-rail" aria-label="Intelligence et travail récent">
    <div className="ad-v2-heading-line"><span>THE DESK</span><span>RECENT ACTIVITY</span></div>
    <MarketPanel mode="home"/>
    <StudioLeadsPanel remote={remote}/>
    <section>
      <div className="section-label">
       <h2>Dossiers récents</h2>
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
      <div className="section-label"><h2>Dernière référence</h2><span>{String(references.length).padStart(2,"0")}</span></div>
      {latest?<button className="reference-row" onClick={()=>openReference(latest.id)}>
       <span className="row-index">SAVER</span>
       <span>{latest.title}<small>{latest.url?"Source enregistrée":"Note personnelle"}</small></span>
       <ArrowUpRight size={16} aria-hidden="true"/>
      </button>:<p className="ad-v2-no-content">Aucune référence enregistrée.</p>}
    </section>
    <button className="ad-v2-plain-link" onClick={()=>navigate("explorer")}>Ouvrir le radar <ArrowUpRight size={17}/></button>
   </aside>
  </div>
 );
}

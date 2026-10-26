import { MarketPanel } from "../scout-market/MarketPanel";
import type { Finding } from "../scout-market/schema";
import type { EvidenceReceipt } from "../opportunity/model";
import { latestCreative } from "../creative/model";
import { ArrowUpRight } from "lucide-react";
import type { Route } from "../display";
import type { Task, Workspace } from "../domain";

export function HomeView({data,now,navigate,setProjectId,onOpenDossier}: {
 now:Task[];
 data:Workspace; navigate:(r:Route)=>void; setProjectId:(id:string|null)=>void;
 onOpenDossier:(finding:Finding,evidence:EvidenceReceipt[])=>Promise<void>;
}) {
 const directions=(data.creativeBoards||[])
   .flatMap(board=>{
     const project=data.projects.find(p=>p.id===board.projectId);
     const revision=latestCreative(board);
     return project&&revision?[{board,project,revision}]:[];
   })
   .sort((a,b)=>b.revision.createdAt.localeCompare(a.revision.createdAt));
 const priority=now[0];
 const priorityProject=priority&&data.projects.find(project=>project.id===priority.projectId);

 return <div className="home-minimal">
  <header className="home-minimal-heading">
   <p className="eyebrow">A.D / ATELIER PRIVÉ</p>
   <h1>Aujourd’hui</h1>
   <p>Vos directions artistiques, le Radar et les actualités réunis.</p>
  </header>

  {priority&&priorityProject&&<section className="home-next-row" aria-label="Action acceptée à reprendre">
   <div><span className="eyebrow">À REPRENDRE · VALIDÉ PAR VOUS</span><strong>{priority.title}</strong></div>
   <button type="button" className="home-minimal-link" onClick={()=>{navigate("projets");setProjectId(priority.projectId);}}>Ouvrir <ArrowUpRight size={16}/></button>
  </section>}

  <section className="home-minimal-section" aria-label="Directions artistiques">
   <div className="home-minimal-section-heading">
    <div><p className="eyebrow">TRAVAIL EN COURS</p><h2>Directions artistiques</h2></div>
    <button type="button" className="home-minimal-link" onClick={()=>navigate("projets")}>Tout le travail <ArrowUpRight size={16}/></button>
   </div>
   {directions.length?directions.map(({board,project,revision})=>
    <article key={board.id} className="home-da-row">
     <button type="button" className="home-da-open" onClick={()=>{navigate("projets");setProjectId(project.id);}}>
      <span className="home-da-project">{project.title}</span>
      <span className="home-da-approval">{revision.approvedDirection?"Approuvée · piste "+revision.approvedDirection:"À examiner · V"+revision.number}</span>
      <ArrowUpRight size={16} aria-hidden="true"/>
     </button>
     <p><span>A</span> {revision.directions[0].title||"Sans titre"}<span className="home-da-separator"> / </span><span>B</span> {revision.directions[1].title||"Sans titre"}</p>
    </article>
   ):<div className="home-minimal-empty">
    <p>Aucune direction enregistrée dans cet espace.</p>
    <button type="button" className="home-minimal-link" onClick={()=>navigate("projets")}>Ouvrir les dossiers <ArrowUpRight size={16}/></button>
   </div>}
  </section>

  <MarketPanel mode="home" onOpenDossier={onOpenDossier}/>
 </div>;
}

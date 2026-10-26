import { useCallback, useState } from "react";
import { MarketPanel, type HomeMarketState } from "../scout-market/MarketPanel";
import type { Finding } from "../scout-market/schema";
import type { EvidenceReceipt } from "../opportunity/model";
import { latestCreative } from "../creative/model";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Route } from "../display";
import type { Task, Workspace } from "../domain";

export function HomeView({data,now,navigate,setProjectId,onOpenDossier}: {
 now:Task[]; data:Workspace; navigate:(r:Route)=>void; setProjectId:(id:string|null)=>void;
 onOpenDossier:(finding:Finding,evidence:EvidenceReceipt[])=>Promise<void>;
}) {
 const [market,setMarket]=useState<HomeMarketState>({items:[],status:null,loading:true,error:""});
 const receiveMarket=useCallback((value:HomeMarketState)=>setMarket(value),[]);
 const directions=(data.creativeBoards||[])
   .flatMap(board=>{
     const project=data.projects.find(p=>p.id===board.projectId);
     const revision=latestCreative(board);
     return project&&revision?[{board,project,revision}]:[];
   })
   .sort((a,b)=>b.revision.createdAt.localeCompare(a.revision.createdAt));
 const projects=data.projects.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 const priority=now[0];
 const priorityProject=priority&&data.projects.find(project=>project.id===priority.projectId);
 const nextDirection=directions.find(row=>!row.revision.approvedDirection)||directions[0];
 const radarItems=market.items.filter(f=>f.classification==="commercial");
 const newsItems=market.items.filter(f=>f.classification==="strategic"||f.classification==="cultural");
 const nextStep=priority&&priorityProject?{
   eyebrow:"ACTION VALIDÉE PAR VOUS",
   title:priority.title,
   detail:"Reprenez cette action dans le dossier « "+priorityProject.title+" ».",
   label:"Reprendre le travail",
   run:()=>{navigate("projets");setProjectId(priorityProject.id);},
 }:nextDirection?{
   eyebrow:"DIRECTION EN COURS",
   title:nextDirection.project.title,
   detail:"Poursuivez la revue des pistes A et B de la version "+nextDirection.revision.number+".",
   label:"Reprendre cette direction",
   run:()=>{navigate("projets");setProjectId(nextDirection.project.id);},
 }:projects[0]?{
   eyebrow:"PROCHAINE ÉTAPE",
   title:"Développer une direction artistique",
   detail:"Ouvrez « "+projects[0].title+" » puis travaillez son brief avec vos références et son contexte.",
   label:"Ouvrir le dossier",
   run:()=>{navigate("projets");setProjectId(projects[0].id);},
 }:{
   eyebrow:"PROCHAINE ÉTAPE · RADAR",
   title:"Choisir une opportunité sourcée",
   detail:"Examinez les faits et leurs sources, puis créez un dossier de travail pour bâtir une direction adaptée.",
   label:"Ouvrir le Radar",
   run:()=>navigate("explorer"),
 };
 const radarCount=radarItems.length;
 const newsCount=newsItems.length;
 const radarLabel=market.loading?"Lecture en cours…":!market.status?.enabled?"Connexion requise":radarCount+" opportunités · "+newsCount+" actualités";

 return <div className="home-minimal">
  <header className="home-minimal-heading">
   <p className="eyebrow">A.D / ESPACE DE DIRECTION ARTISTIQUE</p>
   <h1>Aujourd’hui</h1>
   <p>De vos références à une opportunité, puis à une direction que vous choisissez.</p>
  </header>

  <section className="home-next-step" aria-label="Votre prochain pas">
   <div><p className="eyebrow">{nextStep.eyebrow}</p><h2>{nextStep.title}</h2><p>{nextStep.detail}</p></div>
   <button type="button" className="primary" onClick={nextStep.run}>{nextStep.label}<ArrowRight size={17}/></button>
  </section>

  <nav className="home-workflow" aria-label="Parcours A.D">
   <button type="button" onClick={()=>navigate("saver")}>
    <span className="home-workflow-index">01</span><span><strong>Bibliothèque</strong><small>{data.references.length} référence{data.references.length===1?"":"s"} conservée{data.references.length===1?"":"s"}</small></span><ArrowUpRight size={15}/>
   </button>
   <span className="home-workflow-arrow" aria-hidden="true">→</span>
   <button type="button" onClick={()=>navigate("explorer")}>
    <span className="home-workflow-index">02</span><span><strong>Radar</strong><small>{radarLabel}</small></span><ArrowUpRight size={15}/>
   </button>
   <span className="home-workflow-arrow" aria-hidden="true">→</span>
   <button type="button" onClick={()=>navigate("projets")}>
    <span className="home-workflow-index">03</span><span><strong>Travail</strong><small>{directions.length} direction{directions.length===1?"":"s"} · {projects.length} dossier{projects.length===1?"":"s"}</small></span><ArrowUpRight size={15}/>
   </button>
  </nav>

  <section className="home-minimal-section" aria-label="Directions artistiques">
   <div className="home-minimal-section-heading">
    <div><p className="eyebrow">DOSSIERS ET TRAITEMENTS</p><h2>Vos directions</h2></div>
    <button type="button" className="home-minimal-link" onClick={()=>navigate("projets")}>Tout le travail <ArrowUpRight size={16}/></button>
   </div>
   {directions.length?directions.map(({board,project,revision})=>
    <article key={board.id} className="home-da-row">
     <button type="button" className="home-da-open" onClick={()=>{navigate("projets");setProjectId(project.id);}}>
      <span className="home-da-project">{project.title}</span>
      <span className="home-da-approval">{revision.approvedDirection?"Choix humain · piste "+revision.approvedDirection:"À revoir · version "+revision.number}</span>
      <ArrowUpRight size={16} aria-hidden="true"/>
     </button>
     <p><span>A</span> {revision.directions[0].title||"Sans titre"}<span className="home-da-separator"> / </span><span>B</span> {revision.directions[1].title||"Sans titre"}</p>
    </article>
   ):<div className="home-minimal-empty">
    <p>Aucune direction enregistrée ici. Commencez par une piste Radar, puis développez-la en dossier.</p>
    <button type="button" className="home-minimal-link" onClick={()=>navigate("explorer")}>Explorer le Radar <ArrowUpRight size={16}/></button>
   </div>}
  </section>

  <MarketPanel mode="home" onOpenDossier={onOpenDossier} onHomeState={receiveMarket}/>
 </div>;
}

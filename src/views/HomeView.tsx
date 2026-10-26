import { MarketPanel } from "../scout-market/MarketPanel";
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
   title:"Vérifier le Radar",
   detail:"Consultez les signaux disponibles, leurs sources et leurs inconnues. Ouvrez un dossier si une piste mérite votre travail.",
   label:"Ouvrir le Radar",
   run:()=>navigate("explorer"),
 };
 return <div className="home-minimal">
  <header className="home-minimal-heading">
   <p className="eyebrow">A.D / ESPACE DE DIRECTION ARTISTIQUE</p>
   <h1>Aujourd’hui</h1>
   <p>Vos directions en cours, les pistes à examiner et ce qui évolue sur le marché.</p>
  </header>

  <section className="home-next-step" aria-label="Votre prochain pas">
   <div><p className="eyebrow">{nextStep.eyebrow}</p><h2>{nextStep.title}</h2><p>{nextStep.detail}</p></div>
   <button type="button" className="primary" onClick={nextStep.run}>{nextStep.label}<ArrowRight size={17}/></button>
  </section>

  <div className="home-workspace-grid">
   <MarketPanel mode="home" onOpenDossier={onOpenDossier}/>
   <section className="home-minimal-section" aria-label="Directions artistiques">
   <div className="home-minimal-section-heading">
    <div><p className="eyebrow">TRAVAIL EN COURS · {directions.length}</p><h2>Vos directions</h2></div>
    <button type="button" className="home-minimal-link" onClick={()=>navigate("projets")}>Ouvrir Travail <ArrowUpRight size={16}/></button>
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
    <p>Aucune direction en cours. Examinez une piste dans Radar pour ouvrir un dossier avec ses sources.</p>
    <button type="button" className="home-minimal-link" onClick={()=>navigate("explorer")}>Ouvrir Radar <ArrowUpRight size={16}/></button>
   </div>}
   </section>
  </div>
 </div>;
}

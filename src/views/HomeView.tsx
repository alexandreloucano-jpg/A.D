import { MarketPanel } from "../scout-market/MarketPanel";
import type { Finding } from "../scout-market/schema";
import type { EvidenceReceipt } from "../opportunity/model";
import { latestCreative } from "../creative/model";
import { ArrowRight, ArrowUpRight, BookmarkPlus, Compass, FolderPlus } from "lucide-react";
import type { Route } from "../display";
import type { Task, Workspace } from "../domain";

export function HomeView({data,now,navigate,setProjectId,onOpenDossier,onCapture,onCreateProject}: {
 now:Task[]; data:Workspace; navigate:(r:Route)=>void; setProjectId:(id:string|null)=>void;
 onOpenDossier:(finding:Finding,evidence:EvidenceReceipt[])=>Promise<void>;
 onCapture:()=>void; onCreateProject:()=>void;
}) {
 const directions=(data.creativeBoards||[])
   .flatMap(board=>{
     const project=data.projects.find(p=>p.id===board.projectId);
     const revision=latestCreative(board);
     return project&&revision?[{board,project,revision}]:[];
   })
   .sort((a,b)=>b.revision.createdAt.localeCompare(a.revision.createdAt));
 const projects=data.projects.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 const referenceCount=data.references.filter(reference=>!reference.isInternalQA).length;
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
 }:null;
 const showStartingPoint=projects.length===0&&directions.length===0;
 return <div className="home-minimal">
  <header className="home-minimal-heading">
   <p className="eyebrow">A.D / ESPACE DE DIRECTION ARTISTIQUE</p>
   <h1>Aujourd’hui</h1>
   <p>Vos directions en cours, les pistes à examiner et ce qui évolue sur le marché.</p>
  </header>

  {showStartingPoint?<section className="home-onboarding" aria-labelledby="home-onboarding-title">
   <div className="home-onboarding-copy">
    <p className="eyebrow">VOTRE POINT DE DÉPART</p>
    <h2 id="home-onboarding-title">Qu’est-ce que vous voulez faire avancer&nbsp;?</h2>
    <p>{referenceCount
      ? `Vous avez déjà ${referenceCount} référence${referenceCount>1?"s":""} dans votre bibliothèque. Choisissez la suite à donner.`
      : "Partez d’un brief, d’une référence ou d’une opportunité. Vous gardez la main sur chaque interprétation et décision."}</p>
   </div>
   <div className="home-onboarding-options">
    <button type="button" className="home-start-option home-start-primary" onClick={onCreateProject}>
     <span className="home-start-icon"><FolderPlus size={18}/></span>
     <span><strong>J’ai une intention ou un brief</strong><small>Ouvrir un dossier de direction</small></span>
     <ArrowRight size={17} aria-hidden="true"/>
    </button>
    <button type="button" className="home-start-option" onClick={onCapture}>
     <span className="home-start-icon"><BookmarkPlus size={18}/></span>
     <span><strong>J’ai une référence à garder</strong><small>Enregistrer un lien ou une note</small></span>
     <ArrowRight size={17} aria-hidden="true"/>
    </button>
    <button type="button" className="home-start-option" onClick={()=>navigate("explorer")}>
     <span className="home-start-icon"><Compass size={18}/></span>
     <span><strong>Je cherche une opportunité</strong><small>Examiner les signaux et leurs sources</small></span>
     <ArrowRight size={17} aria-hidden="true"/>
    </button>
   </div>
  </section>:nextStep&&<section className="home-next-step" aria-label="Votre prochain pas">
   <div><p className="eyebrow">{nextStep.eyebrow}</p><h2>{nextStep.title}</h2><p>{nextStep.detail}</p></div>
   <button type="button" className="primary" onClick={nextStep.run}>{nextStep.label}<ArrowRight size={17}/></button>
  </section>}

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
   :<div className="home-minimal-empty">
    <p>{projects.length
      ? "Aucune direction enregistrée dans vos dossiers pour le moment. Vos projets et références restent accessibles dans Travail et Bibliothèque."
      : "Vos directions apparaîtront ici lorsqu’un dossier contiendra une première version de travail."}</p>
   </div>}
   </section>
  </div>
 </div>;
}

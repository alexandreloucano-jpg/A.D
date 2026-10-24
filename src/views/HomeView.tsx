import { MarketPanel } from "../scout-market/MarketPanel";
import type { Finding } from "../scout-market/schema";
import type { EvidenceReceipt } from "../opportunity/model";
import { StudioLeadsPanel } from "../marketing/StudioLeadsPanel";
import type { RemoteSaver } from "../remote-saver";
import { ArrowUpRight, ArrowRight, Plus, Upload, MoveUpRight, Layers2, ScanEye, Bookmark, Activity } from "lucide-react";
import { dateLabel, type Route } from "../display";
import { rediscover, type Task, type Workspace } from "../domain";

/** A.D / NEW ISSUE. Operational editorial desk. All content is from the real workspace. */
export function HomeView({data,now,navigate,setProjectId,openReference,setModal,remote,onRestore,onOpenDossier}: {
  data:Workspace; now:Task[]; navigate:(r:Route)=>void; setProjectId:(id:string|null)=>void;
  openReference:(id:string)=>void; setModal:(v:"project")=>void; remote:RemoteSaver;
  onRestore:()=>void; onOpenDossier:(finding:Finding,evidence:EvidenceReceipt[])=>Promise<void>;
}) {
  const priority=now[0];
  const project=priority?data.projects.find(p=>p.id===priority.projectId):undefined;
  const pending=data.tasks.filter(t=>t.lane==="LATER").length;
  const references=rediscover(data);
  const recent=data.projects.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,4);
  const latest=references.at(-1);
  const start=()=>{
    if(project){navigate("projets");setProjectId(project.id);return;}
    if(data.projects.length){navigate("projets");return;}
    setModal("project");
  };
  return <div className="home-layout ad-v2-home ad-issue-home">
    <section className="home-focus ad-v2-focus ad-issue-stage" aria-label="Décision principale">
      <div className="ad-issue-topline">
        <span className="ad-issue-index">01 / THE DESK</span>
        <span className="ad-issue-edition">A.D PRIVATE OFFICE <span aria-hidden="true">●</span> LIVE WORKSPACE</span>
      </div>
      <div className="ad-v2-priority ad-issue-hero">
        <p className="ad-v2-overline ad-issue-kicker"><span className="ad-issue-kicker-mark" aria-hidden="true"/> YOUR NEXT MOVE / {priority?"APPROVED":"UNASSIGNED"}</p>
        <h1>{priority?priority.title:<>Aucune priorité<br/><em>en cours.</em></>}</h1>
        <p className="ad-v2-description ad-issue-lead">{priority?
          "Cette action a été validée. Elle est prête à avancer — son dossier conserve le contexte.":
          pending?pending+" piste"+(pending>1?"s":"")+" en attente de ta décision. Aucune priorité fabriquée automatiquement.":
          "Rien ne réclame une décision immédiate. Explore de nouvelles opportunités ou reprends ton travail."}</p>
        {priority?.acceptedAt&&<p className="ad-v2-date">VALIDÉE LE {dateLabel(priority.acceptedAt)}</p>}
        <button className="ad-v2-cta ad-issue-main-action" onClick={start}>
          {priority?"Continuer cette mission":data.projects.length?"Ouvrir mes dossiers":"Créer mon premier dossier"}
          <MoveUpRight size={20} aria-hidden="true"/>
        </button>
        {!data.projects.length&&<div className="ad-v2-restore ad-issue-restore">
          <span>Déjà des dossiers sur une ancienne version ?</span>
          <button type="button" onClick={onRestore}>Récupérer mes anciens dossiers <Upload size={15} aria-hidden="true"/></button>
        </div>}
      </div>
      <div className="ad-v2-counters ad-issue-numbers" aria-label="État de l'espace de travail">
        <div><Layers2 size={16} aria-hidden="true"/><strong>{String(data.projects.length).padStart(2,"0")}</strong><span>Dossiers</span></div>
        <div><ScanEye size={16} aria-hidden="true"/><strong>{String(pending).padStart(2,"0")}</strong><span>À examiner</span></div>
        <div><Bookmark size={16} aria-hidden="true"/><strong>{String(references.length).padStart(2,"0")}</strong><span>Références</span></div>
      </div>
    </section>
    <aside className="home-rail ad-v2-rail ad-issue-activity" aria-label="Intelligence et travail récent">
      <div className="ad-issue-activity-head">
        <span className="ad-issue-index">02 / THE SIGNAL</span>
        <span className="ad-issue-live"><Activity size={15} aria-hidden="true"/> SOURCED INTELLIGENCE</span>
      </div>
      <MarketPanel mode="home" onOpenDossier={onOpenDossier}/>
      <StudioLeadsPanel remote={remote}/>
      <section className="ad-issue-module">
        <div className="ad-issue-module-head"><h2>Dossiers en mouvement</h2><button aria-label="Voir les projets" onClick={()=>navigate("projets")}><ArrowUpRight size={18}/></button></div>
        {recent.length?recent.map((p,i)=><button key={p.id} className="project-row ad-issue-project" onClick={()=>{navigate("projets");setProjectId(p.id);}}>
          <span className="row-index">{String(i+1).padStart(2,"0")}</span>
          <span>{p.title}<small>{dateLabel(p.updatedAt)}</small></span>
          <ArrowUpRight size={17} aria-hidden="true"/>
        </button>):<div className="ad-v2-no-content"><p>Aucun dossier actif.</p><button className="text-button" onClick={()=>setModal("project")}>Ouvrir un dossier <Plus size={15}/></button></div>}
      </section>
      <section className="ad-issue-module">
        <div className="ad-issue-module-head"><h2>Dernière capture</h2><span className="ad-issue-module-count">{String(references.length).padStart(2,"0")}</span></div>
        {latest?<button className="reference-row ad-issue-reference" onClick={()=>openReference(latest.id)}>
          <span className="row-index">SAVER</span>
          <span>{latest.title}<small>{latest.url?"Source conservée":"Note personnelle"}</small></span>
          <ArrowUpRight size={16}/>
        </button>:<p className="ad-v2-no-content">Ta mémoire créative commence avec une capture.</p>}
      </section>
      <button className="ad-v2-plain-link ad-issue-radar-link" onClick={()=>navigate("explorer")}>Explorer le Radar <ArrowRight size={18}/></button>
    </aside>
  </div>;
}

import { MarketPanel } from "../scout-market/MarketPanel";
import type { Finding } from "../scout-market/schema";
import type { EvidenceReceipt } from "../opportunity/model";
import { StudioLeadsPanel } from "../marketing/StudioLeadsPanel";
import type { RemoteSaver } from "../remote-saver";
import { ArrowUpRight, ArrowRight, Plus, Upload, Layers2, ScanEye, Bookmark, ArrowDownRight } from "lucide-react";
import { dateLabel, type Route } from "../display";
import { rediscover, type Task, type Workspace } from "../domain";

/** A.D V4 / Operational index. Every count and title comes from the current workspace. */
export function HomeView({data,now,navigate,setProjectId,openReference,setModal,remote,onRestore,onOpenDossier}:{
  data:Workspace;now:Task[];navigate:(r:Route)=>void;setProjectId:(id:string|null)=>void;
  openReference:(id:string)=>void;setModal:(v:"project")=>void;remote:RemoteSaver;
  onRestore:()=>void;onOpenDossier:(finding:Finding,evidence:EvidenceReceipt[])=>Promise<void>;
}){
  const priority=now[0];
  const project=priority?data.projects.find(p=>p.id===priority.projectId):undefined;
  const pending=data.tasks.filter(t=>t.lane==="LATER").length;
  const references=rediscover(data);
  const recent=data.projects.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,4);
  const latest=references.at(-1);
  const act=()=>{
    if(project){navigate("projets");setProjectId(project.id);return;}
    if(data.projects.length){navigate("projets");return;}
    setModal("project");
  };
  const currentDate=new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
  return <div className="home-layout ad-v2-home v4-desk">
    <section className="home-focus ad-v2-focus v4-mission" aria-label="Décision principale">
      <div className="v4-mission-top">
        <div className="v4-micro"><span className="v4-index-no">01</span><span>THE OPERATING DESK</span></div>
        <span className="v4-desk-date">{currentDate}</span>
      </div>
      <div className="ad-v2-priority v4-mission-hero">
        <p className="ad-v2-overline v4-signal-line"><span className="v4-signal-dot" aria-hidden="true"/> {priority?"ACTION APPROUVÉE":"AUCUNE ACTION NOW"} <span className="v4-signal-slash">/</span> YOUR NEXT MOVE</p>
        <h1>{priority?priority.title:<>Aucune priorité<span className="v4-heading-break"> en cours.</span></>}</h1>
        <p className="ad-v2-description v4-mission-copy">{priority
          ?"Cette décision est enregistrée. Son dossier contient le contexte pour avancer."
          :pending?pending+" piste"+(pending>1?"s":"")+" à examiner. A.D ne transforme pas une suggestion en priorité sans ton accord."
          :"Ton espace ne contient pas d’action urgente validée. Examine le Radar ou reprends un dossier existant."}</p>
        {priority?.acceptedAt&&<p className="ad-v2-date v4-approved">APPROUVÉE · {dateLabel(priority.acceptedAt)}</p>}
        <button className="ad-v2-cta v4-action" onClick={act}>
          <span>{priority?"Continuer la mission":data.projects.length?"Voir mes dossiers":"Créer mon premier dossier"}</span>
          <ArrowUpRight size={19} aria-hidden="true"/>
        </button>
        {!data.projects.length&&<div className="ad-v2-restore v4-restore">
          <span>Dossiers créés sur un autre domaine ?</span>
          <button type="button" onClick={onRestore}>Récupérer mes anciens dossiers <Upload size={14} aria-hidden="true"/></button>
        </div>}
      </div>
      <div className="ad-v2-counters v4-mission-stats" aria-label="État réel de l'espace de travail">
        <div><span className="v4-stat-label"><Layers2 size={15}/> DOSSIERS</span><strong>{String(data.projects.length).padStart(2,"0")}</strong></div>
        <div><span className="v4-stat-label"><ScanEye size={15}/> À EXAMINER</span><strong>{String(pending).padStart(2,"0")}</strong></div>
        <div><span className="v4-stat-label"><Bookmark size={15}/> RÉFÉRENCES</span><strong>{String(references.length).padStart(2,"0")}</strong></div>
      </div>
      <p className="v4-stage-foot">Source : ton espace privé. Aucun chiffre de démonstration.</p>
    </section>
    <aside className="home-rail ad-v2-rail v4-intelligence" aria-label="Radar et travail récent">
      <div className="v4-panel-head">
        <div className="v4-micro"><span className="v4-index-no">02</span><span>THE INTELLIGENCE INDEX</span></div>
        <span className="v4-panel-icon"><ArrowDownRight size={18}/></span>
      </div>
      <div className="v4-panel-intro"><h2>What matters now.</h2><p>Des opportunités vérifiables, puis ton travail en cours.</p></div>
      <MarketPanel mode="home" onOpenDossier={onOpenDossier}/>
      <StudioLeadsPanel remote={remote}/>
      <section className="v4-module">
        <header className="v4-module-head"><h2>Dossiers récents</h2><button aria-label="Voir les projets" onClick={()=>navigate("projets")}><ArrowUpRight size={17}/></button></header>
        {recent.length?recent.map((p,i)=><button className="project-row v4-record" key={p.id} onClick={()=>{navigate("projets");setProjectId(p.id);}}>
          <span className="v4-record-index">{String(i+1).padStart(2,"0")}</span>
          <span className="v4-record-main">{p.title}<small>{dateLabel(p.updatedAt)}</small></span>
          <ArrowUpRight size={15}/>
        </button>):<p className="v4-empty">Aucun dossier enregistré.</p>}
      </section>
      <section className="v4-module">
        <header className="v4-module-head"><h2>Dernière capture</h2><span className="v4-count">{String(references.length).padStart(2,"0")}</span></header>
        {latest?<button className="reference-row v4-record" onClick={()=>openReference(latest.id)}>
          <span className="v4-record-index">LIB</span>
          <span className="v4-record-main">{latest.title}<small>{latest.url?"Source conservée":"Note personnelle"}</small></span>
          <ArrowUpRight size={15}/>
        </button>:<p className="v4-empty">Capture une référence pour alimenter ta mémoire.</p>}
      </section>
      <button className="v4-radar-action" onClick={()=>navigate("explorer")}>Accéder au Radar <ArrowRight size={18}/></button>
    </aside>
  </div>;
}

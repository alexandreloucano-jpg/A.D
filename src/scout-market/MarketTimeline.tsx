import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { Finding } from "./schema";
import "./timeline.css";
export type DecisionEvent={event:string;reason:string|null;occurredAt:string};
export type TimelinePoint={
  id:string;date:string;type:"source"|"observed"|"planned"|"decision";
  title:string;summary:string;sourceUrl?:string;
};
const valid=(s:string|null|undefined)=>!!s&&Number.isFinite(Date.parse(s));
export function marketTimelinePoints(f:Finding,history:readonly DecisionEvent[]):TimelinePoint[]{
  const points:TimelinePoint[]=[];
  if(valid(f.publishedAt))points.push({id:"published",date:f.publishedAt!,type:"source",title:"Publication source",summary:f.reportedFact,sourceUrl:f.canonicalUrl});
  if(valid(f.firstSeenAt))points.push({id:"first",date:f.firstSeenAt,type:"observed",title:"Première collecte A.D",summary:"Signal enregistré dans Radar. Cette date est celle de la collecte, pas nécessairement du fait.",sourceUrl:f.canonicalUrl});
  if(valid(f.eventDate))points.push({id:"event",date:f.eventDate!,type:"planned",title:"Date d'événement rapportée",summary:"Date mentionnée dans les sources : elle ne prouve pas que l'événement a effectivement eu lieu.",sourceUrl:f.canonicalUrl});
  if(valid(f.lastSeenAt)&&f.lastSeenAt!==f.firstSeenAt)points.push({id:"last",date:f.lastSeenAt,type:"observed",title:"Dernière observation",summary:"Dernier horodatage de la source connu par Radar.",sourceUrl:f.canonicalUrl});
  history.forEach((h,i)=>{
    if(valid(h.occurredAt))points.push({id:"decision-"+i,date:h.occurredAt,type:"decision",title:"Décision · "+h.event,summary:h.reason||"Historique d'action conservé par Radar."});
  });
  return points.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id.localeCompare(b.id));
}
export function MarketTimeline({finding,history}:{
  finding:Finding;history:readonly DecisionEvent[];
}){
  const entries=useMemo(()=>marketTimelinePoints(finding,history),[finding,history]);
  const [chosen,setChosen]=useState<string|null>(null);
  const rail=useRef<HTMLDivElement>(null);
  const active=entries.find(e=>e.id===chosen)||entries.at(-1);
  if(!entries.length)return <p className="market-timeline-empty">Aucun événement daté vérifiable pour ce dossier. Les sources restent accessibles ci-dessus.</p>;
  return <section className="ad-market-timeline" aria-label="Chronologie sourcée de l'entreprise">
    <header className="ad-timeline-header">
      <div><span className="ad-timeline-overline">RADAR / CHRONOLOGIE</span><h3>Ce qui a changé, et quand.</h3></div>
      <div className="ad-timeline-arrows">
        <button type="button" aria-label="Reculer dans la chronologie" onClick={()=>rail.current?.scrollBy({left:-235,behavior:"smooth"})}><ChevronLeft size={18}/></button>
        <button type="button" aria-label="Avancer dans la chronologie" onClick={()=>rail.current?.scrollBy({left:235,behavior:"smooth"})}><ChevronRight size={18}/></button>
      </div>
    </header>
    <div className="ad-timeline-track" ref={rail} aria-label="Événements datés, défilement horizontal">
      {entries.map(entry=><button type="button" className="ad-timeline-point" key={entry.id}
        data-kind={entry.type} aria-pressed={entry.id===active?.id}
        onClick={()=>setChosen(entry.id)}>
        <span className="ad-timeline-date">{new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(entry.date))}</span>
        <span className="ad-timeline-node" aria-hidden="true"/>
        <strong>{entry.title}</strong>
      </button>)}
    </div>
    {active&&<div className="ad-timeline-context" role="status">
      <span>{active.type==="decision"?"DÉCISION":active.type==="source"?"PUBLICATION":active.type==="planned"?"DATE RAPPORTÉE":"OBSERVATION"}</span>
      <p>{active.summary}</p>
      {active.sourceUrl&&<a href={active.sourceUrl} target="_blank" rel="noreferrer noopener">Vérifier la source <ExternalLink size={13} aria-hidden="true"/></a>}
    </div>}
    <p className="ad-timeline-disclaimer">Publication, observation et décision sont des événements de nature différente. Aucune causalité déduite automatiquement.</p>
  </section>;
}

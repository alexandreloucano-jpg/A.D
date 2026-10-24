import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Bookmark, Compass, Folder, House, Plus, Search, X } from "lucide-react";
import { Modal } from "../components/ui";
import type { Workspace } from "../domain";
import type { Route } from "../display";
import "./command.css";

type Command = { id:string; title:string; detail:string; section:string; keywords:string; icon:"home"|"radar"|"project"|"reference"|"capture"; run:()=>void };
export function rankCommands(items:readonly {id:string;title:string;detail:string;keywords:string}[],query:string) {
  const terms=query.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("fr").split(/\s+/).filter(Boolean);
  return items.map(item=>{
    const title=item.title.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fr");
    const corpus=(item.title+" "+item.detail+" "+item.keywords).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fr");
    if(terms.some(term=>!corpus.includes(term)))return {item,score:-1};
    return {item,score:terms.reduce((score,term)=>score+(title.startsWith(term)?6:title.includes(term)?3:1),0)};
  }).filter(v=>v.score>=0).sort((a,b)=>b.score-a.score).map(v=>v.item);
}
const symbols={home:House,radar:Compass,project:Folder,reference:Bookmark,capture:Plus};
export function CommandPalette({open,onClose,data,navigate,openProject,openReference,searchRadar,capture}:{
  open:boolean;onClose:()=>void;data:Workspace;navigate:(route:Route)=>void;
  openProject:(id:string)=>void;openReference:(id:string)=>void;searchRadar:(query:string)=>void;capture:()=>void;
}){
  const [query,setQuery]=useState("");
  const [active,setActive]=useState(0);
  const inputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(open){setQuery("");setActive(0);const frame=requestAnimationFrame(()=>inputRef.current?.focus());return ()=>cancelAnimationFrame(frame);}},[open]);
  const actions:Command[]=useMemo(()=>[
    {id:"go-today",title:"Aujourd'hui",detail:"Voir les décisions du jour",section:"Navigation",keywords:"accueil today",icon:"home",run:()=>navigate("accueil")},
    {id:"go-radar",title:"Radar",detail:"Explorer les opportunités et leurs sources",section:"Navigation",keywords:"veille entreprises discovery",icon:"radar",run:()=>navigate("explorer")},
    {id:"go-projects",title:"Tous les dossiers",detail:"Reprendre un dossier ou CREATE",section:"Navigation",keywords:"work projets creative",icon:"project",run:()=>navigate("projets")},
    {id:"go-library",title:"Bibliothèque",detail:"Retrouver Saver et Taste",section:"Navigation",keywords:"saver taste inspiration",icon:"reference",run:()=>navigate("saver")},
    {id:"new-reference",title:"Capturer une référence",detail:"Enregistrer une idée ou une URL",section:"Action",keywords:"nouveau créer enregistrer",icon:"capture",run:capture},
  ],[navigate,capture]);
  const all:Command[]=useMemo(()=>[
    ...actions,
    ...data.projects.map(p=>({id:"project-"+p.id,title:p.title,detail:"Dossier · "+new Date(p.updatedAt).toLocaleDateString("fr-FR"),section:"Dossiers",keywords:"projet work create",icon:"project" as const,run:()=>openProject(p.id)})),
    ...data.references.filter(r=>!r.isInternalQA).map(r=>({id:"ref-"+r.id,title:r.title,detail:r.url?"Référence enregistrée · source disponible":"Note sauvegardée",section:"Références",keywords:r.content.slice(0,500)+" "+(r.url||""),icon:"reference" as const,run:()=>openReference(r.id)})),
    ...data.signals.map(s=>({id:"signal-"+s.id,title:s.brand,detail:"Signal manuel · "+s.occurredAt,section:"Signaux",keywords:s.observedFact,icon:"radar" as const,run:()=>searchRadar(s.brand)})),
  ],[actions,data.projects,data.references,data.signals,openProject,openReference,searchRadar]);
  const results=rankCommands(all,query).slice(0,12) as Command[];
  const q=query.trim();
  if(q)results.push({id:"radar-search",title:'Rechercher « '+q.slice(0,80)+' » dans Radar',detail:"Recherche dans les données Radar disponibles",section:"Recherche",keywords:"",icon:"radar",run:()=>searchRadar(q)});
  const run=(item:Command)=>{onClose();item.run();};
  if(!open)return null;
  return <Modal title="Rechercher dans A.D" close={onClose}>
    <div className="ad-command" onKeyDown={e=>{
      if(e.key==="ArrowDown"){e.preventDefault();setActive(i=>Math.min(i+1,results.length-1));}
      if(e.key==="ArrowUp"){e.preventDefault();setActive(i=>Math.max(0,i-1));}
      if(e.key==="Enter"&&results.length){e.preventDefault();run(results[Math.min(active,results.length-1)]);}
    }}>
      <label className="ad-command-input"><Search size={18} aria-hidden="true"/>
        <input ref={inputRef} role="combobox" aria-label="Rechercher partout" aria-expanded="true"
          aria-controls="ad-command-results" aria-activedescendant={results[active]?"ad-command-"+results[active].id:undefined}
          value={query} placeholder="Dossier, référence, entreprise, action…"
          onChange={e=>{setQuery(e.target.value);setActive(0);}} autoComplete="off"/>
        {q&&<button type="button" aria-label="Effacer la recherche universelle" onClick={()=>{setQuery("");setActive(0);inputRef.current?.focus();}}><X size={16}/></button>}
      </label>
      <div id="ad-command-results" role="listbox" aria-label="Résultats de la recherche" className="ad-command-results">
        {results.length?results.map((item,i)=>{
          const Icon=symbols[item.icon];
          return <button key={item.id} id={"ad-command-"+item.id} type="button" role="option"
            aria-selected={i===active} className="ad-command-option" data-active={i===active}
            onMouseEnter={()=>setActive(i)} onClick={()=>run(item)}>
            <Icon size={18} aria-hidden="true"/>
            <span><strong>{item.title}</strong><small>{item.section} · {item.detail}</small></span>
            <ArrowUpRight size={15} aria-hidden="true"/>
          </button>;
        }):<p className="ad-command-empty">Aucun résultat dans cet espace. Essaie une recherche Radar.</p>}
      </div>
      <p className="ad-command-foot"><span>↑ ↓ naviguer · Entrée ouvrir · Échap fermer</span><span>⌘ K / Ctrl K</span></p>
    </div>
  </Modal>;
}

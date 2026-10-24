import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Download, RefreshCw, Sparkles } from "lucide-react";
import type { Reference, Workspace } from "../domain";
import type { RemoteSaver } from "../remote-saver";
import { directImageUrl } from "../media";
import {
  blankDirections, creativeAIResponse, creativeStartingPoints,
  latestCreative, nextCreativeRevision,
  type CreativeDirection, type CreativeRevision,
} from "./model";
import "./canvas.css";

function exportTreatment(name: string, value: CreativeRevision, references: Reference[]) {
  const sources=value.referenceIds.map(id => {
    const ref=references.find(r=>r.id===id);
    return ref ? "- "+ref.title+" — "+(ref.url||"Note sauvegardée dans A.D")+" (capturée "+ref.capturedAt+")" : "- Référence "+id+" (inaccessible sur cet appareil)";
  });
  return [
    "# A.D / "+name+" — Creative treatment", "",
    "Version "+value.number+" · "+value.createdAt+" · "+(value.approvedDirection ? "Piste validée : "+value.approvedDirection : "Brouillon non validé"), "",
    "## Brief",value.brief,"",
    ...value.directions.flatMap(dir => [
      "## "+dir.letter+" — "+dir.title,
      "**Thèse**",dir.thesis,"",
      "**Grammaire visuelle**",dir.visualGrammar,"",
      "**Production / contraintes**",dir.production,"",
    ]),
    "## Références", ...sources,"",
    "## Points non vérifiés",...(value.unknowns.length?value.unknowns.map(x=>"- "+x):["- Aucun point consigné"]), "",
    "Provenance : "+value.origin,
    "Document interne. Sources à vérifier et droits d'utilisation à obtenir avant diffusion.",
  ].join("\n");
}
type Props={
  project: Workspace["projects"][number];
  data:Workspace;
  references:Reference[];
  remote:RemoteSaver;
  commit:(data:Workspace,message:string)=>boolean;
  openReference:(id:string)=>void;
  capture:()=>void;
};
export function CreativeCanvas({project,data,references,remote,commit,openReference,capture}:Props) {
  const board=data.creativeBoards?.find(b=>b.projectId===project.id);
  const latest=latestCreative(board);
  const [brief,setBrief]=useState(latest?.brief??"");
  const [selectedIds,setSelectedIds]=useState<string[]>(latest?.referenceIds??[]);
  const [directions,setDirections]=useState<[CreativeDirection,CreativeDirection]>(latest?.directions??blankDirections());
  const [origin,setOrigin]=useState<CreativeRevision["origin"]>(latest?.origin??"HUMAN");
  const [aiProvenance,setAiProvenance]=useState<CreativeRevision["aiProvenance"]>(latest?.aiProvenance);
  const [aiStatus,setAiStatus]=useState<{available:boolean;provider:string|null}|null>(null);
  const [consent,setConsent]=useState(false);
  const [unknowns,setUnknowns]=useState<string[]>(latest?.unknowns??[]);
  const [working,setWorking]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [sourceQuery,setSourceQuery]=useState("");
  const sourceSet=new Set(selectedIds);
  const visibleRefs=references.filter(r=>!r.isInternalQA && (sourceSet.has(r.id) || (r.title+" "+r.content).toLocaleLowerCase().includes(sourceQuery.toLocaleLowerCase()))).sort((a,b)=>
    Number(sourceSet.has(b.id))-Number(sourceSet.has(a.id))
    || Number(b.projectId===project.id)-Number(a.projectId===project.id)
    || b.capturedAt.localeCompare(a.capturedAt)).slice(0,100);
  const chosenRefs=selectedIds.map(id=>references.find(r=>r.id===id)).filter((r):r is Reference=>!!r);
  const lastFields=latest?JSON.stringify({brief:latest.brief,referenceIds:latest.referenceIds,directions:latest.directions,unknowns:latest.unknowns,origin:latest.origin}):"";
  const currentFields=JSON.stringify({brief:brief.trim(),referenceIds:selectedIds,directions,unknowns,origin});
  const unsaved=!latest||lastFields!==currentFields;
  useEffect(()=>{
    if(!remote.connected){setAiStatus(null);return;}
    let active=true;
    void remote.reader<{available:boolean;provider:string|null}>("/api/creative/draft")
      .then(status=>{if(active)setAiStatus(status);})
      .catch(()=>{if(active)setAiStatus(null);});
    return ()=>{active=false;};
  },[remote.connected]);
  function updateDirection(index:0|1,field:"title"|"thesis"|"visualGrammar"|"production",value:string) {
    setDirections(prev=>prev.map((d,i)=>i===index?{...d,[field]:value}:d) as [CreativeDirection,CreativeDirection]);
    setError("");
  }
  function updateSource(id:string,selected:boolean) {
    setSelectedIds(prev=>selected
      ? prev.includes(id)?prev:prev.length>=8?prev:[...prev,id]
      : prev.filter(x=>x!==id));
    setError("");
  }
  function seed() {
    if(brief.trim().length<30){setError("Précisez le brief (30 caractères minimum).");return;}
    const draft=creativeStartingPoints(brief,chosenRefs.map(r=>r.title));
    setDirections(draft);
    setOrigin("STRUCTURED_TEMPLATE");
    setAiProvenance(undefined);
    setUnknowns([]);
    setError("");
    setMessage("Deux pistes préparées sans IA. Elles doivent être réécrites et vérifiées.");
  }
  async function generate() {
    if(!consent || !remote.connected || !aiStatus?.available)return;
    if(brief.trim().length<30){setError("Le brief doit contenir au moins 30 caractères.");return;}
    if(chosenRefs.length===0){setError("Choisissez au moins une référence avant de demander un traitement IA.");return;}
    setWorking(true);setError("");setMessage("");
    try {
      const reply=creativeAIResponse.parse(await remote.reader("/api/creative/draft","POST",{
        projectName:project.title,brief:brief.trim(),
        references:chosenRefs.map(r=>({id:r.id,title:r.title,note:r.content.slice(0,800),url:r.url||null})),
      }));
      setDirections(reply.directions);
      setOrigin("CONFIGURED_AI");
      setAiProvenance(reply.provenance);
      setUnknowns(reply.unknowns);
      setMessage("Deux brouillons générés. Aucun n'est enregistré ni approuvé automatiquement.");
    } catch(e){setError(e instanceof Error?e.message:"Génération interrompue. Vos saisies restent en place.");}
    finally{setWorking(false);}
  }
  function persist(approval:"A"|"B"|null=null) {
    setError("");setMessage("");
    if(brief.trim().length<30){setError("Brief incomplet : au moins 30 caractères.");return;}
    if(directions.some(d=>!d.title.trim()||!d.thesis.trim()||!d.visualGrammar.trim())) {
      setError("Chaque piste exige un titre, une thèse et une grammaire visuelle.");return;
    }
    if(approval && unsaved){setError("Enregistrez cette version avant de valider une direction.");return;}
    if(approval && !latest){setError("Aucune version enregistrée à approuver.");return;}
    if(!approval && !unsaved){setMessage("Cette version est déjà enregistrée.");return;}
    try {
      const result=nextCreativeRevision(board,project.id,{
        brief:brief.trim(),referenceIds:selectedIds,directions,unknowns,
        origin, ...(origin==="CONFIGURED_AI"&&aiProvenance?{aiProvenance}:{}),
      },approval);
      const done=commit({
        ...data,creativeBoards:[...(data.creativeBoards||[]).filter(b=>b.projectId!==project.id),result],
        projects:data.projects.map(p=>p.id===project.id?{...p,updatedAt:new Date().toISOString()}:p),
      },approval?"Direction "+approval+" approuvée et historique conservé.":"Direction artistique enregistrée sur cet appareil.");
      if(done)setMessage(approval?"Piste "+approval+" validée. Aucun document envoyé.":"Version "+result.revisions.length+" enregistrée localement.");
      else setError("Sauvegarde non confirmée. Le brouillon reste affiché.");
    }catch(e){setError(e instanceof Error?e.message:"Sauvegarde refusée. Le brouillon reste disponible.");}
  }
  function restore(revision:CreativeRevision) {
    setBrief(revision.brief);setDirections(revision.directions);
    setSelectedIds(revision.referenceIds);
    setOrigin("HUMAN");setAiProvenance(undefined);setUnknowns(revision.unknowns);
    setMessage("Version "+revision.number+" reprise en brouillon. Enregistrez pour créer une nouvelle version.");
    setError("");
  }
  function downloadText() {
    if(!latest || unsaved){setError("Enregistrez la version avant de l'exporter.");return;}
    const slug=project.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").slice(0,40);
    const blob=new Blob([exportTreatment(project.title,latest,references)],{type:"text/markdown;charset=utf-8"});
    const href=URL.createObjectURL(blob);const a=document.createElement("a");
    a.href=href;a.download="AD-"+(slug||"dossier")+"-creative-v"+latest.number+".md";a.click();
    setTimeout(()=>URL.revokeObjectURL(href),1000);
  }
  return <section className="ad-create" aria-label="Creative Canvas A.D">
    <header className="ad-create-head">
      <div><p className="ad-create-kicker">A.D / CREATE  ·  CREATIVE CANVAS</p>
        <h2>Construire la direction.</h2>
        <p>Références → deux traitements → revue humaine → livrable. Pas de génération ni de validation implicite.</p>
      </div>
      <div className="ad-create-state"><span>{latest?"VERSION "+String(latest.number).padStart(2,"0"):"NOUVEAU DOSSIER"}</span>
        <strong>{latest?.approvedDirection?"PISTE "+latest.approvedDirection+" VALIDÉE": "BROUILLON"}</strong>
      </div>
    </header>
    <div className="ad-create-workflow" aria-label="Étapes du traitement"><span>01 / BRIEF</span><span>02 / SOURCES</span><span>03 / DIRECTIONS</span><span>04 / APPROBATION</span></div>
    <div className="ad-create-source-top" id="work-sources" tabIndex={-1}>
      <div><h3>Références sélectionnées</h3><p>Sources réellement enregistrées dans Saver. Choisir jusqu'à huit références.</p></div>
      <button className="text-button" onClick={capture}>Capturer une référence <ArrowUpRight size={15}/></button>
    </div>
    <label className="work-source-search">Retrouver une référence Saver
      <input type="search" value={sourceQuery} onChange={e=>setSourceQuery(e.target.value)} placeholder="Titre ou note…" />
    </label>
    <p className="work-source-count">{selectedIds.length} / 8 sélectionnées · Enregistrez une version pour conserver ce choix.</p>
    {visibleRefs.length ? <div className="ad-create-source-grid">
      {visibleRefs.map(ref=>{
        const image=directImageUrl(ref.url);
        return <label key={ref.id} className={"ad-create-ref"+(sourceSet.has(ref.id)?" is-selected":"")}>
          <div className="ad-create-ref-visual">
            {image?<img loading="lazy" src={image} alt="" referrerPolicy="no-referrer"/>:<div className="ad-create-ref-fallback">A.D / SOURCE</div>}
            <input type="checkbox" aria-label={"Sélectionner "+ref.title} checked={sourceSet.has(ref.id)}
              disabled={!sourceSet.has(ref.id)&&selectedIds.length>=8}
              onChange={e=>updateSource(ref.id,e.target.checked)}/>
          </div>
          <strong title={ref.title}>{ref.title}</strong>
          <small>{ref.url?"Lien sauvegardé":"Note personnelle"} · {new Date(ref.capturedAt).toLocaleDateString("fr-FR")}</small>
          <button type="button" className="ad-create-open" aria-label="Lire la source ↗" onClick={e=>{e.preventDefault();openReference(ref.id);}}>Lire la source <ArrowUpRight size={14} aria-hidden="true"/></button>
        </label>;
      })}
    </div>:<p className="ad-create-empty">{sourceQuery ? "Aucune référence ne correspond. Modifiez votre recherche ou capturez une source." : "Aucune référence enregistrée. Vous pouvez rédiger le brief, puis capturer les premières sources dans Saver."}</p>}
    <div className="ad-create-brief" id="work-brief" tabIndex={-1}>
      <label htmlFor="ad-create-brief">L'intention créative</label>
      <textarea id="ad-create-brief" rows={3} maxLength={3000} value={brief}
        placeholder="Quelle maison, quel problème, quel public, quel objet doit devenir désirable, et pourquoi maintenant ?"
        onChange={e=>{setBrief(e.target.value);setError("");}}/>
      <small>{brief.trim().length} / 3 000 caractères · Visible uniquement dans ce dossier local tant que vous ne demandez pas l'assistance IA.</small>
    </div>
    <div className="ad-create-actions">
      <button type="button" className="ad-create-neutral" onClick={seed}>Préparer le canevas (sans IA)</button>
      <button type="button" className="ad-create-ai" disabled={!remote.connected||!aiStatus?.available||working||!consent} onClick={()=>void generate()}>
        {working?<RefreshCw size={16}/>:<Sparkles size={16}/>} Générer deux pistes avec IA
      </button>
    </div>
    <label className="ad-create-consent">
      <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
      J'autorise l'envoi de ce brief et des notes des références sélectionnées au fournisseur IA configuré pour préparer un brouillon.
    </label>
    <p className="ad-create-ai-status">{remote.connected
      ? aiStatus?.available?"Assistance IA configurée : "+(aiStatus.provider||"fournisseur non identifié")+". Coût et quota serveur applicables."
        :"IA non configurée : édition et canevas sans IA disponibles."
      :"Espace local : connectez la session propriétaire pour utiliser l'IA. Aucun contenu transmis."}</p>
    <div className="ad-create-direction-grid">
      {directions.map((dir,index)=><article key={dir.letter} className="ad-create-direction">
        <div className="ad-create-direction-top"><span>{dir.letter} / TERRITOIRE</span>
          {latest?.approvedDirection===dir.letter&&!unsaved&&<strong><Check size={14}/> APPROUVÉE</strong>}</div>
        <label>Nom de la direction<input maxLength={100} value={dir.title} placeholder={index===0?"Un territoire culturel":"Une signature iconique"}
          onChange={e=>updateDirection(index as 0|1,"title",e.target.value)}/></label>
        <label>Thèse créative<textarea rows={4} maxLength={1800} value={dir.thesis}
          placeholder="Que raconte cette direction ? Quelle tension ou désir construit-elle ?"
          onChange={e=>updateDirection(index as 0|1,"thesis",e.target.value)}/></label>
        <label>Grammaire visuelle<textarea rows={4} maxLength={1800} value={dir.visualGrammar}
          placeholder="Lumière, matières, couleur, composition, casting, typographie…"
          onChange={e=>updateDirection(index as 0|1,"visualGrammar",e.target.value)}/></label>
        <label>Production et contraintes<textarea rows={3} maxLength={1800} value={dir.production}
          placeholder="Livrables, lieux, équipe, droits et coûts restant à vérifier."
          onChange={e=>updateDirection(index as 0|1,"production",e.target.value)}/></label>
        <button type="button" className="ad-create-approve" disabled={!latest||unsaved||latest.approvedDirection===dir.letter}
          onClick={()=>persist(dir.letter)}>Valider la direction {dir.letter} <ArrowUpRight size={15}/></button>
      </article>)}
    </div>
    {!!unknowns.length&&<div className="ad-create-unknowns"><strong>Points non vérifiés après assistance IA</strong>
      <ul>{unknowns.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
    {error&&<p role="alert" className="ad-create-error">{error}</p>}
    {message&&<p role="status" className="ad-create-message">{message}</p>}
    <div className="ad-create-footer">
      <button type="button" className="ad-create-save" onClick={()=>persist(null)}>Enregistrer une version <ArrowUpRight size={15}/></button>
      <button type="button" className="ad-create-neutral" onClick={downloadText} disabled={!latest||unsaved}><Download size={16}/> Exporter le traitement</button>
    </div>
    {board&&<details className="ad-create-history"><summary>Historique des versions ({board.revisions.length})</summary>
      {board.revisions.slice().reverse().map(rev=><div className="ad-create-revision" key={rev.id}>
        <div><strong>V{rev.number} · {new Date(rev.createdAt).toLocaleString("fr-FR")}</strong>
        <p>{rev.origin==="CONFIGURED_AI"?"Brouillon assisté par IA":rev.origin==="STRUCTURED_TEMPLATE"?"Canevas structuré":"Création manuelle"}{rev.approvedDirection?" · Piste "+rev.approvedDirection+" approuvée":""}</p></div>
        <button type="button" onClick={()=>restore(rev)}>Reprendre</button>
      </div>)}
    </details>}
    <p className="ad-create-privacy">Les versions et validations sont enregistrées dans la sauvegarde locale A.D, pas dans un CRM ni une société tierce. Les rendus externes doivent être capturés via Saver avec leur provenance et leurs droits d'usage. Aucun contrat, publication ou prise de participation n'est généré automatiquement.</p>
  </section>;
}

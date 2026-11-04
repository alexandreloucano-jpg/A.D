
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Download } from "lucide-react";
import "./launch-lab.css";

type Field = "product" | "audience" | "loved" | "hated" | "enemy" | "status" | "customerWords" | "claim" | "source" | "demo" | "demoUrl" | "metric" | "contacts";
type Brief = Record<Field, string>;
const initial: Brief = {product:"",audience:"",loved:"",hated:"",enemy:"",status:"",customerWords:"",claim:"",source:"",demo:"",demoUrl:"",metric:"",contacts:""};
const storageKey = "ad.launch-lab.draft.v1";
function readDraft(): Brief {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}") as Record<string, unknown>;
    const result = {...initial};
    for (const field of Object.keys(initial) as Field[]) if (typeof saved[field] === "string") result[field] = (saved[field] as string).slice(0,5000);
    return result;
  } catch { return {...initial}; }
}
function hasUrl(value: string) { try { return ["https:","http:"].includes(new URL(value).protocol); } catch { return false; } }
function makeHooks(brief: Brief) {
  const product = brief.product.trim() || "[produit]";
  return [
    "Ce que " + (brief.audience.trim() || "[le public]") + " attend vraiment de " + product + ".",
    (brief.hated.trim() || "[Frustration du marché]") + ". Et si nous arrêtions de l'accepter ?",
    (brief.claim.trim() || "[Affirmation vérifiable]") + ". La preuve, pas la promesse.",
    "Pourquoi " + (brief.enemy.trim() || "[l'alternative actuelle]") + " n'est plus une fatalité.",
    "Voici " + product + " dans sa situation la plus exigeante. Regardez ce qui se passe."
  ];
}
export function LaunchLab() {
  const [brief,setBrief] = useState<Brief>(readDraft);
  const [notice,setNotice] = useState("");
  useEffect(() => { try {localStorage.setItem(storageKey, JSON.stringify(brief));} catch { /* Local persistence may be unavailable. */ } }, [brief]);
  const edit = (field: Field, value: string) => setBrief(current => ({...current,[field]: value.slice(0,5000)}));
  const contacts = useMemo(() => brief.contacts.split(/\r?\n/).map(x => x.trim()).filter(Boolean),[brief.contacts]);
  const gates = [
    {name:"Narrative spécifique",passed:!!(brief.product.trim() && brief.audience.trim() && brief.claim.trim())},
    {name:"Source fournie",passed:hasUrl(brief.source)},
    {name:"Preuve démontrable",passed:!!brief.demo.trim() && hasUrl(brief.demoUrl)},
    {name:"Distribution qualifiée",passed:contacts.length>=3}
  ];
  const ready = gates.every(g => g.passed);
  const hooks = makeHooks(brief);
  const field = (id: Field, label: string, placeholder: string, long=false) => <label key={id}>{label}{long ? <textarea rows={3} value={brief[id]} onChange={e=>edit(id,e.target.value)} placeholder={placeholder} maxLength={5000}/> : <input value={brief[id]} onChange={e=>edit(id,e.target.value)} placeholder={placeholder} maxLength={5000}/>}</label>;
  const payload = () => JSON.stringify({schema:"ad.launch.v1",savedAt:new Date().toISOString(),readiness:ready?"READY_FOR_REVIEW":"INCOMPLETE",brief, hooks,contacts,sourceVerification:"URL_PROVIDED_NOT_VERIFIED",status:"NO_MESSAGES_SENT_NO_POSTS_PUBLISHED"},null,2);
  const download = () => {const blob=new Blob([payload()],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="ad-launch-brief.json";a.click();URL.revokeObjectURL(url);};
  const copy = async () => {try {await navigator.clipboard.writeText(hooks.map((h,i)=>String(i+1)+". "+h).join("\n\n"));setNotice("Cinq angles copiés.");}catch{setNotice("Copie indisponible sur cet appareil.");}};
  return <div className="ad-launch">
    <header className="ad-launch-top"><a href="/#/accueil"><ArrowLeft size={15}/> A.D OFFICE</a><span>LAUNCH LAB / PRIVATE DRAFT</span></header>
    <main className="ad-launch-shell">
      <div className="ad-launch-hero"><small>A.D / NARRATIVE · PROOF · DISTRIBUTION</small><h1>Engineer the<br/><em>launch.</em></h1><p>Un lancement qui commence par une affirmation vérifiable, se poursuit par une démonstration réelle et trouve une audience qui a une raison de le relayer.</p></div>
      <div className="ad-launch-layout"><div>
        <section><small>01 / THE SIX QUESTIONS</small><h2>Understand the market before writing.</h2><div className="ad-launch-two">{field("product","Produit","Nom du lancement")}{field("audience","Public cible","Qui doit réellement s'en soucier ?")}</div>
        {field("loved","Ce que cette audience aime","Motivation vérifiée",true)}
        {field("hated","Ce qu'elle déteste","Frustration réelle",true)}
        {field("enemy","L'alternative / l'obstacle","Le problème à combattre",true)}
        {field("status","Le résultat psychologique recherché","Statut, contrôle, sécurité, liberté",true)}
        {field("customerWords","Ses mots exacts","Citations, retours, verbatim",true)}</section>
        <section><small>02 / NARRATIVE</small><h2>One defensible claim.</h2>
        {field("claim","Affirmation principale","Formule une vérité précise que l'on puisse contester ou vérifier.",true)}
        {field("source","Source primaire","https://...")}
        <p className="ad-launch-muted">Un lien renseigné n'est pas une preuve vérifiée automatiquement. Ne jamais inventer de métrique.</p></section>
        <section><small>03 / PROOF STUDIO</small><h2>Show the product at its limit.</h2>
        {field("demo","Démonstration réelle","Ce que l'utilisateur verra réellement",true)}
        {field("demoUrl","Vidéo ou preuve vérifiable","https://...")}
        {field("metric","Résultat mesuré (facultatif)","Uniquement si la mesure est documentée")}</section>
        <section><small>04 / DISTRIBUTION</small><h2>Connections over vanity metrics.</h2>
        {field("contacts","Personnes et comptes qualifiés, un par ligne","Seulement ceux dont l'audience est réellement pertinente.",true)}
        <p className="ad-launch-muted">Aucun envoi, aucune publication, aucune promesse de viralité. Le seuil des 25 contacts présenté dans la capture n'est pas une règle scientifique.</p></section>
      </div>
      <aside><section className="ad-launch-summary"><small>READINESS / 04 GATES</small><h2>{ready?"Prêt pour relecture.":"Des preuves avant le lancement."}</h2>
        {gates.map(g=><div className="ad-launch-gate" key={g.name}><CheckCircle2 size={17} color={g.passed?"#3d61ba":"#b7b9b3"}/>{g.name}</div>)}
        <div className="ad-launch-divider"/><small>FIVE HOOKS / HYPOTHESES</small>
        <ol>{hooks.map((h,i)=><li key={i}>{h}</li>)}</ol>
        <div className="ad-launch-actions"><button type="button" onClick={copy}><Copy size={15}/> Copier</button><button type="button" onClick={download}><Download size={15}/> Exporter JSON</button></div>
        {notice&&<p role="status" className="ad-launch-muted">{notice}</p>}
        <p className="ad-launch-warning">Brouillon local uniquement. Pas de synchronisation inter-appareils ni de validation automatique des sources. Vérification humaine obligatoire.</p>
      </section></aside></div>
    </main>
  </div>;
}

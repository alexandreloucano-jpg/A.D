"use client";
import {useEffect,useMemo,useState} from 'react';
import {usePathname} from 'next/navigation';
import {createPortal} from 'react-dom';
import {CAREER_CV} from './lib/careerEvidence';
import {evaluateFit,editorialSuggestions,NORM} from './lib/fitEngine';

const clean=s=>String(s??'').slice(0,12000);
const readSelection=()=>{
  for(const key of ['jf-coach-target','jf-portfolio-target','jf-apply-target']){
    try {const o=JSON.parse(sessionStorage.getItem(key)||'null');if(o?.title)return o;}catch{}
  }
  return {title:'',company:'',description:'',url:''};
};
const STATUS={documente:'Documenté dans le CV',partiel:'Partiellement démontré',non_documente:'Non démontré'};

export default function FitIntelligencePanel(){
 const pathname=usePathname(),[mount,setMount]=useState(null),[job,setJob]=useState({title:'',company:'',description:''}),[expanded,setExpanded]=useState(true),[aiStatus,setAiStatus]=useState('idle'),[aiOutput,setAiOutput]=useState(null),[note,setNote]=useState('');
 useEffect(()=>{
   if(pathname!=='/apply')return;
   const p=readSelection();setJob({title:p.title||'',company:p.company||'',description:p.description||'',url:p.url||''});
   const host=document.querySelector('main')||document.querySelector('.applyRoot')||document.body;
   const root=document.createElement('div');root.id='jf-evidence-review-root';host.prepend(root);setMount(root);
   return()=>{root.remove();setMount(null)};
 },[pathname]);
 const fit=useMemo(()=>evaluateFit(CAREER_CV,job),[job]);
 const editorial=useMemo(()=>editorialSuggestions(fit,job),[fit,job]);
 async function runReview(){
   if(!job.title||!job.description){setNote('Ajoute l’intitulé et la description complète de l’offre.');return;}
   setAiStatus('loading');setAiOutput(null);setNote('');
   try{
    const resp=await fetch('/api/fit-review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({job,claims:fit.selected.map(({id,text,context})=>({id,text,context})),requirements:fit.requirements.map(({id,label,status})=>({id,label,status}))})});
    const data=await resp.json();
    if(!resp.ok)throw new Error(data.error||'Rédaction IA indisponible.');
    setAiOutput(data);setAiStatus('done');
   }catch(e){setAiStatus('error');setNote(e.message||'Échec de la vérification.');}
 }
 const target=(pathname==='/apply'&&mount)?mount:null;
 if(!target)return null;
 return createPortal(<section className="jfEvidence" aria-label="Dossier de candidature fondé sur preuves">
   <header className="jfEvidenceTop">
     <div><span className="jfEyebrow">CANDIDATURE / CONTRÔLE QUALITÉ</span><h2>Fit &amp; rédaction</h2><p>Une offre. Des preuves vérifiables. Une candidature défendable.</p></div>
     <button onClick={()=>setExpanded(x=>!x)} className="jfToggle" aria-expanded={expanded}>{expanded?'Réduire':'Ouvrir'} <span aria-hidden>↗</span></button>
   </header>
   {expanded && <div className="jfEvidenceBody">
      <div className="jfFields">
        <label>Poste ciblé<input value={job.title} onChange={e=>{setJob(j=>({...j,title:clean(e.target.value)}));setAiOutput(null)}} placeholder="Ex. Head of Social Media" /></label>
        <label>Employeur<input value={job.company} onChange={e=>{setJob(j=>({...j,company:clean(e.target.value)}));setAiOutput(null)}} placeholder="Entreprise" /></label>
        <label className="jfDescription">Description complète de l'offre<textarea rows={4} value={job.description} onChange={e=>{setJob(j=>({...j,description:clean(e.target.value)}));setAiOutput(null)}} placeholder="Colle l'annonce intégrale pour analyser ses exigences. Sans description, le matching reste incomplet." /></label>
      </div>
      <div className="jfFitBar"><div><span className="jfEyebrow">COUVERTURE DES CRITÈRES</span><strong>{fit.coverage===null?'—':fit.coverage}<small>{fit.coverage===null?'':'%'}</small></strong></div><p>{fit.method}<br/>{fit.coverage===null?'Analyse suspendue : offre incomplète ou métier hors périmètre.':'Le CV reste déclaratif tant que les réalisations ne sont pas corroborées.'}</p></div>
      <div className="jfEvidenceGrid">
        <section><h3>Exigences de l'offre</h3>{fit.requirements.map(r=><div className="jfRequirement" key={r.id}><div><b>{r.label}</b><small className={'jfStatus jfStatus-'+r.status}>{STATUS[r.status]}</small></div><p>{r.proofs[0]?.text||r.note}</p>{r.proofs[0]&&<small className="jfOrigin">Source : {r.proofs[0].context} · déclaration du CV</small>}</div>)}</section>
        <section><h3>Arguments à retenir</h3><p className="jfSub">Positionnement conseillé : {editorial.headline}</p>{editorial.evidence.map(b=><div className="jfClaim" key={b.sourceId}><span className="jfEyebrow">{b.sourceId}</span><p>{b.proposal}</p><small>{b.why} · À confirmer avant envoi</small><button type="button" onClick={()=>navigator.clipboard?.writeText(b.proposal)} className="jfCopy">Copier</button></div>)}
        {editorial.evidence.length===0&&<p>Pas de preuve directement liée : documenter l'expérience avant rédaction.</p>}</section>
      </div>
      <div className="jfRisk"><div><h3>Relecture contradictoire</h3><p>Ce qu'un recruteur pourrait contester.</p></div><ul>{[...fit.warnings,...fit.questions.map(x=>x.question)].slice(0,7).map((x,i)=><li key={i}>{x}</li>)}{fit.warnings.length===0&&fit.questions.length===0&&<li>Vérifier la responsabilité personnelle et la mesure des résultats avant export.</li>}</ul></div>
      <div className="jfActions"><div><h3>Écriture éditoriale augmentée</h3><p>La rédaction avancée ne fonctionne que si un fournisseur IA est configuré côté serveur. Les faits restent soumis à validation.</p></div><button disabled={aiStatus==='loading'||!job.description||!job.title} onClick={runReview}>{aiStatus==='loading'?'Analyse…':'Proposer et contrôler la rédaction'}</button></div>
      {note&&<p role="alert" className="jfNote">{note}</p>}
      {aiOutput&&<div className="jfAiResults"><h3>Propositions soumises à validation</h3>{aiOutput.suggestions?.map((x,i)=><div className="jfClaim" key={i}><span className="jfEyebrow">Preuve : {x.sourceId}</span><p>{x.rewrite}</p><small>{x.rationale}</small><button className="jfCopy" onClick={()=>navigator.clipboard?.writeText(x.rewrite)}>Copier</button></div>)}<h3>Points à éclaircir</h3><ul>{aiOutput.concerns?.map((c,i)=><li key={i}>{c}</li>)}</ul><p className="jfSub">Pas d'export automatique de formulations non vérifiées.</p></div>}
   </div>}
 </section>,target);
}
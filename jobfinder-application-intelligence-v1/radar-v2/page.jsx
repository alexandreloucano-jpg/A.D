'use client';
import {useEffect,useMemo,useState} from 'react';
import './radar.css';

const clean=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const SOURCE_WARNING=new Set(['wttj','rolefinder','aggregate']);

export default function Radar(){
 const [state,setState]=useState({loading:true,data:null,error:''});
 const [filter,setFilter]=useState('all');
 const [search,setSearch]=useState('');
 const [visible,setVisible]=useState(30);
 const [refresh,setRefresh]=useState(0);

 useEffect(()=>{
  let active=true;
  const controller=new AbortController();
  setState(previous=>({...previous,loading:true,error:''}));
  fetch('/api/jobs',{cache:'no-store',signal:controller.signal})
   .then(async response=>{if(!response.ok)throw Error('Les offres sont momentanément indisponibles.');return response.json()})
   .then(data=>{if(active)setState({loading:false,data,error:''})})
   .catch(error=>{if(active&&error.name!=='AbortError')setState({loading:false,data:null,error:error.message})});
  return()=>{active=false;controller.abort()};
 },[refresh]);

 const {jobs=[],stats={},sources=[]}=state.data||{};
 const displayed=useMemo(()=>jobs.filter(job=>filter==='all'||job.tier===filter)
  .filter(job=>!search.trim()||clean([job.title,job.company,job.location,job.role,job.sector].join(' ')).includes(clean(search.trim()))),[jobs,filter,search]);

 const chooseFilter=next=>{setFilter(next);setVisible(30)};
 const openDossier=job=>{
  const target={title:job.title,company:job.company,location:job.location,description:job.description||'',url:job.url,source:job.source,date:job.date};
  try{sessionStorage.setItem('jf-intelligence-inbound',JSON.stringify(target));sessionStorage.setItem('jf-portfolio-target',JSON.stringify(target))}catch{}
  window.location.assign('/intelligence/offer');
 };

 return <main className="radar-min">
  <header className="radar-min-header">
   <a className="radar-min-brand" href="/">SANDRO SALINGER</a>
   <nav aria-label="Navigation"><a href="/apply">CV</a><a href="/studio">Studio</a></nav>
  </header>

  <section className="radar-min-content" aria-label="Radar emploi">
   <div className="radar-min-title-row">
    <div><h1>Radar<span>.</span></h1><p>Direction créative · Stratégie · Social media</p></div>
    <button className="radar-min-refresh" type="button" disabled={state.loading} onClick={()=>{setVisible(30);setRefresh(n=>n+1)}} aria-label="Actualiser les annonces" title="Actualiser les annonces">↻</button>
   </div>

   <div className="radar-min-controls">
    <div className="radar-min-tabs" role="group" aria-label="Filtrer les offres">
     <button type="button" aria-pressed={filter==='all'} onClick={()=>chooseFilter('all')}>Toutes <span>{jobs.length}</span></button>
     <button type="button" aria-pressed={filter==='priority'} onClick={()=>chooseFilter('priority')}>Priorité <span>{stats.priority||0}</span></button>
     <button type="button" aria-pressed={filter==='explore'} onClick={()=>chooseFilter('explore')}>À explorer <span>{stats.explore||0}</span></button>
    </div>
    <label className="radar-min-search"><span className="radar-min-sr">Rechercher une annonce</span><input type="search" placeholder="Rechercher" value={search} onChange={e=>{setSearch(e.target.value);setVisible(30)}}/></label>
   </div>

   {state.error&&<div className="radar-min-feedback" role="alert">{state.error} <button onClick={()=>setRefresh(n=>n+1)}>Réessayer</button></div>}
   {state.error?null:state.loading?<p className="radar-min-feedback" role="status">Recherche des offres…</p>:!displayed.length?<p className="radar-min-feedback">Aucune annonce pour cette recherche.</p>:<div className="radar-min-results">
    {displayed.slice(0,visible).map((job,i)=><article className="radar-min-job" key={`${job.id}-${job.url}-${i}`}>
     <div className="radar-min-job-main">
      <div className="radar-min-company">{job.company}{job.tier==='priority'&&<span className="radar-min-priority">PRIORITÉ</span>}</div>
      <h2>{job.title}</h2>
      <p className="radar-min-meta">{job.location||'Lieu à confirmer'}{job.role?' · '+job.role:''}{SOURCE_WARNING.has(job.sourceType)?' · Offre à vérifier':''}</p>
     </div>
     <div className="radar-min-job-actions">
      <a href={job.url} target="_blank" rel="noopener noreferrer" aria-label={`Voir l'annonce ${job.title}`}>Annonce ↗</a>
      <button type="button" onClick={()=>openDossier(job)}>Préparer le dossier</button>
     </div>
    </article>)}
    {displayed.length>visible&&<button type="button" className="radar-min-more" onClick={()=>setVisible(n=>n+30)}>Afficher 30 offres de plus</button>}
   </div>}

   {!state.loading&&!state.error&&<details className="radar-min-source-info"><summary>Sources : {stats.activeSources||0}/{stats.sourceCount||0} disponibles</summary><p>Les offres issues de répertoires sont à confirmer sur le site de l'employeur. Les métiers de design exécutant sont exclus.</p>{sources.some(s=>s.status!=='ok')&&<p>{sources.filter(s=>s.status!=='ok').map(s=>s.source).join(', ')} : temporairement indisponible.</p>}</details>}
  </section>
 </main>;
}
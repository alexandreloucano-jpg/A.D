/** Official public ATS endpoints, plus labeled independent job-board feeds. */
import {normalizeJob,rankAndFilter,fitOpportunity} from './radarCore.mjs';
const company=(type,slug,label,sector)=>({type,slug,label,company:label,sector});
export const SOURCES=[
 company('greenhouse','pinterest','Pinterest','Social / Creative'),
 company('greenhouse','thefork','TheFork','Hospitality'),
 company('greenhouse','mirakl','Mirakl','Tech / Brand'),
 company('greenhouse','blockchain','Blockchain.com','Brand'),
 company('greenhouse','wppmedia','WPP Media','Social / Influence / Agency'),
 company('greenhouse','oliver','OLIVER Agency','Creative / Social Agency'),
 company('greenhouse','artefactjobs','Artefact','Creative / Strategy Agency'),
 company('greenhouse','monks','Monks','Creative Agency'),
 company('greenhouse','dept','DEPT','Creative / Brand Agency'),
 company('greenhouse','vaynermedia','VaynerMedia','Creative / Social Agency'),
 company('greenhouse','ogilvy','Ogilvy','Communications / Strategy'),
 company('greenhouse','deliveroo','Deliveroo','Brand / Consumer'),
 company('greenhouse','braze','Braze','Brand / Marketing'),
 company('greenhouse','datadog','Datadog','Technology / Brand'),
 company('greenhouse','algolia','Algolia','Brand / Digital'),
 company('greenhouse','glossier','Glossier','Beauty / Brand'),
 company('greenhouse','fender','Fender','Culture / Music'),
 company('greenhouse','reddit','Reddit','Social / Community'),
 company('greenhouse','wise','Wise','Consumer / Brand'),
 company('greenhouse','duolingo','Duolingo','Social / Creative'),
 company('greenhouse','figma','Figma','Creative / Brand'),
 company('greenhouse','canonical','Canonical','Content / Brand'),
 company('lever','malt','Malt','Brand / Creative'),
 company('lever','biggie','Biggie','Social / Influence Agency'),
 company('lever','brevo','Brevo','Marketing'),
 company('lever','superside','Superside','Creative / Agency'),
 company('lever','wgsn','WGSN','Fashion / Strategy'),
 company('lever','farfetch','Farfetch','Fashion / Luxury'),
 company('lever','sunshinesachs','Sunshine Sachs','Culture / PR'),
 company('lever','vestiairecollective','Vestiaire Collective','Fashion / Luxury'),
 company('lever','biggie','Biggie Group','Social / Media Agency'),
 company('lever','spotify','Spotify','Music / Brand'),
 company('lever','swile','Swile','Brand / Lifestyle'),
 company('lever','contentsquare','Contentsquare','Brand / Tech'),
 company('lever','heetch','Heetch','Consumer / Brand'),
 company('lever','blablacar','BlaBlaCar','Brand / Consumer'),

 company('ashby','deliveroo','Deliveroo','Brand / Campaign'),
 company('ashby','doctolib','Doctolib','Brand / Health'),
 company('ashby','hcompany','H Company','Brand / AI'),
 company('ashby','nabla','Nabla','Brand / Health'),
 company('ashby','alan','Alan','Brand / Health'),
 company('ashby','voodoo','Voodoo','Creative / Digital'),
 company('ashby','qonto','Qonto','Brand / Digital'),
 company('ashby','backmarket','Back Market','Lifestyle / Brand'),
 company('ashby','webflow','Webflow','Brand / Creative'),
 company('ashby','lemlist','Lemlist','Brand / Marketing'),
 company('ashby','ledger','Ledger','Brand / Web3'),
 company('ashby','photoroom','Photoroom','Creative / AI'),
 company('ashby','joko','Joko','Consumer / Brand'),
 company('ashby','mistral.ai','Mistral AI','Technology / Brand'),
 company('ashby','jellyfishcareers','Jellyfish','Agency'),
 company('ashby','linear','Linear','Digital Brand'),
 company('ashby','notion','Notion','Digital Brand'),
 company('ashby','ramp','Ramp','Brand / Social'),
 company('ashby','synthesia','Synthesia','Creative / Video Strategy'),
 company('ashby','perplexity','Perplexity','Brand / Technology'),
 company('ashby','elevenlabs','ElevenLabs','Brand / Creative'),
 company('smart','Accor','Accor','Hospitality'),
 company('smart','LVMH','LVMH','Luxury'),
 {type:'aggregate',slug:'arbeitnow',label:'Arbeitnow',company:'',sector:'Cross-company'},
 {type:'aggregate',slug:'arbeitnow',page:2,label:'Arbeitnow / page 2',company:'',sector:'Cross-company'},
 {type:'aggregate',slug:'arbeitnow',page:3,label:'Arbeitnow / page 3',company:'',sector:'Cross-company'},
 {type:'aggregate',slug:'arbeitnow',page:4,label:'Arbeitnow / page 4',company:'',sector:'Cross-company'},
 {type:'aggregate',slug:'remotive',label:'Remotive',company:'',sector:'Remote'},
 {type:'aggregate',slug:'jobicy',label:'Jobicy',company:'',sector:'Remote'},
 {type:'aggregate',slug:'himalayas',label:'Himalayas',company:'',sector:'Remote'},
 {type:'rolefinder',slug:'marketing/paris',label:'RoleFinder / Paris',company:'',sector:'Marketing, social & brand'},
 {type:'rolefinder',slug:'marketing/france',label:'RoleFinder / France',company:'',sector:'Marketing, social & brand'},
 {type:'rolefinder',slug:'marketing/remote',label:'RoleFinder / Remote',company:'',sector:'Marketing, social & brand'},
];
export const WATCHLIST=[
 {name:'Welcome to the Jungle',url:'https://www.welcometothejungle.com/fr/jobs',sector:'Stratégie / Brand / Social',status:'manual'},
 {name:'FashionJobs France',url:'https://fr.fashionjobs.com/s/',sector:'Mode / Luxe / Beauté',status:'manual'},
 {name:'APEC',url:'https://www.apec.fr/candidat/recherche-emploi.html/emploi',sector:'Cadres / Direction',status:'manual'},
 {name:'RoleFinder Paris',url:'https://jobs.urbanodx.com/jobs/marketing/paris',sector:'Marketing / Brand Paris',status:'manual'},
 {name:'Lemens & Partners',url:'https://lemensandpartners.com/en/offers/',sector:'Luxury / Creative',status:'manual'},
 {name:'MCG Luxury',url:'https://www.mcg-luxury.fr/nos-offres-emploi/',sector:'Luxury',status:'manual'},
 {name:'Beyond Talent',url:'https://beyondtalentrecruitment.com/fashion-jobs',sector:'Fashion / Executive',status:'manual'},
 {name:'LVMH Careers',url:'https://www.lvmh.com/talents',sector:'Luxury',status:'manual'},
 {name:'Kering Careers',url:'https://www.kering.com/en/talent/job-offers/',sector:'Luxury',status:'manual'},
 {name:'BoF Careers',url:'https://www.businessoffashion.com/careers/',sector:'Fashion',status:'manual'},
];
function boardUrl(s){switch(s.type){
 case 'greenhouse':return `https://boards-api.greenhouse.io/v1/boards/${s.slug}/jobs?content=true`;
 case 'lever':return `https://api.lever.co/v0/postings/${s.slug}?mode=json`;
 case 'ashby':return `https://api.ashbyhq.com/posting-api/job-board/${s.slug}`;
 case 'smart':return `https://api.smartrecruiters.com/v1/companies/${s.slug}/postings?limit=100`;
 case 'rolefinder':return `https://jobs.urbanodx.com/jobs/${s.slug}`;
 case 'aggregate':return ({arbeitnow:'https://www.arbeitnow.com/api/job-board-api'+(s.page?'?page='+s.page:''),remotive:'https://remotive.com/api/remote-jobs?limit=450',jobicy:'https://jobicy.com/api/v2/remote-jobs?count=100',himalayas:'https://himalayas.app/jobs/api?limit=100'})[s.slug];
 default:throw Error('Unknown source')
}}
const text=(v)=>typeof v==='string'?v:String(v||'');
function parseFrom(s,data){
 let jobs=[];
 if(s.type==='greenhouse')jobs=(data.jobs||[]).map(j=>({id:j.id,title:j.title,location:j.location?.name,date:j.first_published||'',description:j.content,url:j.absolute_url}));
 if(s.type==='lever')jobs=(Array.isArray(data)?data:[]).map(j=>({id:j.id,title:j.text,location:[j.categories?.location,j.country].filter(Boolean).join(', '),date:j.createdAt?new Date(j.createdAt).toISOString():'',description:j.descriptionPlain||j.descriptionBodyPlain,url:j.hostedUrl,workplaceType:j.workplaceType}));
 if(s.type==='ashby')jobs=(data.jobs||[]).filter(j=>j.isListed!==false).map(j=>({id:j.id,title:j.title,location:[j.location,...(j.secondaryLocations||[]).map(x=>x.location)].filter(Boolean).join(' / '),date:j.publishedAt||'',description:j.descriptionPlain||j.descriptionHtml,url:j.jobUrl,workplaceType:j.workplaceType||(j.isRemote?'Remote':'')}));
 if(s.type==='smart')jobs=(data.content||[]).map(j=>({id:j.id,title:j.name,location:j.location?.fullLocation||[j.location?.city,j.location?.country].filter(Boolean).join(', '),date:j.releasedDate||'',description:j.defaultJobAd?.sections?.jobDescription?.text||'',url:j.id?`https://jobs.smartrecruiters.com/${s.slug}/${j.id}`:''}));
 if(s.type==='aggregate'&&s.slug==='arbeitnow')jobs=(data.data||[]).map(j=>({id:j.slug,title:j.title,company:j.company_name,location:j.location||(j.remote?'Remote':''),date:j.created_at?new Date(j.created_at*1000).toISOString():'',description:j.description,url:j.url,workplaceType:j.remote?'Remote':''}));
 if(s.type==='aggregate'&&s.slug==='remotive')jobs=(data.jobs||[]).map(j=>({id:j.id,title:j.title,company:j.company_name,location:j.candidate_required_location||'Remote',date:j.publication_date||'',description:j.description,url:j.url,workplaceType:'Remote'}));
 if(s.type==='aggregate'&&s.slug==='jobicy')jobs=(data.jobs||[]).map(j=>({id:j.id,title:j.jobTitle,company:j.companyName,location:j.jobGeo||'Remote',date:j.pubDate||'',description:j.jobDescription,url:j.url,workplaceType:'Remote'}));
 if(s.type==='aggregate'&&s.slug==='himalayas')jobs=(data.jobs||[]).map(j=>({id:j.guid||j.id,title:j.title,company:j.companyName,location:(j.locationRestrictions||[]).map(x=>x.name||x).join(', ')||'Remote',date:typeof j.pubDate==='number'?new Date(j.pubDate*1000).toISOString():j.pubDate||'',description:j.description,url:j.applicationLink||j.url,workplaceType:'Remote'}));
 return jobs.slice(0,550).map(j=>normalizeJob(j,s)).filter(Boolean);
}
/** Public index secondary source. Follow only candidate items, then use the employer's official apply link.
 * Search-index access explicitly permitted in RoleFinder robots; do not collect account pages.
 * These records are always exploratory until independently confirmed by the employer.
 */
const htmlEntity=(s)=>String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(?:x27|39);|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ');
const tagValue=(html,name)=>{const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=html.match(new RegExp('<li>\\s*<span class="k">'+escaped+'</span>([\\s\\S]*?)</li>','i'));return m?htmlEntity(m[1].replace(/<[^>]+>/g,' ').trim()):''};
export function parseRoleFinderIndex(html){
 const scripts=[...String(html).matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
 for(const match of scripts){try{const data=JSON.parse(match[1]);if(data['@type']==='ItemList'&&Array.isArray(data.itemListElement))return data.itemListElement.filter(x=>x.url?.startsWith('https://jobs.urbanodx.com/job/')&&x.name).map(x=>({title:htmlEntity(x.name),url:x.url}))}catch{}}
 return [];
}
export function parseRoleFinderDetail(html,listing){
 const h=String(html),a=h.match(/<a\b[^>]*data-click="apply"[^>]*>/i),button=a?.[0]||'';
 const apply=htmlEntity(button.match(/\bhref="([^"]+)"/)?.[1]||'');
 let u;try{u=new URL(apply)}catch{return null}
 if(u.protocol!=='https:'||u.username||u.password||u.hostname==='jobs.urbanodx.com')return null;
 const company=htmlEntity(h.match(/<p class="company-line"><a[^>]*>([^<]+)<\/a><\/p>/i)?.[1]||button.match(/data-co="([^"]+)"/i)?.[1]||'').trim();
 const title=htmlEntity(h.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]||listing.title).trim();
 const location=tagValue(h,'Location');const workplaceType=tagValue(h,'Work type');
 if(!company||!title||!location)return null;
 const dateLabel=tagValue(h,'Posted');const date=dateLabel&&Number.isFinite(new Date(dateLabel).valueOf())?new Date(dateLabel).toISOString():'';
 // Deliberately avoid reproducing a third-party job description: fetch it at employer source when needed.
 return {title,company,location,workplaceType,date,url:u.href,description:'',id:u.href,secondaryUrl:listing.url};
}
async function getRoleFinder(s,limitMs){
 const start=Date.now();try{
  const index=await fetch(boardUrl(s),{headers:{'user-agent':'CareerPortfolioRadar/3.0 (job index, source links)','accept':'text/html'},cache:'no-store',signal:AbortSignal.timeout(limitMs)});
  if(!index.ok)throw Error('HTTP '+index.status);
  const entries=parseRoleFinderIndex(await index.text()).filter(x=>fitOpportunity({title:x.title}).tier!=='rejected');
  // Cap requests and avoid mirroring complete site. Best title matches first.
  const candidates=entries.sort((a,b)=>fitOpportunity({title:b.title}).score-fitOpportunity({title:a.title}).score).slice(0,16);
  const jobs=[];
  for(let i=0;i<candidates.length;i+=8){
   const chunk=await Promise.all(candidates.slice(i,i+8).map(async entry=>{
    try{const response=await fetch(entry.url,{headers:{'user-agent':'CareerPortfolioRadar/3.0 (job index, source links)'},cache:'no-store',signal:AbortSignal.timeout(Math.min(4500,limitMs))});return response.ok?parseRoleFinderDetail(await response.text(),entry):null}catch{return null}
   }));
   for(const j of chunk){if(!j)continue;const item=normalizeJob(j,s);if(item)jobs.push({...item,secondaryUrl:j.secondaryUrl})}
  }
  return {status:'ok',source:s.label,type:s.type,feedCount:entries.length,jobs,timeMs:Date.now()-start};
 }catch(err){return {status:'error',source:s.label,type:s.type,feedCount:0,jobs:[],error:String(err.message).slice(0,90),timeMs:Date.now()-start}}
}
async function getOne(s,limitMs=6000){if(s.type==='rolefinder')return getRoleFinder(s,limitMs);const begin=Date.now();try{const r=await fetch(boardUrl(s),{headers:{'user-agent':'CreativeJobFinderRadar/2.2 (public ATS feeds and permitted indices)','accept':'application/json'},cache:'no-store',signal:AbortSignal.timeout(limitMs)});if(!r.ok)throw Error('HTTP '+r.status);const bytes=+(r.headers.get('content-length')||0);if(bytes>6500000)throw Error('Source exceeds safe size');const json=await r.json();const parsed=parseFrom(s,json);return {status:'ok',source:s.label,type:s.type,feedCount:parsed.length,jobs:parsed,timeMs:Date.now()-begin}}catch(err){return {status:'error',source:s.label,type:s.type,feedCount:0,jobs:[],error:String(err?.name==='TimeoutError'?'Timeout':err.message).slice(0,90),timeMs:Date.now()-begin}}}
// Bounded fan-out avoids exhausted functions; sources fail individually, never suppress other feeds.
export async function fetchRadar({maxSources=SOURCES.length,timeout=5600}={}){
 const all=SOURCES.slice(0,maxSources),sourceOut=[];
 for(let i=0;i<all.length;i+=12){const chunk=await Promise.all(all.slice(i,i+12).map(s=>getOne(s,timeout)));sourceOut.push(...chunk)}
 const ranked=rankAndFilter(sourceOut.flatMap(x=>x.jobs));
 return {jobs:ranked.jobs.slice(0,300),watchlist:WATCHLIST,sources:sourceOut.map(({status,source,type,feedCount,error,timeMs})=>({status,source,type,feedCount,error,timeMs})),stats:{...ranked.stats,shown:Math.min(300,ranked.jobs.length),activeSources:sourceOut.filter(x=>x.status==='ok').length,sourceCount:sourceOut.length},generatedAt:new Date().toISOString(),method:'Priorité : responsabilités créatives, stratégie de marque et social media senior, avec géographie admissible. À explorer : postes adjacents ou conditions à vérifier. Aucun score ne prédit le recrutement.'};
}
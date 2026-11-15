/** Official public ATS endpoints, plus labeled independent job-board feeds. */
import {normalizeJob,rankAndFilter} from './radarCore.mjs';
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
 {type:'aggregate',slug:'remotive',label:'Remotive',company:'',sector:'Remote'},
 {type:'aggregate',slug:'jobicy',label:'Jobicy',company:'',sector:'Remote'},
 {type:'aggregate',slug:'himalayas',label:'Himalayas',company:'',sector:'Remote'},
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
 case 'aggregate':return ({arbeitnow:'https://www.arbeitnow.com/api/job-board-api',remotive:'https://remotive.com/api/remote-jobs?limit=450',jobicy:'https://jobicy.com/api/v2/remote-jobs?count=100',himalayas:'https://himalayas.app/jobs/api?limit=100'})[s.slug];
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
async function getOne(s,limitMs=6000){const begin=Date.now();try{const r=await fetch(boardUrl(s),{headers:{'user-agent':'CreativeJobFinderRadar/2.2 (public ATS feeds)','accept':'application/json'},cache:'no-store',signal:AbortSignal.timeout(limitMs)});if(!r.ok)throw Error('HTTP '+r.status);const bytes=+(r.headers.get('content-length')||0);if(bytes>6500000)throw Error('Source exceeds safe size');const json=await r.json();const parsed=parseFrom(s,json);return {status:'ok',source:s.label,type:s.type,feedCount:parsed.length,jobs:parsed,timeMs:Date.now()-begin}}catch(err){return {status:'error',source:s.label,type:s.type,feedCount:0,jobs:[],error:String(err?.name==='TimeoutError'?'Timeout':err.message).slice(0,90),timeMs:Date.now()-begin}}}
// Bounded fan-out avoids exhausted functions; sources fail individually, never suppress other feeds.
export async function fetchRadar({maxSources=SOURCES.length,timeout=5600}={}){
 const all=SOURCES.slice(0,maxSources),sourceOut=[];
 for(let i=0;i<all.length;i+=12){const chunk=await Promise.all(all.slice(i,i+12).map(s=>getOne(s,timeout)));sourceOut.push(...chunk)}
 const ranked=rankAndFilter(sourceOut.flatMap(x=>x.jobs));
 return {jobs:ranked.jobs.slice(0,300),watchlist:WATCHLIST,sources:sourceOut.map(({status,source,type,feedCount,error,timeMs})=>({status,source,type,feedCount,error,timeMs})),stats:{...ranked.stats,shown:Math.min(300,ranked.jobs.length),activeSources:sourceOut.filter(x=>x.status==='ok').length,sourceCount:sourceOut.length},generatedAt:new Date().toISOString(),method:'Priorité : responsabilités créatives, stratégie de marque et social media senior, avec géographie admissible. À explorer : postes adjacents ou conditions à vérifier. Aucun score ne prédit le recrutement.'};
}
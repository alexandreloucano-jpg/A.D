/** Source secondaire: pages éditoriales publiques WTTJ, sans URL de recherche ni données privées. */
const BASE='https://www.welcometothejungle.com';
const decode=s=>String(s??'').replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&(amp|quot|apos|lt|gt|nbsp);/gi,(_,n)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[n.toLowerCase()]));
const strip=s=>decode(String(s||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const ALLOWED=new Set([
 'emploi-social-media-manager','emploi-social-media','emploi-brand-manager','emploi-content-manager',
 'emploi-responsable-communication','emploi-directeur-artistique','emploi-directeur-marketing',
 'emploi-chef-de-projet-communication','emploi-chef-de-projet-editorial',
 'emploi-marketing-communication-paris-75000','emploi-marketing-communication-ile-de-france',
 'emploi-marketing','emploi-marketing-communication','emploi-community-manager',
 'emploi-charge-de-communication','emploi-chef-de-projet-marketing','emploi-directeur-de-communication',
 'emploi-head-of-marketing','emploi-marketing-manager'
]);
export const WTTJ_PAGES=[...ALLOWED];
export function parseWttjLanding(html){
 const text=String(html||'');if(text.length>1500000)return [];
 const offsets=[...text.matchAll(/data-role="jobs:thumb"/g)].map(m=>m.index);
 const found=[];
 for(let i=0;i<Math.min(offsets.length,50);i++){
  const raw=text.slice(offsets[i],Math.min(offsets[i+1]??text.length,offsets[i]+23000));
  const titleMatch=raw.match(/<a\s+href="(\/fr\/companies\/[a-z\d_-]+\/jobs\/[^"?#]+)"[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>\s*<\/a>/i);
  if(!titleMatch)continue;
  const title=strip(titleMatch[2]);const uri=titleMatch[1];
  const logoIndex=raw.search(/data-testid="job-thumb-logo-[^"]+"/);
  const after=logoIndex>=0?raw.slice(logoIndex):'';
  const spans=[...after.matchAll(/<span(?:\s[^>]*)?>([^<>]{1,120})<\/span>/g)].map(x=>strip(x[1])).filter(Boolean);
  const company=spans[0]||'';
  const location=spans[1]||'';
  if(!title||!company||!location||spans[1]?.length>100)continue;
  const path=decode(uri);
  let url;try{const u=new URL(path,BASE);if(u.origin!==BASE||!u.pathname.startsWith('/fr/companies/')||!u.pathname.includes('/jobs/'))continue;url=u.href}catch{continue}
  found.push({title,company,location,url,id:url,description:'',date:'',workplaceType:spans.find(x=>/t[eé]l[eé]travail/i.test(x))||''});
 }
 return [...new Map(found.map(x=>[x.url,x])).values()];
}
export async function getWttj(s,limitMs=7800){
 const start=Date.now(),slug=s.slug;
 if(!ALLOWED.has(slug))return {status:'error',source:s.label,type:s.type,feedCount:0,jobs:[],error:'Unknown editorial listing',timeMs:0};
 try{
  const url=BASE+'/fr/pages/'+slug;
  const res=await fetch(url,{headers:{'user-agent':'SandroCareerRadar/4.0 (curated job links only)','accept':'text/html'},cache:'no-store',signal:AbortSignal.timeout(limitMs)});
  if(!res.ok)throw Error('HTTP '+res.status);
  if(Number(res.headers.get('content-length')||0)>1500000)throw Error('HTML source too large');
  const html=await res.text();
  if(html.length>1500000)throw Error('HTML source too large');
  const jobs=parseWttjLanding(html);
  return {status:'ok',source:s.label,type:s.type,feedCount:jobs.length,jobs,timeMs:Date.now()-start};
 }catch(err){return {status:'error',source:s.label,type:s.type,feedCount:0,jobs:[],error:String(err?.name==='TimeoutError'?'Timeout':err.message).slice(0,90),timeMs:Date.now()-start}}
}
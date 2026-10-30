/**
 * Job Finder evidence-first editorial upgrade.
 * Deployment-safe, idempotent, requires exact source shape. Fails closed.
 * Usage: node install.cjs --local OR node install.cjs https://raw.githubusercontent.com/<owner>/<repo>/<commit>/jobfinder-intelligence-v1
 */
'use strict';
const fs=require('fs');
const path=require('path');
const https=require('https');
const root=fs.existsSync('app/apply/page.jsx')?'app':fs.existsSync('src/app/apply/page.jsx')?'src/app':null;
if(!root)throw Error('Job Finder source not found: refusing to deploy partial application.');
const ASSETS=['fitEngine.js','FitIntelligencePanel.jsx','fitIntelligence.css','fit-review-route.js'];
const base=process.argv[2];
if(!base)throw Error('Asset origin missing.');
if(base!=='--local'&&!/^https:\/\/raw\.githubusercontent\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[a-f0-9]{40}\/jobfinder-intelligence-v1$/.test(base))throw Error('Only an immutable, SHA-pinned GitHub source is accepted.');
function getAsset(name){return new Promise((resolve,reject)=>{
  if(base==='--local'){resolve(fs.readFileSync(path.join(__dirname,name),'utf8'));return}
  https.get(base+'/'+name,{timeout:12000,headers:{'User-Agent':'Creative-Job-Finder-Release'}},r=>{
   if(r.statusCode!==200){r.resume();reject(Error('HTTP '+r.statusCode+' for '+name));return}
   let s='';r.setEncoding('utf8');r.on('data',d=>{s+=d;if(s.length>250000)r.destroy(Error('Asset too large'))});r.on('end',()=>resolve(s));r.on('error',reject);
  }).on('error',reject);
 })}
function locateInitializer(src,key){
 const re=new RegExp('\\bconst\\s+'+key+'\\s*=\\s*'); const match=re.exec(src); if(!match)throw Error('Cannot identify '+key+' in source.');
 const start=match.index,open=start+match[0].length;
 if(src[open]!=='{')throw Error(key+' initializer is not an object literal.');
 let quote='',escaped=false,depth=0,comment='';
 for(let i=open;i<src.length;i++){
  const c=src[i],n=src[i+1];
  if(comment==='line'){if(c==='\n')comment='';continue}
  if(comment==='block'){if(c==='*'&&n==='/'){comment='';i++}continue}
  if(quote){if(escaped){escaped=false;continue}if(c==='\\'){escaped=true;continue}if(c===quote)quote='';continue}
  if(c==='/'&&n==='/'){comment='line';i++;continue}if(c==='/'&&n==='*'){comment='block';i++;continue}
  if(c==='"'||c==="'"||c==='`'){quote=c;continue}
  if(c==='{')depth++; if(c==='}')depth--;
  if(depth===0){const end=i+1+(src[i+1]===';'?1:0);return{start,open,end,literal:src.slice(open,i+1)}}
 }
 throw Error('Unterminated initializer '+key);
}
function importAfterDirective(src,line){
 if(src.includes(line))return src;
 const match=/^([\s\S]*?)(["']use client["'];?\s*)/.exec(src);
 if(match&&match.index===0)return src.slice(0,match[0].length)+'\n'+line+'\n'+src.slice(match[0].length);
 return line+'\n'+src;
}
function verify(src,text,tag){if(!src.includes(text))throw Error('Missing '+tag+' expected anchor');return src}
(async()=>{
 const assets=Object.fromEntries(await Promise.all(ASSETS.map(async n=>[n,await getAsset(n)])));
 for(const n of ASSETS)if(!assets[n].length)throw Error('Empty asset '+n);
 const applyPath=root+'/apply/page.jsx',radarPath=root+'/radar/page.jsx',layoutPath=root+'/layout.jsx';
 let apply=fs.readFileSync(applyPath,'utf8');let radar=fs.readFileSync(radarPath,'utf8');let layout=fs.readFileSync(layoutPath,'utf8');
 // Preserve the exact CV object. The import is the canonical evidence source for both apply and radar.
 let literal;
 if(!apply.includes('const CV=CAREER_CV')){
  const obj=locateInitializer(apply,'CV'); literal=obj.literal;
  if(!/\bprof\s*:/.test(literal)||!/\bexperience\s*:/.test(literal))throw Error('Unexpected CV shape');
  apply=apply.slice(0,obj.start)+'const CV=CAREER_CV;'+apply.slice(obj.end);
 }else{
  const existing=fs.readFileSync(root+'/lib/careerEvidence.js','utf8');const i=existing.indexOf('export const CAREER_CV=');
  if(i<0)throw Error('Canonical career source missing');literal=existing.slice(i+'export const CAREER_CV='.length).replace(/;\s*$/,'');
 }
 apply=importAfterDirective(apply,'import {CAREER_CV} from "../lib/careerEvidence";');
 const careerSource='// Canonical source: exact CV object from the existing /apply page; do not change numerical results without evidence.\nexport const CAREER_CV='+literal+';\n';
 // Some Radar builds have no PROFILE object; do not assume one exists.
 const radarUsesProfile=/\bconst\s+PROFILE\s*=/.test(radar);
 if(radarUsesProfile&&!radar.includes('const PROFILE=CAREER_CV.prof')){
  const obj=locateInitializer(radar,'PROFILE');
  radar=radar.slice(0,obj.start)+'const PROFILE=CAREER_CV.prof;'+radar.slice(obj.end);
 }
 if(radarUsesProfile)radar=importAfterDirective(radar,'import {CAREER_CV} from "../lib/careerEvidence";');
 // Preserve manually watched micro1 source from the previous release.
 if(!radar.includes('micro1.ai'))radar=verify(radar,'const WATCH_FALLBACK=[','Radar watchlist').replace('const WATCH_FALLBACK=[','const WATCH_FALLBACK=[\n{name:"micro1 — AI Expert Missions",url:"https://www.micro1.ai/experts/opportunities",segment:"AI Expert / Freelance",policy:"Veille manuelle",why:"Offres à vérifier directement sur micro1 ; pas de scraping."},');
 if(!layout.includes('import "./fitIntelligence.css";'))layout=layout.replace('import "./globals.css";','import "./globals.css";import "./fitIntelligence.css";');
 if(!layout.includes('import FitIntelligencePanel'))layout=layout.replace('import AchievementCoach', 'import FitIntelligencePanel from "./FitIntelligencePanel";import AchievementCoach');
 if(!layout.includes('<FitIntelligencePanel/>'))layout=verify(layout,'</body>','Layout').replace('</body>','<FitIntelligencePanel/></body>');
 // Fail closed on unsupported source shape. All files written only after all checks.
 if(!layout.includes('<FitIntelligencePanel/>')||!apply.includes('const CV=CAREER_CV')||(radarUsesProfile&&!radar.includes('const PROFILE=CAREER_CV.prof')))throw Error('Validation of integration failed');
 const out={
  [root+'/lib/careerEvidence.js']:careerSource,
  [root+'/lib/fitEngine.js']:assets['fitEngine.js'],
  [root+'/FitIntelligencePanel.jsx']:assets['FitIntelligencePanel.jsx'],
  [root+'/fitIntelligence.css']:assets['fitIntelligence.css'],
  [root+'/api/fit-review/route.js']:assets['fit-review-route.js'],
  [applyPath]:apply,[radarPath]:radar,[layoutPath]:layout
 };
 for(const [filename,content] of Object.entries(out)){fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,content,'utf8')}
 console.log('Evidence-first upgrade applied: '+Object.keys(out).join(', '));
})().catch(e=>{console.error('JobFinder upgrade aborted:',e.message);process.exit(1)});
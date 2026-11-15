/*
 * Deploy an Application Intelligence route as a minimally invasive extension.
 * Must run AFTER pinned jobfinder-intelligence-v1 install.cjs, before next build.
 * Requires exact integration anchors to avoid silently losing existing functionality.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),https=require('node:https');
const app=fs.existsSync('app/layout.jsx')?'app':fs.existsSync('src/app/layout.jsx')?'src/app':null;
if(!app)throw Error('Source layout missing. Refusing to patch unsupported app.');
const origin=process.argv[2];
if(!origin||origin!=='--local'&&!/^https:\/\/raw\.githubusercontent\.com\/[\w.-]+\/[\w.-]+\/[a-f0-9]{40}\/jobfinder-application-intelligence-v1$/.test(origin))throw Error('Supply local files or an immutable 40-character GitHub SHA source.');
const mapping={
 'ApplicationIntelligence.jsx':app+'/ApplicationIntelligence.jsx',
 'application-intelligence.css':app+'/application-intelligence.css',
 'engine.mjs':app+'/lib/application-intelligence.mjs',
 'api/contacts-route.js':app+'/api/application-intel/contacts/route.js',
 'api/offer-route.js':app+'/api/application-intel/offer/route.js',
 'routes/intelligence-index.jsx':app+'/intelligence/page.jsx',
 'routes/intelligence-layout.jsx':app+'/intelligence/layout.jsx',
 'routes/step-page.jsx':app+'/intelligence/[step]/page.jsx',
 'tests.mjs':'tests/application-intelligence.test.mjs',
 'INDEX.md':'INDEX.md',
 'PROCESS.md':'PROCESS.md',
 'REGLES.md':'REGLES.md',
 'DECISIONS.md':'DECISIONS.md',
 'README.md':'README-APPLICATION-INTELLIGENCE.md'
};
function readAsset(file){return new Promise((resolve,reject)=>{
 if(origin==='--local'){try{resolve(fs.readFileSync(path.join(__dirname,file),'utf8'))}catch(e){reject(e)}return}
 https.get(origin+'/'+file,{timeout:11000,headers:{'user-agent':'JobFinderApplicationIntelligenceRelease'}},res=>{
  if(res.statusCode!==200){res.resume();reject(Error(file+': HTTP '+res.statusCode));return}
  let s='';res.setEncoding('utf8');res.on('data',chunk=>{s+=chunk;if(s.length>400000)res.destroy(Error('Asset size exceeded'))});res.on('end',()=>resolve(s));res.on('error',reject);
 }).on('error',reject);
})}
(async()=>{
 if(!fs.existsSync(app+'/lib/fitEngine.js')||!fs.existsSync(app+'/lib/careerEvidence.js'))throw Error('First-stage evidence installer has not run.');
 const entryPath=app+'/ApplicationEntry.jsx',bridgePath=app+'/RadarBridge.jsx',entry=fs.readFileSync(entryPath,'utf8'),bridge=fs.readFileSync(bridgePath,'utf8');
 if(!entry.includes('href="/apply"')&&!entry.includes('href="/intelligence/offer"'))throw Error('Unrecognized ApplicationEntry anchor; refusing release.');
 if(!bridge.includes('window.location.assign("/")')&&!bridge.includes('window.location.assign("/intelligence/offer")'))throw Error('Unrecognized RadarBridge navigation; refusing release.');
 const contents={};for(const [asset,dest]of Object.entries(mapping)){const value=await readAsset(asset);if(value.length<12)throw Error('Asset missing: '+asset);contents[dest]=value}
 // A separate tests copy preserves relative engine.mjs import for Node tests.
 contents['tests/engine.mjs']=contents[app+'/lib/application-intelligence.mjs'];
 let nextEntry=entry;
 nextEntry=nextEntry.replace('if(path==="/apply")return null;','if(path==="/apply"||path.startsWith("/intelligence"))return null;');
 nextEntry=nextEntry.replace('href="/apply"','href="/intelligence/offer"');
 nextEntry=nextEntry.replace('DIRECTEUR DE CANDIDATURE','DOSSIER DE CANDIDATURE');
 let nextBridge=bridge;
 nextBridge=nextBridge.replace('window.location.assign("/")','window.location.assign("/intelligence/offer")');
 if(!nextBridge.includes('jf-intelligence-inbound')){
  const from='sessionStorage.setItem("jf-coach-target",JSON.stringify(target))';
  if(!nextBridge.includes(from))throw Error('RadarBridge target persistence anchor changed.');
  nextBridge=nextBridge.replace(from,from+';sessionStorage.setItem("jf-intelligence-inbound",JSON.stringify(target))');
 }
 if(!nextBridge.includes('/intelligence/offer')||!nextBridge.includes('jf-intelligence-inbound')||!nextEntry.includes('href="/intelligence/offer"'))throw Error('Integration tests failed.');
 contents[entryPath]=nextEntry;contents[bridgePath]=nextBridge;
 for(const [filename,data]of Object.entries(contents)){fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,data,'utf8')}
 console.log('Application Intelligence installed: '+Object.keys(contents).join(', '));
})().catch(e=>{console.error('Application Intelligence release ABORTED:',e.message);process.exit(1)});
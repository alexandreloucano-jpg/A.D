/** Install Radar V2 into the existing protected Job Finder app after Application Intelligence installer. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),os=require('node:os');
const app=fs.existsSync('app/radar/page.jsx')?'app':fs.existsSync('src/app/radar/page.jsx')?'src/app':null;
if(!app)throw Error('Cannot locate Job Finder Radar. No files changed.');
const base=process.argv[2];
if(base!=='--local'&&!/^https:\/\/raw\.githubusercontent\.com\/alexandreloucano-jpg\/A\.D\/[a-f0-9]{40}\/jobfinder-application-intelligence-v1\/radar-v2$/.test(base||''))throw Error('Radar requires a pinned HTTPS commit source.');
if(!fs.existsSync(app+'/lib/application-intelligence.mjs'))throw Error('Install Application Intelligence before Radar V2.');
const MAPPING={
 'page.jsx':app+'/radar/page.jsx',
 'radar.css':app+'/radar/radar.css',
 'jobs-route.js':app+'/api/jobs/route.js',
 'radarCore.mjs':app+'/lib/radarCore.mjs',
 'radarSources.mjs':app+'/lib/radarSources.mjs',
 'wttjSource.mjs':app+'/lib/wttjSource.mjs',
 'tests.mjs':'tests/radar-v2.test.mjs',
 'RADAR.md':'RADAR.md'
};
function get(name){return new Promise((resolve,reject)=>{if(base==='--local'){try{resolve(fs.readFileSync(path.join(__dirname,name),'utf8'))}catch(e){reject(e)}return}https.get(base+'/'+name,{timeout:15000,headers:{'user-agent':'JobFinderRadarV2Installer'}},r=>{if(r.statusCode!==200){r.resume();reject(Error('HTTP '+r.statusCode+' '+name));return}let buf='';r.setEncoding('utf8');r.on('data',d=>{buf+=d;if(buf.length>140000)r.destroy(Error('Source too large'))});r.on('end',()=>resolve(buf));r.on('error',reject)}).on('error',reject)})}
(async()=>{
const changes=await Promise.all(Object.entries(MAPPING).map(async ([source,destination])=>{const data=await get(source);if(data.length<100)throw Error('Empty source '+source);return {destination,data}}));
const core=changes.find(x=>x.destination===app+'/lib/radarCore.mjs');
const sources=changes.find(x=>x.destination===app+'/lib/radarSources.mjs');
changes.push({destination:'tests/radarCore.mjs',data:core.data},{destination:'tests/radarSources.mjs',data:sources.data},{destination:'tests/wttjSource.mjs',data:changes.find(x=>x.destination===app+'/lib/wttjSource.mjs').data});
const radar=changes.find(x=>x.destination===app+'/radar/page.jsx');if(!radar.data.includes('jf-intelligence-inbound')||!radar.data.includes('openDossier(job)')||!radar.data.includes("window.location.assign('/intelligence/offer')"))throw Error('Application Intelligence handoff missing');
const jobs=changes.find(x=>x.destination===app+'/api/jobs/route.js');if(!jobs.data.includes('fetchRadar'))throw Error('Jobs API incompatible');
for(const {destination,data} of changes){fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,data)}
const current=fs.existsSync('INDEX.md')?fs.readFileSync('INDEX.md','utf8'):'';
const start='<!-- RADAR_V4_START -->',end='<!-- RADAR_V4_END -->';
const block=start+'\n## Career Radar V4 (actif, priorité P0)\n- **RADAR.md** : contrat du Radar, périmètre du candidat et fiabilité des sources.\n- **REGLES.md** : règles produit globales, y compris exclusion des postes de designer exécutant.\n- **app/lib/radarCore.mjs** : filtres titre, missions et géographie.\n- **app/lib/radarSources.mjs** : collecte ATS, agrégateurs et index.\n- **app/lib/wttjSource.mjs** : index WTTJ public, sans collecte de pages privées.\n- **tests/radar-v2.test.mjs** : tests de non-régression Radar.\nConsulter les sources originales en cas de conflit. Les anciennes sections Radar V2/V3 sont historiques.\n'+end;
if(current.includes(start)&&current.includes(end)){
 const a=current.indexOf(start),b=current.indexOf(end,a)+end.length;fs.writeFileSync('INDEX.md',current.slice(0,a)+block+current.slice(b));
}else fs.writeFileSync('INDEX.md',current+'\n'+block+'\n');
console.log('Radar V2 installed:',changes.map(x=>x.destination).join(', '));
})().catch(e=>{console.error('Radar V2 installer failed closed:',e.message);process.exit(1)});
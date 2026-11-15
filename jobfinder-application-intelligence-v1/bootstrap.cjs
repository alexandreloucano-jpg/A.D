'use strict';
/** Pin both source patches, apply them in order, and run deterministic tests before Next build. */
const fs=require('node:fs'),https=require('node:https'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const newBase=process.argv[2];
const oldBase='https://raw.githubusercontent.com/alexandreloucano-jpg/A.D/8a5ff6803ebc01956b21a80a9efcc819e775aa4c/jobfinder-intelligence-v1';
if(!/^https:\/\/raw\.githubusercontent\.com\/alexandreloucano-jpg\/A\.D\/[a-f0-9]{40}\/jobfinder-application-intelligence-v1$/.test(newBase||''))throw Error('Refusing unpinned extension source.');
function get(url){return new Promise((resolve,reject)=>{https.get(url,{timeout:14000,headers:{'user-agent':'JobFinderReleaseBootstrap'}},r=>{if(r.statusCode!==200){r.resume();reject(Error('HTTP '+r.statusCode+' '+url));return}let s='';r.setEncoding('utf8');r.on('data',x=>{s+=x;if(s.length>90000)r.destroy(Error('Installer too large'))});r.on('end',()=>resolve(s));r.on('error',reject)}).on('error',reject)})}
(async()=>{
 for(const [tag,source] of [['evidence',oldBase],['applications',newBase]]){
  const file=path.join(os.tmpdir(),`jf-installer-${tag}.cjs`);fs.writeFileSync(file,await get(source+'/install.cjs'),'utf8');
  console.log('Installing '+tag+' from pinned release.');execFileSync(process.execPath,[file,source],{stdio:'inherit',timeout:60000});
 }
 console.log('Running Application Intelligence unit tests.');execFileSync(process.execPath,['tests/application-intelligence.test.mjs'],{stdio:'inherit',timeout:20000});
 console.log('All installers and unit tests complete.');
})().catch(e=>{console.error('Job Finder release failed closed:',e.message);process.exit(1)});
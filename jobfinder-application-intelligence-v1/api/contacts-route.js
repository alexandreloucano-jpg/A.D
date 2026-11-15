import {NextResponse} from 'next/server';
import https from 'node:https';
import dns from 'node:dns/promises';
import {publicIPv4,parsePublicSite,safeRedirect,robotsDisallowed,extractPublicContacts,CONTACT_PATHS} from '../../../lib/contact-helpers.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=25;
const MAX=190000;
async function fetchWebsite(url,limit=MAX,depth=0){
 if(depth>2)throw Error('Trop de redirections.');
 const host=url.hostname,addresses=await dns.lookup(host,{all:true,verbatim:true});
 const ipv4=addresses.filter(x=>x.family===4);
 if(!ipv4.length||ipv4.some(a=>!publicIPv4(a.address))||addresses.some(a=>a.family!==4&&a.family!==6))throw Error('Adresse réseau non publique, requête bloquée.');
 // Fail closed on a private IPv6 address, including dual-stack DNS poisoning.
 const ipv6=addresses.filter(x=>x.family===6).map(x=>x.address.toLowerCase());
 if(ipv6.some(x=>x==='::1'||x==='::'||x.startsWith('fc')||x.startsWith('fd')||x.startsWith('fe8')||x.startsWith('fe9')||x.startsWith('fea')||x.startsWith('feb')))throw Error('Adresse réseau non publique.');
 const address=ipv4[0];
 return await new Promise((resolve,reject)=>{
  const req=https.request({hostname:host,port:443,path:url.pathname+url.search,method:'GET',servername:host,timeout:7000,
   lookup:(hostname,opts,done)=>done(null,address.address,4),
   headers:{'user-agent':'SandroJobFinder/1.1 (+public professional contacts only)','accept':'text/html,text/plain;q=0.8','accept-encoding':'identity'}},res=>{
    const code=res.statusCode,type=String(res.headers['content-type']||'');
    if([301,302,303,307,308].includes(code)&&res.headers.location){res.resume();try{const next=safeRedirect(url,res.headers.location);resolve(fetchWebsite(next,limit,depth+1))}catch(e){reject(e)}return}
    if(code===404){res.resume();resolve({text:'',status:404});return}
    if(code!==200||(!type.includes('text/html')&&!type.includes('text/plain'))){res.resume();reject(Error('Page indisponible ou format non pris en charge.'));return}
    let chunks=[],length=0;res.on('data',chunk=>{length+=chunk.length;if(length>limit){req.destroy(Error('Page trop volumineuse.'));return}chunks.push(chunk)});
    res.on('end',()=>resolve({text:Buffer.concat(chunks).toString('utf8'),status:code}));res.on('error',reject);
   });req.on('timeout',()=>req.destroy(Error('Délai dépassé.')));req.on('error',reject);req.end();
 });
}
export async function POST(request){
 try{
  const json=await request.json();if(JSON.stringify(json).length>7000)return NextResponse.json({error:'Requête trop longue.'},{status:400});
  const root=parsePublicSite(String(json.website||''));
  // If robots.txt cannot be read, we do not assume permission to crawl.
  let robots;try{robots=await fetchWebsite(new URL('/robots.txt',root),30000)}catch{return NextResponse.json({error:'Impossible de vérifier robots.txt. Recherche interrompue pour respecter les règles du site.'},{status:422})}
  const urls=CONTACT_PATHS.filter(p=>!robotsDisallowed(robots.text,p)).map(p=>new URL(p,root));
  const readings=await Promise.all(urls.map(async u=>{
   try{const r=await fetchWebsite(u);return {url:u.toString(),status:r.status,contacts:extractPublicContacts(r.text,u.toString(),root)}}
   catch{return {url:u.toString(),error:'Non accessible',contacts:[]}}
  }));
  const found=new Map();for(const page of readings)for(const c of page.contacts){const old=found.get(c.email);if(!old||old.type!=='possible_recruitment'&&c.type==='possible_recruitment')found.set(c.email,c)}
  const contacts=[...found.values()].sort((a,b)=>Number(b.type==='possible_recruitment')-Number(a.type==='possible_recruitment')).slice(0,15);
  return NextResponse.json({website:root.toString(),contacts,pages:readings.map(({url,status,error})=>({url,status,error})),notice:'Coordonnées affichées dans les pages officielles. Le statut publié ne confirme ni le destinataire ni la délivrabilité.'},{headers:{'cache-control':'no-store'}});
 }catch(e){return NextResponse.json({error:String(e.message||'Recherche indisponible.').slice(0,240)},{status:400})}
}
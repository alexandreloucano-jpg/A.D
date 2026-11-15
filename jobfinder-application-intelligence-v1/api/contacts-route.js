import {NextResponse} from 'next/server';
import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=25;
const MAX=190000;
function publicIPv4(ip){
 if(net.isIP(ip)!==4)return false;
 const v=ip.split('.').map(Number),[a,b]=v;
 if(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&b>=18&&b<=19||a===192&&b===0||a===192&&b===0&&v[2]===2||a===198&&b===51||a===203&&b===0)return false;
 return true;
}
function parsePublicSite(input){
 const v=new URL(input);
 const host=v.hostname.toLowerCase();
 if(v.protocol!=='https:'||v.port||v.username||v.password||net.isIP(host)||host==='localhost'||/\.(local|internal|test|localhost|onion)$/i.test(host)||!host.includes('.'))throw Error('Seul un domaine officiel public en HTTPS est accepté.');
 return new URL('https://'+host+'/');
}
async function fetchWebsite(url,limit=MAX){
 const host=url.hostname,addresses=await dns.lookup(host,{all:true,verbatim:true});
 const ipv4=addresses.filter(x=>x.family===4);
 if(!ipv4.length||ipv4.some(a=>!publicIPv4(a.address)))throw Error('Adresse réseau non publique, requête bloquée.');
 const address=ipv4[0];
 return await new Promise((resolve,reject)=>{
  const req=https.request({hostname:host,port:443,path:url.pathname+url.search,method:'GET',servername:host,timeout:6500,
   lookup:(hostname,opts,done)=>done(null,address.address,4),
   headers:{'user-agent':'SandroJobFinder/1.0 (+manual company contact research; public pages only)','accept':'text/html,text/plain;q=0.8','accept-encoding':'identity'}},res=>{
    const type=String(res.headers['content-type']||'');
    if(res.statusCode===404){res.resume();resolve({text:'',status:404});return}
    if(res.statusCode!==200||(!type.includes('text/html')&&!type.includes('text/plain'))){res.resume();reject(Error('Page indisponible ou format non pris en charge.'));return}
    let chunks=[],length=0;res.on('data',chunk=>{length+=chunk.length;if(length>limit){req.destroy(Error('Page trop volumineuse.'));return}chunks.push(chunk)});
    res.on('end',()=>resolve({text:Buffer.concat(chunks).toString('utf8'),status:res.statusCode}));res.on('error',reject);
   });req.on('timeout',()=>req.destroy(Error('Délai dépassé.')));req.on('error',reject);req.end();
 });
}
function disallowedByRobots(robots,path){
 if(!robots)return false;
 let active=false;const blocked=[];
 for(const raw of robots.split(/\r?\n/)){const line=raw.split('#')[0].trim();if(!line)continue;const m=line.match(/^([\w-]+)\s*:\s*(.*)$/);if(!m)continue;const k=m[1].toLowerCase(),v=m[2].trim();if(k==='user-agent'){active=v==='*'||/sandrojobfinder/i.test(v);continue}if(active&&k==='disallow'&&v)blocked.push(v);}
 return blocked.some(prefix=>prefix==='/'||path.startsWith(prefix));
}
function pageEmails(html,source,root){
 const raw=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/section)>/gi,'\n').replace(/<[^>]+>/g,' ')
 .replace(/&(?:#64|commat);/gi,'@').replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ').replace(/[\t ]+/g,' ');
 const lines=raw.split('\n').map(x=>x.trim()).filter(x=>x.length>3);
 const emails=[...new Set((html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).map(x=>x.toLowerCase()))];
 const official=root.hostname.replace(/^www\./,'');
 return emails.filter(e=>{const domain=e.split('@')[1];return domain===official||domain.endsWith('.'+official)}).slice(0,20).map(e=>{
  const i=lines.findIndex(l=>l.toLowerCase().includes(e)),context=lines.slice(Math.max(0,i-2),i+3).join(' ').slice(0,280);
  const relevant=/talent|human resources|ressources humaines|recruit|recrut|career|job|emploi|people team|rh\b|hiring/i.test(e+' '+context);
  return {id:`official:${e}`,name:'',role:relevant?'Contact recrutement (contexte à confirmer)':'Adresse professionnelle publiée',email:e,sourceUrl:source,status:'verified',type:relevant?'recruitment':'other',context:context.slice(0,150)};
 });
}
export async function POST(request){
 try{
  const json=await request.json();if(JSON.stringify(json).length>7000)return NextResponse.json({error:'Requête trop longue.'},{status:400});
  const root=parsePublicSite(String(json.website||''));
  const robots=await fetchWebsite(new URL('/robots.txt',root),30000).catch(()=>({text:''}));
  const paths=['/','/contact','/careers','/jobs','/about','/team'];
  const urls=paths.filter(p=>!disallowedByRobots(robots.text,p)).map(p=>new URL(p,root));
  const readings=await Promise.all(urls.map(async u=>{
   try{const r=await fetchWebsite(u);return {url:u.toString(),status:r.status,contacts:pageEmails(r.text,u.toString(),root)}}
   catch(e){return {url:u.toString(),error:'Non accessible',contacts:[]}}
  }));
  const map=new Map();for(const page of readings)for(const entry of page.contacts){const old=map.get(entry.email);if(!old||old.type!=='recruitment'&&entry.type==='recruitment')map.set(entry.email,entry)}
  const contacts=[...map.values()].sort((a,b)=>(a.type==='recruitment'?-1:1)-(b.type==='recruitment'?-1:1)).slice(0,15);
  return NextResponse.json({website:root.toString(),contacts,pages:readings.map(({url,status,error})=>({url,status,error})),notice:'Uniquement les emails professionnels explicitement publiés sur le domaine officiel ; aucun nom ni email déduit.'},{headers:{'cache-control':'no-store'}});
 }catch(e){return NextResponse.json({error:String(e.message||'Recherche indisponible.').slice(0,240)},{status:400})}
}
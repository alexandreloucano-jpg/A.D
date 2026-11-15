/* Pure source-verification helpers. Do not treat an email's existence as a verified person's identity. */
import net from 'node:net';
export const CONTACT_PATHS=['/','/contact','/contact-us','/fr/contact','/careers','/jobs','/recrutement','/carrieres','/nous-rejoindre','/about','/team'];
export function publicIPv4(ip){
 if(net.isIP(ip)!==4)return false;
 const [a,b,c]=ip.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&b>=18&&b<=19||a===192&&b===0||a===192&&b===0&&c===2||a===198&&b===51||a===203&&b===0&&c===113);
}
export function parsePublicSite(input){
 const u=new URL(input),host=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||u.port||u.username||u.password||net.isIP(host)||host==='localhost'||/\.(local|internal|test|localhost|onion)$/i.test(host)||!host.includes('.'))throw Error('Seul un domaine public en HTTPS est accepté.');
 return new URL('https://'+host+'/');
}
export function safeRedirect(from,location){
 let next;try{next=new URL(location,from)}catch{throw Error('Redirection invalide.')}
 const root=h=>h.toLowerCase().replace(/^www\./,'');
 if(next.protocol!=='https:'||next.port||next.username||next.password||net.isIP(next.hostname)||root(next.hostname)!==root(from.hostname))throw Error('Redirection hors domaine officiel bloquée.');
 return next;
}
export function robotsDisallowed(robots,path,agent='SandroJobFinder'){
 if(!robots)return false;
 const groups=[];let names=[],rules=[];
 const flush=()=>{if(names.length)groups.push({names,rules});names=[];rules=[]};
 for(const raw of robots.split(/\r?\n/)){
  const line=raw.split('#')[0].trim(),m=line.match(/^([\w-]+)\s*:\s*(.*)$/);if(!m)continue;
  const k=m[1].toLowerCase(),v=m[2].trim();
  if(k==='user-agent'){if(rules.length)flush();names.push(v.toLowerCase());continue}
  if(names.length&&(k==='disallow'||k==='allow'))rules.push({type:k,path:v});
 }
 flush();
 const target=agent.toLowerCase();const specific=groups.filter(g=>g.names.some(n=>n!=='*'&&target.includes(n))).flatMap(g=>g.rules);
 const selected=specific.length?specific:groups.filter(g=>g.names.includes('*')).flatMap(g=>g.rules);
 let winner=null;
 for(const rule of selected){if(!rule.path)continue;
  const escaped=rule.path.split('*').map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*').replace(/\$$/,'$');
  const regex=new RegExp('^'+escaped);
  if(!regex.test(path))continue;
  const length=rule.path.replace(/\*/g,'').length;
  if(!winner||length>winner.length||length===winner.length&&rule.type==='allow')winner={length,type:rule.type};
 }
 return winner?.type==='disallow';
}
export function extractPublicContacts(html,source,root){
 const safe=String(html||'').replace(/<!--[\s\S]*?-->/g,' ')
   .replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ');
 const href=[...safe.matchAll(/\bhref\s*=\s*["']mailto:([^"'?#\s>]+)[^"']*["']/gi)].map(m=>decodeEntities(m[1]));
 const content=decodeEntities(safe).replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/section|\/address)\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,' ');
 const lines=content.split(/\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(x=>x.length>3);
 const emails=[...new Set([...content.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),...href.map(x=>[x])].map(m=>m[0].toLowerCase()))];
 const host=root.hostname.toLowerCase().replace(/^www\./,'');
 return emails.filter(e=>{
  const domain=e.split('@')[1];return domain===host||domain.endsWith('.'+host)||host.endsWith('.'+domain);
 }).slice(0,20).map(email=>{
  const idx=lines.findIndex(l=>l.toLowerCase().includes(email));
  const context=idx>=0?lines.slice(Math.max(0,idx-1),idx+2).join(' ').slice(0,240):'Adresse publiée via un lien mailto';
  const recruiting=/talent|human resources|ressources humaines|recruit|recrut|career|job|emploi|people team|\brh\b|hiring/i.test(email+' '+context);
  return {id:'official:'+email,name:'',role:recruiting?'Recrutement possible (fonction non confirmée)':'Adresse professionnelle publiée',email,sourceUrl:source,status:'published',type:recruiting?'possible_recruitment':'other',context:context.slice(0,150)};
 });
}
function decodeEntities(s){return s.replace(/&(?:commat|#64|#x40);/gi,'@').replace(/&(?:amp|#38);/gi,'&').replace(/&(?:nbsp|#160);/gi,' ').replace(/&(?:period|#46);/gi,'.')}
import {NextResponse} from 'next/server';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=15;
const ALLOWED=new Set(['jobs.lever.co','boards.greenhouse.io','job-boards.greenhouse.io','jobs.ashbyhq.com','apply.workable.com','careers.smartrecruiters.com']);
function stripHtml(value){return String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<(?:\/p|\/div|\/section|\/li|br\s*\/?)>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim()}
export async function POST(request){
 try{const {url}=await request.json();const u=new URL(String(url));if(u.protocol!=='https:'||!ALLOWED.has(u.hostname.toLowerCase())||u.port||u.username||u.password)return NextResponse.json({error:'Import automatique réservé aux plateformes officielles prises en charge. Colle la description pour les autres sites.'},{status:400});
 const response=await fetch(u,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8500),headers:{'user-agent':'SandroJobFinder/1.0','accept':'text/html'}});
 if(!response.ok)return NextResponse.json({error:'Offre inaccessible. Colle son texte.'},{status:422});
 const type=response.headers.get('content-type')||'';if(!type.includes('text/html'))return NextResponse.json({error:'Format non pris en charge.'},{status:422});
 const html=(await response.text()).slice(0,250000);const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'';
 const description=stripHtml((html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)||[])[1]||html).slice(0,15000);
 return NextResponse.json({title:stripHtml(title).slice(0,180),description,source:u.toString(),warning:'Extraction indicative. Vérifie le texte et les responsabilités avant la candidature.'},{headers:{'cache-control':'no-store'}});
 }catch(e){return NextResponse.json({error:'Import indisponible. Colle la description de l’annonce.'},{status:422})}
}
/** Application Intelligence: deterministic, evidence-first helpers. No invented claims or contacts. */
export const STEPS=['offer','cv','contacts','portfolio','outreach'];
export const STEP_LABELS={offer:'Offre',cv:'CV',contacts:'Interlocuteurs',portfolio:'Portfolio',outreach:'Approche'};
export const PORTFOLIO_URL='https://sandro-portfolio-public.vercel.app/';
export const PROJECTS=[
 {slug:'byredo',name:'BYREDO',sector:'Beauty / Campaign'},
 {slug:'manikya',name:'MANIKYA',sector:'Fashion / Campaign'},
 {slug:'coya',name:'COYA',sector:'Hospitality / Campaign'},
 {slug:'beyond-fears',name:'BEYOND FEARS',sector:'Culture / Music'}
];
export const MAX_DESCRIPTION=15000;
const txt=v=>String(v??'').trim();
export function normaliseOffer(raw={}){
 return {title:txt(raw.title).slice(0,180),company:txt(raw.company).slice(0,160),location:txt(raw.location).slice(0,160),description:txt(raw.description).slice(0,MAX_DESCRIPTION),url:txt(raw.url).slice(0,2000),companyWebsite:txt(raw.companyWebsite).slice(0,1000),source:txt(raw.source).slice(0,120),date:txt(raw.date).slice(0,50)};
}
export function offerKey(offer){const v=[offer.url?.toLowerCase(),offer.title?.toLowerCase(),offer.company?.toLowerCase()].join('|');let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return 'job-'+(h>>>0).toString(36)}
export function recommendProjects(offer){const text=(offer.title+' '+offer.company+' '+offer.description).toLowerCase();const weights={byredo:0,manikya:0,coya:0,'beyond-fears':0};const add=(k,re,w)=>{if(re.test(text))weights[k]+=w};
 add('byredo',/beauty|beaute|cosmetic|luxe|luxury|perfume|parfum|skincare/g,4);
 add('manikya',/fashion|mode|couture|fashion week|stylis|apparel|retail/g,4);
 add('coya',/hospitality|hotel|h[oô]tel|restaurant|gastronom|lifestyle|food|venue/g,4);
 add('beyond-fears',/social|content|music|musique|festival|community|audience|event|growth|culture/g,4);
 const fallback=['byredo','manikya','coya','beyond-fears'];return [...fallback].sort((a,b)=>weights[b]-weights[a]||fallback.indexOf(a)-fallback.indexOf(b)).slice(0,3);
}
export function curatedPortfolioUrl(slugs,base=PORTFOLIO_URL){const cleaned=[...new Set(slugs)].filter(s=>PROJECTS.some(p=>p.slug===s));const u=new URL(base);if(cleaned.length)u.searchParams.set('selected',cleaned.join(','));return u.toString()}
export const validEmail=s=>/^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(txt(s));
export function sourceVerified(contact){
 if(!contact||!validEmail(contact.email))return false;
 let source;try{source=new URL(contact.sourceUrl)}catch{return false}
 if(source.protocol!=='https:'||source.username||source.password||source.port)return false;
 if(contact.status==='verified')return true; // Explicitly attested by user, not automatically proven.
 if(contact.status!=='published')return false;
 const domain=contact.email.toLowerCase().split('@')[1],host=source.hostname.toLowerCase().replace(/^www\./,'');
 return domain===host||host.endsWith('.'+domain)||domain.endsWith('.'+host);
}
const capitalize=s=>txt(s).replace(/\s+/g,' ');
export function buildOutreach({offer={},contact={},portfolioUrl='',language='en',channel='recruiter',applied=false,projectNames=[],relevanceLine=''}){
 const specific=txt(relevanceLine).replace(/\s+/g,' ').slice(0,240);
 const name=capitalize(contact.name).split(/\s+/)[0]||'',title=capitalize(offer.title)||'[Role]',company=capitalize(offer.company)||'[Company]',project=projectNames.slice(0,2).join(' and '),link=portfolioUrl||PORTFOLIO_URL;
 if(language==='fr'){
 const recipient=name?`Bonjour ${name},`:'Bonjour,';
 const subject=`${title} | Alexandre Loucano`;
 const line=channel==='manager'?'Votre équipe recrute actuellement pour un poste qui correspond à mon travail en direction artistique et stratégie créative.':'Je vous contacte au sujet du poste de '+title+' chez '+company+'.';
 const works=project?`Je vous propose une sélection de travaux, notamment ${project}, en lien avec les enjeux du poste.`:'Je vous propose une sélection de travaux directement liés aux enjeux du poste.';
 const specificText=specific?`L’un des points précis de l’offre qui m’intéresse : ${specific}\n\n`:'';
 const appliedText=applied?'J’ai également déposé ma candidature via le canal officiel.\n\n':'';
 return {subject,body:`${recipient}\n\n${line}\n\n${specificText}${works}\n\n${link}\n\n${appliedText}Je serais ravi d’échanger si mon profil vous paraît pertinent.\n\nBien cordialement,\nAlexandre Loucano\nSandro Salinger`,linkedin:`${recipient}\n\nJe m’intéresse au poste ${title} chez ${company}. Mon travail en direction artistique et stratégie créative pourrait être pertinent pour l’équipe. Je vous partage une courte sélection : ${link}\n\nAlexandre Loucano`,followUp:`${recipient}\n\nJe me permets de revenir vers vous au sujet du poste ${title}. Je reste disponible pour échanger si mon parcours peut intéresser l’équipe.\n\nBien cordialement,\nAlexandre Loucano`};
 }
 const recipient=name?`Hello ${name},`:'Hello,';
 const subject=`${title} at ${company} | Alexandre Loucano`;
 const opener=channel==='manager'?`I noticed your team is hiring for ${title} at ${company}.`:`I came across the ${title} opening at ${company}.`;
 const work=project?`I've put together a short selection of relevant work, including ${project}.`:`I've put together a short selection of work relevant to the role.`;
 const specificText=specific?`A specific part of the brief caught my attention: ${specific}\n\n`:'';
 const appliedText=applied?'I have also applied through your official careers channel.\n\n':'';
 return {subject,body:`${recipient}\n\n${opener}\n\n${specificText}${work}\n\n${link}\n\n${appliedText}I would welcome a conversation if my background is relevant to the team.\n\nBest regards,\nAlexandre Loucano\nSandro Salinger`,linkedin:`${recipient}\n\nI saw the ${title} opening at ${company}. My work spans creative direction and brand storytelling, and I wanted to share a short selection relevant to the role: ${link}\n\nAlexandre Loucano`,followUp:`${recipient}\n\nFollowing up on my note about the ${title} role. I'd be glad to speak if my background could be useful to the team.\n\nBest regards,\nAlexandre Loucano`};
}
export function candidateSearchLinks(offer){const company=txt(offer.company),role=txt(offer.title);return [
 {label:'Talent Acquisition / HR',url:'https://www.google.com/search?q='+encodeURIComponent('site:linkedin.com/in/ "'+company+'" ("Talent Acquisition" OR "Recruiter" OR "People")')},
 {label:'Hiring manager',url:'https://www.google.com/search?q='+encodeURIComponent('site:linkedin.com/in/ "'+company+'" ("Creative Director" OR "Head of Social" OR "Marketing Director")')},
 {label:'Recrutement officiel',url:'https://www.google.com/search?q='+encodeURIComponent('"'+company+'" "'+role+'" recruiter careers')}
 ];}
export function createRecord(offer){const clean=normaliseOffer(offer);
 const meaningful=!!(clean.title||clean.company||clean.url);
 const id=meaningful?offerKey(clean):'draft-'+(globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
 return {id,offer:clean,notes:'',relevanceLine:'',selectedEvidenceIds:null,portfolioProjects:recommendProjects(clean),contacts:[],selectedContactId:'',language:'en',channel:'recruiter',applied:false,status:'draft',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};}
export function selectTopEvidence(fit,all){
 if(fit?.coverage===null||['insufficient','out_of_scope','manual'].includes(fit?.state))return [];
 const valid=new Set((all||[]).map(e=>e.id));return [...new Set((fit?.selected||[]).map(e=>e.id))].filter(id=>valid.has(id)).slice(0,7);
}
// Evidence-first matching: this number measures coverage of the advertised requirements,
// never ATS compatibility, probability of an interview or candidate quality.
export const NORM = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const TAXONOMY = [
  { id:'creative',label:'Direction artistique et conception',terms:['direction artistique','direction creative','creative direction','art director','creative director','identite visuelle','visual identity','concept creatif','creative concept','art direction'] },
  { id:'brand',label:'Stratégie de marque et storytelling',terms:['strategie de marque','brand strategy','brand positioning','storytelling','positionnement','brand narrative','editorial','identite de marque'] },
  { id:'social',label:'Stratégie social media',terms:['social media','reseaux sociaux','social-first','content strategy','community management','community growth','instagram','tiktok','linkedin'] },
  { id:'production',label:'Production de campagne',terms:['production','postproduction','photographie','photography','shooting','campagne','campaign','styling','casting','videography'] },
  { id:'leadership',label:'Direction et management',terms:['management','manage','manager','encadrer','superviser','team leader','direct reports','leadership','equipe','équipe'] },
  { id:'growth',label:'Croissance et résultats mesurés',terms:['croissance','growth','engagement','audience','performance','kpi','roi','conversion','views','vues','reach'] },
  { id:'analytics',label:'Analyse et pilotage',terms:['data','analytics','reporting','look er','looker','ga4','marketing analysis','analyse marketing','metrics','mesure','crm'] },
  { id:'budget',label:'Pilotage budgétaire',terms:['budget','ads','paid media','media buying','investment','investissement','revenue','commercial','acquisition'] },
  { id:'luxury',label:'Univers luxe, mode et beauté',terms:['luxe','luxury','fashion','mode','beauty','beaute','cosmetique','cosmetics','hospitality','premium'] },
  { id:'english',label:'Anglais professionnel',terms:['english','anglais','fluent','bilingual','courant','c1','international'] },
];
const STOP=new Set('avec dans pour depuis sans tout tous plus bien chez leur notre votre sont cette celui celle elle elles vous nous aux des les une est ont que qui par sur and the with from into about role responsibilities work have managing manager years experience strategy team job required strong ability develop ensure lead help contribute growth business'.split(' '));
const words=text=>new Set(NORM(text).replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(x=>x.length>3&&!STOP.has(x)));
const overlap=(a,b)=>{const wa=words(a),wb=words(b);let m=0;for(const x of wa){if(wb.has(x))m++}return Math.min(1,m/Math.max(2,Math.min(wa.size,6)))};
const matches=(text,category)=>category.terms.filter(k=>NORM(text).includes(NORM(k)));
const categoryForTitle=title=>{const x=NORM(title);return /(head of social|social media|content director|community)/.test(x)?'social':/(creative director|directeur artistique|art director|direction artistique)/.test(x)?'creative':/(creative strategist|brand|strateg)/.test(x)?'brand':'general'};
export function listEvidence(cv){
 const experiences=Array.isArray(cv?.experience)?cv.experience:[];
 const facts=experiences.flatMap((job,index)=>(job.bullets||[]).map((line,i)=>({id:`cv:${job.id||index}:${i}`,text:String(line),context:job.company||'CV',role:job.role||'',period:job.period||'',source:'CV fourni',status:'declaration',tags:TAXONOMY.filter(t=>matches(`${line} ${job.role||''}`,t).length>0).map(t=>t.id)})));
 if(cv?.prof?.languages)facts.push({id:'cv:languages',text:String(cv.prof.languages),context:'Compétences linguistiques déclarées',role:'',period:'',source:'CV fourni',status:'declaration',tags:['english']});
 return facts;
}
export function parseJobRequirements(job){
 const text=[job?.title||'',job?.description||''].join(' '),desc=job?.description||'';
 const selected=TAXONOMY.map(t=>{
  const hits=matches(text,t),titleHits=matches(job?.title,t);
  const descHits=matches(desc,t);
  if(!hits.length)return null;
  const weight=(titleHits.length?3:1)+(descHits.length?1:0);
  return {id:t.id,label:t.label,weight,trigger:descHits.slice(0,3).join(', ')||titleHits.slice(0,2).join(', '),source:descHits.length?'Offre':'Intitulé',explicit:descHits.length>0};
 }).filter(Boolean).sort((a,b)=>b.weight-a.weight).slice(0,8);
 if(!selected.length)return [{id:'scope',label:'Responsabilités principales',weight:1,source:'Analyse insuffisante',explicit:false,trigger:'Description de poste manquante'}];
 return selected;
}
function proofScore(evidence,req){
 const tagged=evidence.tags.includes(req.id);
 const c=TAXONOMY.find(x=>x.id===req.id);
 const signals=matches(evidence.text,c||{terms:[]});
 const specificity=/\b(\d+(?:[.,]\d+)?\s?(?:%|€|\$|m\+?|k€|millions?|ans|mois|personnes|utilisateurs))\b/i.test(evidence.text)?0.15:0;
 const tagScore=tagged&&signals.length?0.68:tagged?0.40:0;
 return tagged?Math.min(1,tagScore+specificity):0;
}
export function evaluateFit(cv,job){
 const evidence=listEvidence(cv),requirements=parseJobRequirements(job),kind=categoryForTitle(job?.title);
 const rows=requirements.map(req=>{
  const ordered=evidence.map(item=>({...item,strength:proofScore(item,req)})).sort((a,b)=>b.strength-a.strength);
  const found=ordered[0]?.strength||0;
  let status=found>=0.65?'documente':found>=0.38?'partiel':'non_documente';
  // A product team is not evidence of leading an art or social team.
  if(req.id==='leadership' && kind!=='general' && /HADDICT|STATION F/i.test(ordered[0]?.context||'') && found>0) status='partiel';
  if(req.id==='english' && found>0)status='partiel'; // self-declared fluency, not independently verified
  return {...req,status,proofs:ordered.filter(x=>x.strength>0).slice(0,2),note:status==='documente'?'Le CV mentionne une réalisation pertinente ; périmètre à confirmer.':status==='partiel'?'Indice transférable, mais responsabilité exacte à confirmer.':'Aucune réalisation explicite trouvée dans le CV.'};
 });
 const points=rows.reduce((n,x)=>n+x.weight*(x.status==='documente'?1:x.status==='partiel'?.45:0),0),total=rows.reduce((n,x)=>n+x.weight,0);
 const coverage=Math.round(100*points/Math.max(1,total));
 const gaps=rows.filter(x=>x.status!=='documente').slice(0,5).map(x=>({id:x.id,question:questionFor(x.id)}));
 const ranked=evidence.filter(e=>e.id!=='cv:languages').map(e=>({e,score:rows.reduce((n,r)=>n+(r.proofs.find(p=>p.id===e.id)?.strength||0)*r.weight,0)})).sort((a,b)=>b.score-a.score);
 const selected=ranked.filter(x=>x.score>0).slice(0,4).map(x=>x.e);
 const baseline=ranked.filter(x=>x.score===0).slice(0,2).map(x=>x.e);
 const warnings=[];
 if(!job?.description?.trim())warnings.push('Description complète absente : cette analyse n’évalue que l’intitulé.');
 if(rows.some(x=>x.id==='leadership'&&x.status!=='documente')) warnings.push('Ne pas transformer un management produit en direction d’équipe créative.');
 if(selected.length===0) warnings.push('Aucune preuve suffisamment pertinente : enrichir le CV avant de rédiger.');
 return {coverage,kind,requirements:rows,evidence,selected:selected.length?selected:baseline,questions:gaps,warnings,method:'Couverture pondérée des critères détectés dans l’offre ; non prédictive et sans lien avec un ATS.'};
}
export function questionFor(id){
 const q={creative:'Quel concept avez-vous conçu personnellement, et comment a-t-il été validé ?',brand:'Quelle décision de positionnement avez-vous prise, et avec quel effet ?',social:'Quels canaux, période, métriques et responsabilités pouvez-vous documenter ?',production:'Quels livrables et quelles responsabilités de production sont attestables ?',leadership:'Combien de collaborateurs en reporting direct et dans quel périmètre ?',growth:'Quelle période et quel indicateur de référence démontrent le résultat ?',analytics:'Quels outils et quels tableaux de bord avez-vous effectivement pilotés ?',budget:'Quels budgets avez-vous personnellement engagés et validés ?',luxury:'Quelle marque et quel projet démontrent une expérience directement comparable ?',english:'Quel usage professionnel de l’anglais pouvez-vous justifier ?',scope:'Collez le descriptif complet de l’offre.'};return q[id]||'Quel exemple précis et vérifiable pouvez-vous donner ?';
}
function safeRewrite(input){
 const s=String(input||'').trim();
 const creative=/^Direction créative et production de campagnes pour (.+)\.?$/i.exec(s);
 if(creative)return `Campagnes pour ${creative[1].replace(/\.$/,'')} — direction créative et production.`;
 if(/^Production de contenus\s*:/i.test(s))return s.replace(/^Production de contenus\s*:/i,'Production de contenus —');
 return s.replace(/\s+:\s+/,' — ');
}
export function editorialSuggestions(fit,job){
 const opening={creative:'Direction artistique senior — conception et production de campagnes',social:'Stratégie social media — contenus, croissance et mesure',brand:'Stratégie créative — positionnement, narration et activation',general:'Stratégie créative et direction artistique'};
 const role=fit.kind;
 const evidence=fit.selected.map(item=>({sourceId:item.id,source:item.text,proposal:safeRewrite(item.text),why:role==='creative'?'À retenir si la portée créative est confirmée.':role==='social'?'Résultat pertinent ; préciser le canal, la période et la méthode de mesure.':'Conserver les résultats et préciser la contribution personnelle.',status:'à vérifier'}));
 return {headline:opening[role],lead:`Profil à positionner sur ${job?.title||'le poste visé'} ; ne pas avancer de périmètre non documenté.`,evidence,unanswered:fit.questions.map(q=>q.question)};
}
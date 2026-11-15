/** Radar V2.2: opportunity fit, not probability of hiring. Deterministic and auditable. */
export const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const rx=(s,re)=>re.test(norm(s));
const DEF={
  direction:/\b(creative director|directeur creatif|directrice creative|directeur de creation|directrice de creation|head of creative|creative head|executive creative director|chief creative|global creative|direction artistique|directeur artistique|directrice artistique|art director|art direction|creative lead|creative leadership)\b/,
  strategy:/\b(creative strateg(y|ist)|brand strateg(y|ist)|senior strategist|strategie de marque|strateg(e|ie) creatif|creative planning|brand positioning|brand narrative|brand director|directeur de marque|directrice de marque|brand lead|head of brand|brand marketing director|brand communications director|brand communication lead|strategic planning director|planning strategique)\b/,
  social:/\b(head of social|social media director|director of social|social strategy|social strategist|social media lead|social media strategist|social media strategy|influencer strategist|head of community|responsable social media|directeur social media|directrice social media|senior social media|social media manager|social first|head of influence|influencer strategy lead)\b/,
  content:/\b(head of content|content director|content strategy|content strategist|head of editorial|editorial director|creative producer|campaign director|head of campaigns|campaign lead|content lead|content marketing director|head of communications|communications director|marketing communications director|global marketing director|creative operations)\b/,
  adjacent:/\b(brand marketing|head of marketing|director of marketing|marketing manager|communications manager|influencer marketing|partnerships manager|partnerships director|community manager|content manager|growth marketing|marketing lead|marketing director|social media)\b/
};
// These titles require production/drawing skill, not directing the creative work.
const HANDS_ON=/\b(graphic designer|graphics designer|graphiste|designer graphique|graphic design intern|visual designer|brand designer|product designer|ux designer|ui designer|ux\/ui|ui\/ux|web designer|webdesigner|motion designer|motion graphics|motion design|illustrator|illustratrice|illustrateur|3d artist|3d designer|set designer|print designer|packaging designer|layout designer|production designer|design engineer|design system|video editor|videaste|photographe|photographer|retoucher|retoucheur|artworker|artwork designer|character artist|game artist|interior designer|architecte d'interieur)\b/;
const JUNIOR=/\b(intern(ship)?|stage|stagiaire|alternance|alternant|apprenti|apprentice|junior|trainee|graduate scheme|working student|student program|student job|assistant social media|assistant marketing|social media assistant)\b/;
const TECH=/\b(product marketing|field marketing|performance marketing|paid media specialist|search engine optimization|seo specialist|demand generation|revenue marketing|cms content manager|software engineer|frontend|front end|backend|back end|full stack|developer|developpeur|data engineer|data scientist|accountant|comptable|sales development representative|business development representative|account executive|customer success|legal counsel|juriste|recruiter|talent acquisition|revenue operations|product manager|product owner|financial analyst)\b/;
const HEAVY_EXECUTION=/\b(hands.on graphic design|design mockups|create graphic assets|create illustrations|design in figma|create ui|execute visual designs|adobe illustrator required|illustration portfolio|graphic design portfolio|daily graphic production|produire des maquettes|creation de maquettes|dessin vectoriel|dessin technique|production graphique quotidienne)\b/;
const CREATIVE_LEAD=/\b(creative director|art director|creative lead|head of creative|director of creative|directeur artistique|directrice artistique|direction artistique|directeur de creation|directrice de creation)\b/;
const FRENCH=/\b(paris|ile.de.france|ile de france|france|lyon|bordeaux|lille|marseille|nantes|toulouse|strasbourg|montpellier|nice|rennes)\b/;
const EUROPE=/\b(europe|emea|eu only|eu remote|remote eu|european union|european timezone|cet|cest|western europe|europe remote)\b/;
const REMOTE=/\b(remote|teletravail|work from anywhere|distributed|anywhere|fully remote|hybrid|hybride)\b/;
const FOREIGN_ONSITE=/\b(new york|san francisco|los angeles|boston|chicago|austin|seattle|toronto|vancouver|london|manchester|birmingham|dubai|singapore|sydney|melbourne|hong kong|bengaluru|bangalore|tokyo|delhi|mumbai|tel aviv|israel|nyc|united states|usa|united kingdom|uk only|us only|canada only|north america only|india only|apac only|united arab emirates)\b/;
const RESTRICTED=/\b(us residents only|us candidates only|us only|must reside in the us|must be based in the us|uk only|must be based in the uk|canada only|north america only|remote within the us|remote in the us|remote uk)\b/;
const PARIS=/\b(paris|ile.de.france|ile de france)\b/;
function sectorFor(s){const x=norm(s);if(/luxur|luxe|beaut|cosmetic|skincare|perfume|fashion|couture|retail|jewelry|joaill|fragrance/.test(x))return 'Mode / Beauté';if(/hotel|hospitality|restaurant|travel|tourism|food|gastronom/.test(x))return 'Hospitality';if(/music|festival|culture|art|film|media|entertainment|publishing/.test(x))return 'Culture / Media';return 'Marque / Digital'}
export function fitOpportunity(input,options={}){
 const title=norm(input?.title),description=norm(String(input?.description||'').slice(0,10000)),location=norm(input?.location),employer=norm(input?.company),work=norm(input?.workplaceType);const whole=title+' '+description;
 if(!title)return {tier:'rejected',score:0,reasons:['Titre absent'],role:'unknown',geo:'unknown'};
 if(HANDS_ON.test(title))return {tier:'rejected',score:0,reasons:['Poste de designer exécutant exclu'],role:'design-execution',geo:'unknown'};
 if(JUNIOR.test(title))return {tier:'rejected',score:0,reasons:['Poste junior, stage ou alternance exclu'],role:'junior',geo:'unknown'};
 if(TECH.test(title))return {tier:'rejected',score:0,reasons:['Fonction hors direction créative / stratégie'],role:'other',geo:'unknown'};
 let role='unrelated',score=0;
 if(DEF.direction.test(title)){role='Direction créative';score=86}
 else if(DEF.strategy.test(title)){role='Stratégie de marque';score=84}
 else if(DEF.social.test(title)){role='Social media';score=81}
 else if(DEF.content.test(title)){role='Contenu / Campagnes';score=76}
 else if(DEF.adjacent.test(title)){role='Marketing adjacent';score=59}
 else return {tier:'rejected',score:0,reasons:['Poste hors périmètre métier'],role:'unrelated',geo:'unknown'};
 const reasons=[];
 if(/\b(senior|head|director|directeur|directrice|vp |vice president|lead|global|chief|principal)\b/.test(title)){score+=7;reasons.push('Responsabilité senior')}
 if(/\b(social media manager|community manager|marketing manager|content manager)\b/.test(title)&&!(/senior|head|director|lead/.test(title))){score-=8;reasons.push('Niveau à vérifier')}
 if(HEAVY_EXECUTION.test(description)){score-=23;reasons.push('Exécution graphique demandée : vérifier la fiche')}
 if(CREATIVE_LEAD.test(title)&&/\b(design|figma|adobe illustrator|photoshop)\b/.test(description)&&!HEAVY_EXECUTION.test(description)){score-=5;reasons.push('Compétences de production à vérifier')}
 if(/luxur|luxe|beaut|fashion|couture|hospitality|premium|brand identity|brand strategy|creative strategy|social media strategy/.test(whole+' '+employer)){score+=5;reasons.push('Univers créatif pertinent')}
 let geo='unknown';const remote=REMOTE.test(location+' '+work),france=FRENCH.test(location),europe=EUROPE.test(location+' '+work),foreign=FOREIGN_ONSITE.test(location);
 const locationScope=location+' '+work+' '+description.slice(0,1600);
 if(remote&&(RESTRICTED.test(locationScope)||(foreign&&!france&&!europe)))return {tier:'rejected',score:0,reasons:['Télétravail limité à un pays non compatible'],role,geo:'restricted'};
 if(PARIS.test(location)){geo='paris';score+=13;reasons.push('Paris / Île-de-France')}
 else if(france){geo='france';score+=10;reasons.push('France')}
 else if(remote&&europe){geo='europe-remote';score+=7;reasons.push('Remote Europe / EMEA')}
 else if(remote){geo='remote-unverified';score+=1;reasons.push('Remote : pays d’éligibilité non confirmé')}
 else if(foreign||(!remote&&location)){return {tier:'rejected',score:0,reasons:['Poste hors France, sans télétravail compatible'],role,geo:'foreign'};}
 else {geo='location-unverified';score-=4;reasons.push('Localisation à confirmer')}
 // Dates are evidence of freshness only when explicitly published, never inferred from an update timestamp.
 const d=new Date(input?.date);const age=Number.isFinite(d.valueOf())?(Date.now()-d.getTime())/86400000:null;
 if(age!==null&&age>=0&&age<21){score+=5;reasons.push('Publication récente')}
 else if(age!==null&&age>120)return {tier:'rejected',score:0,reasons:['Publication de plus de 120 jours'],role,geo};
 else if(age!==null&&age>60){score-=8;reasons.push('Date ancienne : vérifier l’ouverture')}
 // Remote without European eligibility cannot enter the priority tier.
 score=Math.max(0,Math.min(100,score));let tier=score>=82&&['paris','france','europe-remote'].includes(geo)&&role!=='Marketing adjacent'?'priority':'explore';
 if(role==='Marketing adjacent')tier='explore';
 if(/\b(social media manager|community manager|marketing manager|content manager)\b/.test(title)&&!/(senior|head|director|lead)/.test(title))tier='explore';
 if(score<48)tier='rejected';
 return {tier,score,reasons,role,geo,sector:sectorFor(whole+' '+employer),ageDays:age===null?null:Math.round(age)};
}
export function normalizeJob(raw,source){const title=String(raw.title||raw.text||raw.name||'').trim();const company=String(raw.company||source.company||'').trim();const url=String(raw.url||raw.absolute_url||raw.hostedUrl||raw.jobUrl||'').trim();if(!title||!company||!/^https:\/\//i.test(url))return null;
 const safeUrl=(()=>{try{const u=new URL(url);return !u.username&&!u.password?u.href:''}catch{return ''}})();if(!safeUrl)return null;
 const description=String(raw.description||raw.descriptionPlain||'').replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|amp|lt|gt|quot|#39|rsquo|ldquo|rdquo);/g,' ').replace(/\s+/g,' ').trim().slice(0,14500);
 return {id:String(raw.id||raw.jobId||url),title:title.slice(0,180),company:company.slice(0,160),location:String(raw.location||'').slice(0,180),description,url:safeUrl,date:String(raw.date||''),source:source.label,sourceType:source.type,workplaceType:String(raw.workplaceType||''),companyWebsite:String(raw.companyWebsite||'')};}
export function rankAndFilter(raw){const grouped=new Map(),stats={received:0,rejected:0,deduplicated:0,priority:0,explore:0};for(const job of raw){stats.received++;if(!job){stats.rejected++;continue}const fit=fitOpportunity(job);if(fit.tier==='rejected'){stats.rejected++;continue}const dedupKey=norm(job.title)+'|'+norm(job.company);const original=grouped.get(dedupKey);const item={...job,...fit};if(!original){grouped.set(dedupKey,item)}else{stats.deduplicated++;if(item.score>original.score||(!original.description&&item.description))grouped.set(dedupKey,item)}}const jobs=[...grouped.values()].sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));stats.priority=jobs.filter(j=>j.tier==='priority').length;stats.explore=jobs.filter(j=>j.tier==='explore').length;return {jobs,stats}}
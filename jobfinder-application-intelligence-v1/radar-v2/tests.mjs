import assert from 'node:assert/strict';import {fitOpportunity,normalizeJob,rankAndFilter} from './radarCore.mjs';import {SOURCES,fetchRadar,parseRoleFinderIndex,parseRoleFinderDetail} from './radarSources.mjs';
let total=0;const test=(label,fn)=>{fn();total++;console.log('PASS '+label)};
const job=(title,location='Paris, France',extra={})=>({title,company:'Editorial Agency',location,description:'Creative strategy and campaign production leadership for luxury and beauty brands',date:new Date().toISOString(),...extra});
for(const t of ['Graphic Designer','Product Designer','UX/UI Designer','Visual Designer','Motion Designer','Illustrateur','Graphiste','Photographer','3D Artist','Web Designer','Print Designer'])test('Exclude hands-on '+t,()=>assert.equal(fitOpportunity(job(t)).tier,'rejected'));
for(const t of ['Art Director','Creative Director','Senior Creative Strategist','Head of Social Media','Brand Strategist','Head of Content','Brand Director','Director of Social Media'])test('Include senior creative '+t,()=>assert.notEqual(fitOpportunity(job(t)).tier,'rejected'));
test('Biggie social content strategist included',()=>assert.notEqual(fitOpportunity(job('Social Media Content Strategist - Freelance')).tier,'rejected'));
test('Deliveroo creative campaigns lead included',()=>assert.notEqual(fitOpportunity(job('Local Lead, Creative Campaigns')).tier,'rejected'));
test('WPP Media social influence director identified',()=>assert.equal(fitOpportunity(job('Social Media & Influence Director H/F - CDI')).tier,'priority'));
test('Influence lead identified',()=>assert.notEqual(fitOpportunity(job('Strategic Influence Lead H/F - CDD 18 mois')).tier,'rejected'));
test('Paris Creative Director gets priority',()=>assert.equal(fitOpportunity(job('Creative Director')).tier,'priority'));
test('Remote EMEA strategy eligible',()=>assert.equal(fitOpportunity(job('Head of Social Media','Remote Europe',{workplaceType:'Remote'})).tier,'priority'));
test('US only remote rejected',()=>assert.equal(fitOpportunity(job('Creative Director','Remote, United States',{workplaceType:'Remote'})).tier,'rejected'));
test('London onsite rejected',()=>assert.equal(fitOpportunity(job('Brand Strategist','London, UK')).tier,'rejected'));
test('Junior and stage rejected',()=>assert.equal(fitOpportunity(job('Junior Creative Strategist')).tier,'rejected'));
test('Berlin on-site removed',()=>assert.equal(fitOpportunity(job('Creative Director','Berlin, Germany')).tier,'rejected'));
test('Uzbekistan on-site removed',()=>assert.equal(fitOpportunity(job('Brand Director','Tashkent, Uzbekistan')).tier,'rejected'));
test('Product marketing excluded',()=>assert.equal(fitOpportunity(job('Senior Product Marketing Manager')).tier,'rejected'));
test('Field marketing excluded',()=>assert.equal(fitOpportunity(job('Senior Field Marketing Manager')).tier,'rejected'));
test('Generic Social Media Manager remains explore',()=>assert.equal(fitOpportunity(job('Social Media Manager')).tier,'explore'));
test('Senior creative title with hands-on delivery flagged',()=>assert(fitOpportunity(job('Art Director','Paris, France',{description:'Daily graphic production and create illustrations. Adobe Illustrator required.'})).score<90));
test('Unknown remote not priority',()=>assert.notEqual(fitOpportunity(job('Creative Director','Remote',{workplaceType:'Remote'})).tier,'priority'));
test('Community manager merely exploratory',()=>assert.equal(fitOpportunity(job('Community Manager')).tier,'explore'));
test('Engineering job rejected',()=>assert.equal(fitOpportunity(job('Software Engineer')).tier,'rejected'));
test('No title rejected',()=>assert.equal(fitOpportunity(job('')).tier,'rejected'));
test('Older still-listed jobs remain reviewable',()=>assert.equal(fitOpportunity(job('Creative Director','Paris, France',{date:'2021-01-01'})).tier,'explore'));
test('Empty date still eligible',()=>assert.notEqual(fitOpportunity(job('Creative Director','Paris, France',{date:''})).tier,'rejected'));
test('Exact official https link required',()=>assert.equal(normalizeJob({title:'Creative Director',url:'http://example.com'},SOURCES[0]),null));
test('Normalize original ATS job',()=>assert.equal(normalizeJob({title:'Creative Director',absolute_url:'https://jobs.example.com/a',location:'Paris'},SOURCES[0]).company,'Pinterest'));
test('Deduplicate similar posts',()=>{const j=normalizeJob({title:'Creative Director',url:'https://job-boards.greenhouse.io/acme/a',location:'Paris'},SOURCES[0]);const result=rankAndFilter([j,{...j,id:'another',url:'https://jobs.lever.co/acme/a'}]);assert.equal(result.jobs.length,1);assert.equal(result.stats.deduplicated,1)});
test('Source config has broad employer & aggregator coverage',()=>{assert(SOURCES.length>=57);assert(SOURCES.filter(s=>s.type==='aggregate').length>=3)});

for(const t of ['Responsable communication digitale','Directeur de la communication','Responsable communication et marketing','Director of Marketing and Communications','Influencer and Social Media Lead','Influencer Marketing Manager','Brand Content Manager','Digital & Content Manager','Social Media and Content Strategist - Community','Global Content Lead'])test('Include leadership / strategy '+t,()=>assert.notEqual(fitOpportunity(job(t)).tier,'rejected'));
for(const t of ['Art Director, Brand & Marketing Design','Creative Lead & Maker','Content Creator','UI Designer','Senior Brand Designer'])test('Reject hands-on role '+t,()=>assert.equal(fitOpportunity(job(t)).tier,'rejected'));
test('Reject hands-on Illustrator role inside Art Director',()=>assert.equal(fitOpportunity(job('Art Director','Paris',{description:'Create graphic assets and design mockups daily. Adobe Illustrator required.'})).tier,'rejected'));
test('Berlin hybrid is not France-eligible remote',()=>assert.equal(fitOpportunity(job('Creative Director','Berlin, Germany',{workplaceType:'Hybrid'})).tier,'rejected'));
test('Remote Netherlands only must be rejected',()=>assert.equal(fitOpportunity(job('Head of Social Media','Remote - The Netherlands',{workplaceType:'Remote'})).tier,'rejected'));
test('Unrestricted Europe remote remains eligible',()=>assert.equal(fitOpportunity(job('Head of Social Media','Remote Europe',{workplaceType:'Remote'})).tier,'priority'));
test('Secondary aggregation cannot be Priority',()=>assert.equal(fitOpportunity(job('Creative Director','Paris',{sourceType:'rolefinder'})).tier,'explore'));
const listingHtml='<script type="application/ld+json">'+JSON.stringify({'@type':'ItemList',itemListElement:[{name:'Directeur communication',url:'https://jobs.urbanodx.com/job/abc'},{name:'Unknown',url:'https://evil.test/abc'}]})+'</script>';
test('RoleFinder only accepts indexed native job URLs',()=>assert.equal(parseRoleFinderIndex(listingHtml).length,1));
const detailHtml='<h1>Social Media Director</h1><p class="company-line"><a href="/companies/brand">Maison Brand</a></p><li><span class="k">Location</span>Paris; London</li><li><span class="k">Work type</span>Hybrid</li><li><span class="k">Posted</span>13 November 2026</li><a href="https://jobs.ashbyhq.com/brand/abc?utm_source=rolefinder&amp;utm_campaign=campaign" data-click="apply" data-co="Maison Brand">Apply</a>';
test('RoleFinder extracts employer, real geography and direct careers URL',()=>{const x=parseRoleFinderDetail(detailHtml,{title:'Social Media Director',url:'https://jobs.urbanodx.com/job/a'});assert.equal(x.company,'Maison Brand');assert.equal(x.location,'Paris; London');assert(x.url.startsWith('https://jobs.ashbyhq.com/'))});
test('RoleFinder rejects missing direct employer link',()=>assert.equal(parseRoleFinderDetail('<h1>Creative Director</h1><li><span class="k">Location</span>Paris</li>',{title:'Creative Director'}),null));
test('Rejection diagnostics available',()=>{const a=normalizeJob({title:'Graphic Designer',url:'https://jobs.example.com/1',location:'Paris'},SOURCES[0]);assert.equal(rankAndFilter([a]).stats.rejectionReasons.design,1)});


test('Whitespace company aliases deduplicate',()=>{const a=normalizeJob({title:'Social Media Director',company:'Hcompany',url:'https://jobs.ashbyhq.com/hcompany/a',location:'Paris'},SOURCES[0]);const b={...a,company:'H Company',sourceType:'rolefinder',url:'https://jobs.urbanodx.com/job/abc'};assert.equal(rankAndFilter([a,b]).jobs.length,1)});
test('Prefer employer ATS over secondary index on duplicates',()=>{const a=normalizeJob({title:'Brand Lead',company:'H Company',url:'https://jobs.ashbyhq.com/hcompany/abc',location:'Paris'},SOURCES[0]);const b={...a,sourceType:'rolefinder',source:'RoleFinder',url:'https://example.org/job/abc'};const x=rankAndFilter([b,a]);assert.equal(x.jobs[0].sourceType,'greenhouse')});
test('RoleFinder exploratory score capped',()=>{const j=fitOpportunity(job('Creative Director','Paris',{sourceType:'rolefinder'}));assert.equal(j.tier,'explore');assert(j.score<=76)});
test('Explicit graphic design duties excluded even in Art Director role',()=>assert.equal(fitOpportunity(job('Art Director','Paris',{description:'Create graphic assets, design mockups and production graphics for clients'})).tier,'rejected'));


test('Game asset art director excluded despite leadership title',()=>assert.equal(fitOpportunity(job('Art Director - Draft Showdown','Paris',{description:'Define artistic vision for a midcore mobile game. Character and environment art, UI/UX and VFX assets.'})).tier,'rejected'));
test('LATAM-only remote Creative Director excluded',()=>assert.equal(fitOpportunity(job('Creative Director / Associate Creative Director','LATAM, AR',{workplaceType:'Remote'})).tier,'rejected'));
test('Mexico-only remote Head of Influencer excluded',()=>assert.equal(fitOpportunity(job('Head of Influencer Marketing','Remote Mexico',{workplaceType:'Remote'})).tier,'rejected'));
test('Biggie vs Biggie Group are same employer for dedup',()=>{const a=normalizeJob({title:'Directeur de Clientèle Influence',company:'Biggie',url:'https://jobs.lever.co/biggie/1',location:'Paris'},SOURCES[0]);const b={...a,company:'Biggie Group',url:'https://example.net/biggie/2'};assert.equal(rankAndFilter([a,b]).jobs.length,1)});

test('Remote Barcelona without France/EU eligibility rejected',()=>assert.equal(fitOpportunity(job('Marketing Manager, Spain','Barcelona',{workplaceType:'Remote'})).tier,'rejected'));
test('Remote Berlin without France/EU eligibility rejected',()=>assert.equal(fitOpportunity(job('Creative Strategist','Berlin',{workplaceType:'Remote'})).tier,'rejected'));
console.log(total+'/'+total+' radar tests passed');
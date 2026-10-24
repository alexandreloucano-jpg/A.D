import { test,expect } from "@playwright/test";
import { parseArticle } from "../../server/market/analyze";

for(const width of [390,1440]){
  test(`A.D V3 Radar opens an evidence-linked dossier at ${width}px`,async({page},info)=>{
    await page.setViewportSize({width,height:width===390?844:900});
    const f=parseArticle(
      '<h1>Maison Orbe ouvrira un hôtel à Paris 8e</h1><time datetime="2026-10-15"></time><article class="article-content">La marque prépare une ouverture le 20 novembre 2026.</article>',
      "https://www.journalduluxe.fr/fr/mode/qa-fixture",
      new Date("2026-10-16")
    )!;
    let linkedProject:string|null=null;
    let links=0;
    await page.route("**/api/session",r=>r.fulfill({json:{authenticated:true,csrf:"fixture"}}));
    await page.route("**/api/market/**",async r=>{
      const p=new URL(r.request().url()).pathname;
      let b:unknown={};
      if(p.endsWith("/status"))b={enabled:true,sourceCount:1,lastRun:null,stale:false};
      else if(p.endsWith("/opportunities"))b={items:[f],nextCursor:null,totalApprox:1};
      else if(p.endsWith("/brief/today"))b={observations:[f],acceptedNowActions:[]};
      else if(p.endsWith("/sources"))b={items:[]};
      else if(p.endsWith("/review")){f.reviewState="saved";b=f;}
      else if(p.endsWith("/project")){
        links++;
        const v=JSON.parse(r.request().postData()||"{}");
        linkedProject=v.projectId;
        f.projectId=linkedProject;
        b=f;
      }else b={opportunity:f,actions:[],timeline:[],signals:[f],
        evidence:[{id:f.evidenceId,url:f.canonicalUrl,publisher:f.publisher,
          claimSupported:f.reportedFact,publishedAt:f.publishedAt}]};
      await r.fulfill({json:b});
    });
    await page.goto("/#/explorer");
    await page.getByRole("button",{name:"Examiner",exact:true}).click();
    await page.getByRole("button",{name:"Sauvegarder en pipeline"}).click();
    await expect(page.getByRole("button",{name:"Créer un dossier depuis cette opportunité"})).toBeEnabled();
    await page.getByRole("button",{name:"Créer un dossier depuis cette opportunité"}).click();
    await expect(page.getByRole("heading",{name:/Maison Orbe.*Opportunity Room/})).toBeVisible();
    await expect(page.getByRole("region",{name:"Preuves de l'opportunité"})).toContainText(f.reportedFact);
    await expect(page.getByRole("region",{name:"Preuves de l'opportunité"})).toContainText("LIEN SERVEUR CONFIRMÉ");
    const first=JSON.parse(await page.evaluate(()=>localStorage.getItem("ad.workspace.v1")||"{}"));
    expect(first.projects).toHaveLength(1);
    expect(first.opportunityLinks).toHaveLength(1);
    expect(first.opportunityLinks[0].evidence[0].url).toBe(f.canonicalUrl);
    expect(first.opportunityLinks[0].projectId).toBe(linkedProject);
    expect(links).toBe(1);
    await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Explorer"}).click();
    await page.getByRole("button",{name:"Examiner",exact:true}).click();
    await page.getByRole("button",{name:"Ouvrir le dossier associé"}).click();
    const after=JSON.parse(await page.evaluate(()=>localStorage.getItem("ad.workspace.v1")||"{}"));
    expect(after.projects).toHaveLength(1);
    expect(links).toBe(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath(`v3-opportunity-room-${width}.png`),fullPage:true});
  });
}

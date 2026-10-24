import {test,expect} from "@playwright/test";
import {emptyWorkspace} from "../../src/domain";
import {parseArticle} from "../../server/market/analyze";

for(const width of [390,1440]){
  test(`A.D global search, Saver masonry and Radar timeline ${width}px`,async({page},info)=>{
    await page.setViewportSize({width,height:width===390?844:900});
    await page.goto("/");
    const s=emptyWorkspace();
    const now=new Date().toISOString();
    const projectId="c424897f-a113-46fd-a960-c7d223b2e839";
    s.projects=[{id:projectId,title:"François 1er — creative office",updatedAt:now}];
    s.references=Array.from({length:12},(_,i)=>({
      id:`c424897f-a113-46fd-a960-${String(700000000000+i).padStart(12,"0")}`,
      title:i===0?"Architectural study":"Reference "+String(i+1),
      content:"Hospitality inspiration "+String(i+1),
      url:i===0?"https://example.org/architecture.webp":undefined,
      capturedAt:now,revision:1,origin:"human" as const,approvedAt:now,
      isInternalQA:false,
    }));
    await page.evaluate(data=>localStorage.setItem("ad.workspace.v1",JSON.stringify(data)),s);
    await page.reload();
    await page.getByRole("button",{name:"Rechercher partout"}).click();
    const search=page.getByRole("combobox",{name:"Rechercher partout"});
    await expect(search).toBeFocused();
    await search.fill("francois");
    await expect(page.getByRole("option",{name:/François 1er/})).toBeVisible();
    await search.press("Enter");
    await expect(page.getByRole("heading",{name:"François 1er — creative office"})).toBeVisible();
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("combobox",{name:"Rechercher partout"})).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Saver"}).click();
    const library=page.locator(".reference-grid");
    await expect(library).toHaveAttribute("data-layout","masonry");
    await expect(library.locator(".reference-card")).toHaveCount(12);
    await expect(library.locator(".reference-card[data-has-media=true]")).toHaveCount(1);
    await page.getByRole("button",{name:"Grille",exact:true}).click();
    await expect(library).toHaveAttribute("data-layout","grid");
    await page.getByRole("button",{name:"Mosaïque",exact:true}).click();
    await expect(library).toHaveAttribute("data-layout","masonry");
    const f=parseArticle(
      '<h1>Maison Orbe ouvrira un hôtel à Paris 8e</h1><time datetime="2026-10-15"></time><article class="article-content">La marque prépare une ouverture le 20 novembre 2026.</article>',
      "https://www.journalduluxe.fr/fr/mode/qa-fixture",new Date("2026-10-16")
    )!;
    await page.route("**/api/market/**",async r=>{
      const path=new URL(r.request().url()).pathname;let out:unknown={};
      if(path.endsWith("/status"))out={enabled:true,sourceCount:1,lastRun:null,stale:false};
      else if(path.endsWith("/opportunities"))out={items:[f],nextCursor:null,totalApprox:1};
      else if(path.endsWith("/brief/today"))out={observations:[f],acceptedNowActions:[]};
      else if(path.endsWith("/sources"))out={items:[]};
      else out={opportunity:f,actions:[],timeline:[{event:"reviewed",reason:"Source enregistrée",occurredAt:"2026-10-22T10:00:00.000Z"}],evidence:[]};
      await r.fulfill({json:out});
    });
    await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Explorer"}).click();
    await page.getByRole("button",{name:"Examiner",exact:true}).click();
    const timeline=page.getByRole("region",{name:"Chronologie sourcée de l'entreprise"});
    await expect(timeline).toBeVisible();
    await expect(timeline).toContainText("Publication source");
    await expect(timeline).toContainText("Décision · reviewed");
    await timeline.getByRole("button",{name:/Publication source/}).click();
    await expect(timeline).toContainText(f.reportedFact);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath(`ad-v3-interactions-${width}.png`),fullPage:true});
  });
}

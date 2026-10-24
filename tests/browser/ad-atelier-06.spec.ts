import {test,expect} from "@playwright/test";
import {emptyWorkspace} from "../../src/domain";

for(const viewport of [
  {width:390,height:640},{width:390,height:844},{width:768,height:1024},{width:1440,height:900}
]){
test(`A.D Atelier 06 / operational screen ${viewport.width}x${viewport.height}`,async({page},info)=>{
  await page.setViewportSize(viewport);
  await page.goto("/");
  await expect(page.getByRole("navigation",{name:"Navigation principale"})).toBeVisible();
  await expect(page.locator(".topbar")).toHaveCSS("background-color","rgb(232, 229, 221)");
  await expect(page.locator(".workspace")).toHaveCSS("background-color","rgb(242, 240, 234)");
  await expect(page.locator(".v4-mission")).toBeVisible();
  await expect(page.getByRole("heading",{level:1,name:/Aucune priorité/})).toBeVisible();
  await expect(page.locator(".v4-mission-stats")).toContainText("00");
  await expect(page.locator(".v4-intelligence")).toBeAttached();
  const bounds=await page.evaluate(()=>{
    const rect=(q:string)=>{const node=document.querySelector(q);if(!node)throw Error("Missing "+q);const b=node.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};};
    return {heading:rect(".v4-mission-hero h1"),description:rect(".ad-v2-description"),action:rect(".ad-v2-cta"),stats:rect(".ad-v2-counters"),rail:rect(".ad-v2-rail"),focus:rect(".ad-v2-focus"),topbar:rect(".topbar")};
  });
  expect(bounds.description.top).toBeGreaterThanOrEqual(bounds.heading.bottom+8);
  expect(bounds.action.top).toBeGreaterThanOrEqual(bounds.description.bottom+9);
  expect(bounds.stats.top).toBeGreaterThanOrEqual(bounds.action.bottom+10);
  if(viewport.width<=850){
    expect(bounds.rail.top).toBeGreaterThanOrEqual(bounds.stats.bottom+8);
    expect(bounds.heading.left).toBeGreaterThanOrEqual(-1);
    expect(bounds.heading.right).toBeLessThanOrEqual(viewport.width+1);
    expect(bounds.topbar.top).toBeGreaterThanOrEqual(-1);
  }else{
    expect(bounds.rail.left).toBeGreaterThanOrEqual(bounds.focus.right-1);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath(`atelier06-today-empty-${viewport.width}x${viewport.height}.png`),fullPage:true});
  const nav=page.getByRole("navigation",{name:"Navigation principale"});
  await page.getByRole("button",{name:"Rechercher partout"}).click();
  await expect(page.getByRole("combobox",{name:"Rechercher partout"})).toBeFocused();
  await page.keyboard.press("Escape");
  for(const section of ["Explorer","Saver","Projets"]){
    await nav.getByRole("link",{name:section}).click();
    await expect(page.getByRole("heading",{level:1})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
});
}

test("Atelier 06 / populated real workspace persists without fake counters",async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/");
  const data=emptyWorkspace(),now=new Date().toISOString();
  data.projects=[{id:"1d336cdf-a52b-4d49-9cba-2a5ef1089086",title:"Projet documentaire",updatedAt:now}];
  await page.evaluate(ws=>localStorage.setItem("ad.workspace.v1",JSON.stringify(ws)),data);
  await page.reload();
  await expect(page.locator(".v4-mission-stats")).toContainText("01");
  await expect(page.locator(".v4-record")).toContainText("Projet documentaire");
  await page.getByRole("button",{name:"Voir mes dossiers"}).click();
  await expect(page.getByRole("heading",{name:/Projet/}).first()).toBeVisible();
  await page.screenshot({path:info.outputPath("atelier06-projects-populated-390.png")});
});

for(const width of [390,1440]){
test(`Atelier 06 / Studio honest public surface ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:width===390?844:900});
  await page.goto("/studio");
  await expect(page.locator(".ad-landing")).toHaveCSS("background-color","rgb(242, 240, 234)");
  await expect(page.locator(".ad-nav")).toHaveCSS("background-color","rgb(232, 229, 221)");
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Brand Thesis"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath(`atelier06-studio-${width}.png`),fullPage:true});
});
}

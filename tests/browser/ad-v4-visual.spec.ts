import {test,expect} from "@playwright/test";

for(const size of [{width:390,height:844},{width:390,height:640},{width:768,height:1024},{width:1440,height:900}]){
 test(`minimal A.D Today stays readable at ${size.width}×${size.height}`,async({page},info)=>{
  await page.setViewportSize(size);await page.goto("/");
  await expect(page.locator(".workspace")).toHaveCSS("background-color","rgb(255, 255, 255)");
  await expect(page.locator(".topbar")).toHaveCSS("background-color","rgb(255, 255, 255)");
  await expect(page.getByRole("heading",{level:1,name:"Aujourd’hui"})).toBeVisible();
  await expect(page.locator(".home-minimal-section[aria-label='Directions artistiques']")).toBeVisible();
  await expect(page.locator(".market-home")).toBeVisible();
  await expect(page.locator(".home-workspace-grid > .market-home")).toHaveCount(1);
  const bounds=await page.evaluate(()=>{
   const box=(q:string)=>{const e=document.querySelector(q);if(!e)throw Error("Missing "+q);const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
   return {nav:box(".topbar nav"),main:box("#main-content"),home:box(".home-minimal"),da:box(".home-minimal-section"),market:box(".market-home"),width:innerWidth,scrollWidth:document.documentElement.scrollWidth};
  });
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width+1);
  expect(bounds.da.top).toBeGreaterThan(bounds.home.top);
  expect(bounds.market.top).toBeGreaterThan(bounds.home.top);
  if(size.width>760)expect(bounds.main.left).toBeGreaterThanOrEqual(bounds.nav.right-1);
  await page.screenshot({path:info.outputPath(`ad-today-minimal-${size.width}x${size.height}.png`),fullPage:true});
 });
}

test("new shell retains functional search, files and navigation",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/");
 await page.getByRole("button",{name:"Rechercher partout"}).click();
 await expect(page.getByRole("combobox",{name:"Rechercher partout"})).toBeFocused();
 await page.keyboard.press("Escape");
 for(const [route,label] of [["explorer","Radar"],["saver","Bibliothèque"],["projets","Travail"]]){
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:label}).click();
  await expect(page).toHaveURL(new RegExp("#/"+route));
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
 }
 await page.getByRole("button",{name:"Réglages et sauvegarde"}).click();
 await expect(page.getByRole("dialog")).toBeVisible();
});

test("Studio identity remains independent from the private dashboard",async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/studio");
 await expect(page.locator(".ad-landing")).toHaveCSS("background-color","rgb(241, 241, 241)");
 await expect(page.locator(".ad-nav")).toHaveCSS("background-color","rgb(241, 241, 241)");
 await expect(page.locator(".ad-hero")).toHaveCSS("background-color","rgb(43, 43, 43)");
 await expect(page.getByRole("heading",{level:1})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath("v4-studio-mobile.png"),fullPage:true});
});


test("phone tabs and settings use a bottom sheet",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/");
 const nav=page.getByRole("navigation",{name:"Navigation principale"});
 await expect(nav).toHaveCSS("position","fixed");
 await expect(nav).toHaveCSS("background-color","rgb(255, 255, 255)");
 const tabs=await nav.getByRole("link").evaluateAll(links=>links.map(link=>{
  const rect=link.getBoundingClientRect();
  return {width:rect.width,height:rect.height};
 }));
 expect(tabs).toHaveLength(4);
 expect(tabs.every(tab=>tab.width>=44&&tab.height>=44)).toBe(true);
 await page.getByRole("button",{name:"Réglages et sauvegarde"}).click();
 const sheet=await page.locator("dialog[open]").boundingBox();
 expect(sheet).not.toBeNull();
 if(sheet){
  expect(sheet.x).toBe(0);
  expect(sheet.width).toBe(390);
  expect(Math.abs(sheet.y+sheet.height-844)).toBeLessThanOrEqual(1);
 }
});

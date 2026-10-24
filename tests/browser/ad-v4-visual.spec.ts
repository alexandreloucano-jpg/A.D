import {test,expect} from "@playwright/test";

for(const size of [{width:390,height:844},{width:390,height:640},{width:768,height:1024},{width:1440,height:900}]){
 test(`A.D V4 original visual instrument at ${size.width}×${size.height}`,async({page},info)=>{
  await page.setViewportSize(size);await page.goto("/");
  const shell=page.locator(".workspace");
  await expect(shell).toHaveCSS("background-color","rgb(239, 242, 241)");
  await expect(page.locator(".topbar")).toHaveCSS("background-color","rgb(18, 38, 44)");
  await expect(page.locator(".ad-v2-priority")).toHaveCSS("background-color","rgb(24, 55, 61)");
  await expect(page.getByRole("heading",{name:/Aucune priorité/})).toBeVisible();
  await expect(page.getByRole("navigation",{name:"Navigation principale"})).toBeVisible();
  const infoBox=await page.evaluate(()=>{
   const get=(q:string)=>{const el=document.querySelector(q);if(!el)throw Error("Missing "+q);const b=el.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom};};
   return {top:get(".topbar"),main:get("#main-content"),hero:get(".ad-v2-priority"),stats:get(".ad-v2-counters"),nav:get(".topbar nav"),windowWidth:window.innerWidth};
  });
  expect(infoBox.hero.w).toBeGreaterThan(230);
  expect(infoBox.stats.y).toBeGreaterThan(infoBox.hero.bottom);
  const noteGeometry=await page.evaluate(()=>{
    const hero=document.querySelector(".ad-v2-priority")!.getBoundingClientRect();
    const button=document.querySelector(".ad-v2-restore button")!.getBoundingClientRect();
    return {heroBottom:hero.bottom,buttonBottom:button.bottom};
  });
  expect(noteGeometry.buttonBottom,"Recovery button must be fully contained in decision panel").toBeLessThanOrEqual(noteGeometry.heroBottom-8);
  if(size.width<=760) {
    const flow=await page.evaluate(()=>{
      const rect=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
      return {focusBottom:rect(".ad-v2-focus").bottom,counterBottom:rect(".ad-v2-counters").bottom,railTop:rect(".ad-v2-rail").top,railHeadingTop:rect(".ad-v2-rail .ad-v2-heading-line").top};
    });
    expect(flow.focusBottom,"Decision section must enclose stats").toBeGreaterThanOrEqual(flow.counterBottom-1);
    expect(flow.railTop,"Intelligence rail must not overlap counters").toBeGreaterThanOrEqual(flow.counterBottom+12);
    expect(flow.railHeadingTop,"Rail text must start after counters").toBeGreaterThanOrEqual(flow.counterBottom+12);
  }
  if(size.width>760){
   expect(infoBox.top.w).toBeGreaterThan(170);
   expect(infoBox.main.x).toBeGreaterThanOrEqual(infoBox.top.right-1);
   expect(infoBox.nav.h).toBeGreaterThan(100);
  }else{
   expect(infoBox.main.y).toBeGreaterThanOrEqual(infoBox.top.bottom-1);
   expect(infoBox.nav.y).toBeGreaterThan(size.height-90);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath(`v4-home-${size.width}x${size.height}.png`),fullPage:true});
 });
}
test("new shell retains functional search, files and navigation",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/");
 await page.getByRole("button",{name:"Rechercher partout"}).click();
 await expect(page.getByRole("combobox",{name:"Rechercher partout"})).toBeFocused();
 await page.keyboard.press("Escape");
 for(const [route,label] of [["explorer","Explorer"],["saver","Saver"],["projets","Projets"]]){
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:label}).click();
  await expect(page).toHaveURL(new RegExp("#/"+route));
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
 }
 await page.getByRole("button",{name:"Réglages et sauvegarde"}).click();
 await expect(page.getByRole("dialog")).toBeVisible();
});
test("Studio identity updates without enabling lead intake",async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/studio");
 await expect(page.locator(".ad-landing")).toHaveCSS("background-color","rgb(239, 242, 241)");
 await expect(page.locator(".ad-nav")).toHaveCSS("background-color","rgb(239, 242, 241)");
 await expect(page.locator(".ad-hero")).toHaveCSS("background-color","rgb(20, 48, 55)");
 await expect(page.getByRole("heading",{level:1})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath("v4-studio-mobile.png"),fullPage:true});
});

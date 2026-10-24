import {test,expect} from "@playwright/test";
for(const viewport of [{width:390,height:844},{width:390,height:640},{width:1440,height:900}]){
 test(`A.D INDEX / original visual system and live interaction integrity ${viewport.width}x${viewport.height}`,async({page},info)=>{
  await page.setViewportSize(viewport);
  await page.goto("/");
  const workspace=page.locator(".workspace");
  await expect(workspace).toHaveCSS("background-color","rgb(232, 235, 234)");
  await expect(page.locator(".topbar")).toHaveCSS("background-color","rgb(15, 28, 35)");
  await expect(page.locator(".ad-v2-focus h1")).toHaveCSS("font-family",/"Helvetica Neue"|Arial/);
  await expect(page.getByRole("heading",{level:1})).toContainText("Aucune priorité");
  await expect(page.locator(".ad-v2-priority").getByRole("button",{name:"Créer un dossier"})).toBeVisible();
  const rects=await page.evaluate(()=>{
    const rect=(sel:string)=>{const r=document.querySelector(sel)!.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom}};
    return {workspace:rect(".workspace"),nav:rect(".topbar nav"),main:rect("main"),focus:rect(".ad-v2-focus"),rail:rect(".ad-v2-rail")};
  });
  if(viewport.width<=760){
    expect(rects.nav.top).toBeGreaterThanOrEqual(viewport.height-105);
    expect(rects.main.top).toBeGreaterThanOrEqual(rects.workspace.top+58);
    expect(rects.focus.left).toBeGreaterThanOrEqual(rects.main.left-1);
    expect(rects.focus.right).toBeLessThanOrEqual(rects.main.right+1);
    await expect(page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Saver"})).toBeVisible();
  }else{
    expect(rects.nav.right).toBeLessThan(rects.main.left+2);
  }
  await page.getByRole("button",{name:"Rechercher partout"}).click();
  await expect(page.getByRole("combobox",{name:"Rechercher partout"})).toBeFocused();
  await page.keyboard.press("Escape");
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Explorer"}).click();
  await expect(page.getByRole("heading",{name:"Explorer."})).toBeVisible();
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Saver"}).click();
  await expect(page.getByRole("heading",{name:"Saver."})).toBeVisible();
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Projets"}).click();
  await expect(page.getByRole("heading",{name:"Projets."})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath(`index-v4-workspace-${viewport.width}x${viewport.height}.png`),fullPage:true});
 });
}
test("A.D Studio public uses new type, signalled actions and preserves inbound CTA",async({page},info)=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/studio");
 await expect(page.locator(".ad-hero")).toHaveCSS("background-color","rgb(15, 28, 35)");
 await expect(page.locator(".ad-hero-watermark")).toBeHidden();
 await expect(page.getByRole("link",{name:/Parler de votre marque/}).first()).toBeVisible();
 await page.screenshot({path:info.outputPath("index-v4-studio-mobile.png"),fullPage:true});
});

import {test,expect} from "@playwright/test";
const sizes=[{width:390,height:844},{width:390,height:640},{width:1440,height:900}];
for(const viewport of sizes){
  test(`Signal Desk — original art direction and critical navigation ${viewport.width}x${viewport.height}`,async({page},info)=>{
    await page.setViewportSize(viewport);
    await page.goto("/");
    const nav=page.getByRole("navigation",{name:"Navigation principale"});
    await expect(page.locator(".topbar")).toHaveCSS("background-color","rgb(13, 21, 23)");
    await expect(page.locator(".workspace")).toHaveCSS("background-color","rgb(237, 240, 238)");
    await expect(page.getByRole("heading",{name:/Aucune priorité/})).toBeVisible();
    await expect(page.getByRole("button",{name:"Créer mon premier dossier"})).toBeVisible();
    await expect(page.locator(".ad-issue-stage")).toHaveCSS("background-color","rgb(13, 21, 23)");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    if(viewport.width<700){
      const geo=await page.evaluate(()=>{
        const nav=document.querySelector(".topbar nav")!.getBoundingClientRect();
        const head=document.querySelector(".topbar")!.getBoundingClientRect();
        const hero=document.querySelector(".ad-issue-stage")!.getBoundingClientRect();
        return {navBottom:nav.bottom,headerTop:head.top,headerBottom:head.bottom,heroLeft:hero.left,heroRight:hero.right};
      });
      expect(geo.navBottom).toBeGreaterThanOrEqual(viewport.height-2);
      expect(geo.headerTop).toBe(0);
      expect(geo.heroLeft).toBeGreaterThanOrEqual(-1);
      expect(geo.heroRight).toBeLessThanOrEqual(viewport.width+1);
    } else {
      const sidebar=await page.locator(".topbar").boundingBox();
      expect(sidebar?.width).toBeGreaterThan(190);
      expect(sidebar?.height).toBeGreaterThanOrEqual(viewport.height-1);
    }
    await page.screenshot({path:info.outputPath(`signal-desk-today-${viewport.width}-${viewport.height}.png`),fullPage:true});
    await nav.getByRole("link",{name:"Explorer"}).click();
    await expect(page.getByRole("heading",{name:"Explorer",exact:true})).toBeVisible();
    await page.screenshot({path:info.outputPath(`signal-desk-radar-${viewport.width}.png`)});
    await nav.getByRole("link",{name:"Saver"}).click();
    await expect(page.getByRole("heading",{name:"Saver",exact:true})).toBeVisible();
    await nav.getByRole("link",{name:"Projets"}).click();
    await expect(page.getByRole("heading",{name:"Projets",exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  });
}
for(const width of [390,1440]){
  test(`Public Studio — matching new direction at ${width}`,async({page},info)=>{
    await page.setViewportSize({width,height:width===390?844:900});
    await page.goto("/studio");
    await expect(page.locator(".ad-nav")).toHaveCSS("background-color","rgb(13, 21, 23)");
    await expect(page.getByRole("heading",{level:1})).toBeVisible();
    await expect(page.locator(".ad-hero")).toHaveCSS("background-color","rgb(13, 21, 23)");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath(`signal-desk-studio-${width}.png`),fullPage:true});
  });
}

import { test, expect } from "@playwright/test";

for (const viewport of [{width:1440,height:900},{width:390,height:844},{width:390,height:640}]) {
  test(`A.D V2 editorial desk and navigation at ${viewport.width}x${viewport.height}`, async ({page}, info) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading",{level:1})).toContainText("Aucune priorité");
    await expect(page.getByRole("button",{name:"Créer un dossier"})).toBeVisible();
    await expect(page.locator(".workspace")).toHaveCSS("background-color","rgb(247, 246, 242)");
    await expect(page.locator(".workspace")).toHaveCSS("background-image","none");
    for(const label of ["Accueil","Explorer","Saver","Projets"]) {
      await expect(page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:label,exact:true})).toBeVisible();
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath(`ad-v2-today-${viewport.width}x${viewport.height}.png`),fullPage:true});
    await page.getByRole("button",{name:"Créer un dossier"}).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button",{name:"Fermer"}).click();
  });
}
test("A.D V2 preserves current actions and source navigation",async({page})=>{
  await page.goto("/");
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Explorer"}).click();
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Saver"}).click();
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Projets"}).click();
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
});

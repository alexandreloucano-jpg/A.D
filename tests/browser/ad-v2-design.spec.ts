import { test, expect } from "@playwright/test";

for (const viewport of [{width:1440,height:900},{width:390,height:844},{width:390,height:640}]) {
  test(`A.D V2 editorial desk and navigation at ${viewport.width}x${viewport.height}`, async ({page}, info) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading",{level:1})).toContainText("Aucune priorité");
    await expect(page.locator(".ad-v2-priority").getByRole("button",{name:"Créer un dossier"})).toBeVisible();
    await expect(page.locator(".workspace")).toHaveCSS("background-color","rgb(247, 246, 242)");
    await expect(page.locator(".workspace")).toHaveCSS("background-image","none");
    for(const label of ["Accueil","Explorer","Saver","Projets"]) {
      await expect(page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:label,exact:true})).toBeVisible();
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath(`ad-v2-today-${viewport.width}x${viewport.height}.png`),fullPage:true});
    await page.locator(".ad-v2-priority").getByRole("button",{name:"Créer un dossier"}).click();
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


// Geometry regressions: prior 390px screenshots showed THE DESK painting on top
// of "Aucune priorité", recent projects and the three factual counters.
// Horizontal-overflow-only checks did not detect the collision.
async function expectTodayMobileSectionsDoNotOverlap(page: import("@playwright/test").Page) {
  const rects = await page.evaluate(() => {
    const rect = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) throw new Error("Missing design node: " + selector);
      const b = node.getBoundingClientRect();
      return {top:b.top, bottom:b.bottom, left:b.left, right:b.right};
    };
    return {
      title: rect(".ad-v2-priority h1"),
      description: rect(".ad-v2-description"),
      cta: rect(".ad-v2-cta"),
      counters: rect(".ad-v2-counters"),
      focus: rect(".ad-v2-focus"),
      rail: rect(".ad-v2-rail"),
      scrollViewport: rect(".ad-v2-home"),
    };
  });
  expect(rects.description.top, "description must come below headline").toBeGreaterThanOrEqual(rects.title.bottom + 8);
  expect(rects.cta.top, "CTA must come after description").toBeGreaterThanOrEqual(rects.description.bottom + 8);
  expect(rects.counters.top, "facts must be below CTA").toBeGreaterThanOrEqual(rects.cta.bottom + 12);
  expect(rects.rail.top, "rail must start below complete priority block").toBeGreaterThanOrEqual(rects.focus.bottom + 20);
  expect(rects.focus.left).toBeGreaterThanOrEqual(rects.scrollViewport.left - 1);
  expect(rects.focus.right).toBeLessThanOrEqual(rects.scrollViewport.right + 1);
}

for (const height of [844, 640]) {
  test(`A.D V2 populated TODAY has no overlapping mobile sections at 390×${height}`, async ({page}, info) => {
    await page.setViewportSize({width:390,height});
    await page.goto("/");
    await expectTodayMobileSectionsDoNotOverlap(page);
    await page.locator(".ad-v2-priority").getByRole("button",{name:"Créer un dossier"}).click();
    await page.getByLabel("Nom du projet").fill("Projet de test mobile V2");
    await page.getByRole("button",{name:"Créer le projet",exact:true}).click();
    const dismiss = page.getByRole("button",{name:"Masquer le message"});
    if(await dismiss.isVisible()) await dismiss.click();
    await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Accueil"}).click();
    await expect(page.locator(".ad-v2-rail")).toContainText("Projet de test mobile V2");
    await expectTodayMobileSectionsDoNotOverlap(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({path:info.outputPath(`ad-v2-mobile-populated-top-390x${height}.png`)});
    await page.locator(".ad-v2-home").evaluate(node => node.scrollTo({top:node.scrollHeight,behavior:"instant"}));
    await page.screenshot({path:info.outputPath(`ad-v2-mobile-populated-bottom-390x${height}.png`)});
  });
}

test("A.D beta restores one genuine prior dossier using a backup, never fabricates one",async({page})=>{
  const {readFile}=await import("node:fs/promises");
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.getByRole("button",{name:"Créer un dossier"}).click();
  await page.getByLabel("Nom du projet").fill("Dossier historique de test");
  await page.getByRole("button",{name:"Créer le projet",exact:true}).click();
  await page.getByRole("button",{name:"Réglages et sauvegarde"}).click();
  await page.getByText("Sauvegarde et restauration",{exact:true}).click();
  const wait=page.waitForEvent("download");
  await page.getByRole("button",{name:"Exporter mes données"}).click();
  const backup=await wait;
  const bytes=await readFile(await backup.path());
  await page.evaluate(()=>localStorage.removeItem("ad.workspace.v1"));
  await page.reload();
  await expect(page.getByRole("button",{name:"Récupérer mes anciens dossiers"})).toBeVisible();
  await page.getByRole("button",{name:"Récupérer mes anciens dossiers"}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Importer une sauvegarde")).toBeVisible();
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name:"ad-workspace-backup.json",mimeType:"application/json",buffer:bytes,
  });
  await expect(page.getByText(/1 projet\(s\)/)).toBeVisible();
  await page.getByRole("button",{name:"Confirmer le remplacement"}).click();
  await page.getByRole("button",{name:"Fermer"}).click();
  await page.reload();
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Projets"}).click();
  await expect(page.getByText("Dossier historique de test").first()).toBeVisible();
});

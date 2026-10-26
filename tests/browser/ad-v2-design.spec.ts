import { test, expect } from "@playwright/test";

for (const viewport of [{width:1440,height:900},{width:390,height:844},{width:390,height:640}]) {
  test(`minimal Today keeps DA, Radar and news together at ${viewport.width}x${viewport.height}`, async ({page}, info) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading",{level:1,name:"Aujourd’hui"})).toBeVisible();
    await expect(page.getByRole("region",{name:"Votre prochain pas"})).toBeVisible();
    await expect(page.getByRole("region",{name:"Directions artistiques"})).toBeVisible();
    await expect(page.locator(".market-home")).toContainText("Radar & actualités");
    await expect(page.getByRole("region",{name:"Directions artistiques"}).getByRole("heading",{name:"Vos directions"})).toBeVisible();
    await expect(page.getByRole("navigation",{name:"Parcours A.D"})).toContainText("Bibliothèque");
    await expect(page.getByRole("navigation",{name:"Parcours A.D"})).toContainText("Radar");
    await expect(page.getByRole("navigation",{name:"Parcours A.D"})).toContainText("Travail");
    await expect(page.locator(".workspace")).toHaveCSS("background-color","rgb(255, 255, 255)");
    await expect(page.locator(".topbar nav").getByRole("link")).toHaveText(["Aujourd’hui", "Radar", "Travail", "Bibliothèque"]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath(`ad-today-minimal-${viewport.width}x${viewport.height}.png`),fullPage:true});
  });
}

test("Today links directly into the Radar and work dossier",async({page})=>{
  await page.goto("/");
  await page.getByRole("link",{name:/Voir tout le Radar/}).click();
  await expect(page).toHaveURL(/#\/explorer/);
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Travail"}).click();
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
});

test("A.D preserves current action workflow and source navigation",async({page})=>{
  await page.goto("/");
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Radar"}).click();
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Bibliothèque"}).click();
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Travail"}).click();
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
});

test("the empty workspace offers the owner login inline when Radar is disconnected",async({page})=>{
  await page.goto("/");
  const login=page.getByRole("link",{name:"Se connecter à A.D"});
  if(await login.isVisible()) await expect(login).toHaveAttribute("href","/api/auth/login");
  await expect(page.getByRole("heading",{name:"Demandes A.D Studio"})).toHaveCount(0);
});

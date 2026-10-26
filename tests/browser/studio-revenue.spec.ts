import { test,expect } from "@playwright/test";
for(const width of [390,1440]){
  test(`A.D Studio public frontend renders honest lead CTA at ${width}px`,async({page},info)=>{
    await page.setViewportSize({width,height:width===390?844:900});
    await page.goto("/studio");
    await expect(page).toHaveTitle(/A\.D Studio/);
    await expect(page.getByRole("heading",{level:1})).toContainText("Elle a besoin d’une direction.");
    await expect(page.getByRole("heading",{name:"Brand Thesis"})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Creative Office"})).toBeVisible();
    if(width===390){
      await page.getByRole("button",{name:"Ouvrir le menu"}).click();
      await expect(page.getByRole("navigation",{name:"Navigation principale"})).toBeVisible();
      await page.getByRole("button",{name:"Fermer le menu"}).click();
    }
    await page.getByLabel("Votre nom").fill("Alexis Martin");
    await page.getByLabel("Email professionnel").fill("alexis@example.org");
    await page.getByLabel("Marque / entreprise").fill("Maison fictive");
    await page.getByLabel("Secteur").selectOption({label:"Mode / beauté / lifestyle"});
    await page.getByLabel("Votre enjeu aujourd'hui").fill("Développer une maison de créateur avec une identité durable.");
    await expect(page.getByRole("button",{name:"Copier mon brief"})).toBeVisible();
    await page.getByRole("button",{name:"Copier mon brief"}).click();
    await expect(page.getByRole("status")).toContainText(/aucun message n'a été envoyé|canal de contact|enregistrée sur votre appareil/i);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    expect(overflow).toBe(false);
    await page.screenshot({path:info.outputPath(`ad-studio-public-${width}.png`),fullPage:true});
  });
}
test("private Studio inbox stays out of the local workspace",async({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{level:1})).toHaveText("Aujourd’hui");
  await expect(page.locator(".ad-studio-inbox")).toHaveCount(0);
  await page.getByRole("navigation").getByRole("link",{name:"Travail"}).click();
  await expect(page.locator(".ad-studio-inbox")).toHaveCount(0);
});

import { test, expect } from "@playwright/test";

for (const width of [390, 1440]) {
  test("A.D Studio /studio — landing publique et brief de contact (" + width + "px)", async ({page}) => {
    await page.setViewportSize({width, height: width === 390 ? 844 : 900});
    await page.goto("/studio");
    await expect(page).toHaveTitle(/A\.D Studio/);
    await expect(page.getByRole("heading", {level: 1})).toContainText("Elle a besoin d’une direction.");
    await expect(page.getByRole("heading", {name: "Brand Thesis"})).toBeVisible();
    await expect(page.getByRole("heading", {name: "Creative Office"})).toBeVisible();
    if (width === 390) {
      await page.getByRole("button", {name: "Ouvrir le menu"}).click();
      await expect(page.getByRole("navigation", {name: "Navigation principale"})).toBeVisible();
      await page.getByRole("button", {name: "Fermer le menu"}).click();
    }
    const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflowing).toBe(false);
    await page.getByLabel("Votre nom").fill("Camille Test");
    await page.getByLabel("Email professionnel").fill("camille@example.org");
    await page.getByLabel("Marque / entreprise").fill("Maison Test");
    await page.getByLabel("Secteur").selectOption({label: "Hospitality / restauration"});
    await page.getByLabel("Votre enjeu aujourd'hui").fill("Développer une identité qui résiste à une deuxième ouverture.");
    const copy = page.getByRole("button", {name: /Copier mon brief/});
    if (await copy.isVisible()) {
      await copy.click();
      await expect(page.getByRole("status")).toContainText(/aucun message n'a été envoyé|aucune donnée n'a été envoyée/);
    }
  });
}

test("la landing n'altère pas l'espace personnel existant", async ({page}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", {level: 1})).toContainText("Sur quoi veux-tu");
});

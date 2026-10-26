import { expect, test } from "@playwright/test";

test("empty Today starts from the user's intent instead of sending everyone to Radar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Qu’est-ce que vous voulez faire avancer ?",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /J’ai une intention ou un brief/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /J’ai une référence à garder/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Je cherche une opportunité/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Vérifier le Radar" }),
  ).toHaveCount(0);
  await expect(page.locator(".market-home")).toBeVisible();

  await page
    .getByRole("button", { name: /J’ai une intention ou un brief/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Nom du projet").fill("Brief onboarding de validation");
  await page
    .getByRole("button", { name: "Créer le projet", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: "Construire la direction." }),
  ).toBeVisible();
  await expect(page.locator(".home-onboarding")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Aujourd’hui" })
    .click();
  await expect(page.locator(".home-next-step")).toContainText(
    "Brief onboarding de validation",
  );
  await expect(
    page.getByRole("heading", { name: "Vérifier le Radar" }),
  ).toHaveCount(0);
});

test("reference and opportunity remain optional onboarding entry points", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /J’ai une référence à garder/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Garder une idée.");
  await page.getByRole("button", { name: "Fermer" }).click();

  await page
    .getByRole("button", { name: /Je cherche une opportunité/ })
    .click();
  await expect(page).toHaveURL(/#\/explorer$/);
  await expect(page.locator("h1")).toContainText("Radar");
});

import { test, expect, type Page } from "@playwright/test";
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("link", { name, exact: true })
    .click();
}
async function dismiss(page: Page) {
  const button = page.getByRole("button", { name: "Masquer le message" });
  if (await button.isVisible()) await button.click();
}
async function createProject(page: Page, title: string) {
  await nav(page, "Projets");
  const back = page.getByRole("button", { name: "Tous les projets" });
  if (await back.isVisible()) await back.click();
  await page.getByRole("button", { name: "Nouveau projet" }).click();
  await page.getByLabel("Nom du projet").fill(title);
  await page
    .getByRole("button", { name: "Créer le projet", exact: true })
    .click();
  await dismiss(page);
}
async function capture(page: Page, title: string, url = "") {
  await page.getByRole("button", { name: "Capturer", exact: true }).click();
  await page.getByLabel("Titre (facultatif)").fill(title);
  await page
    .getByLabel("Votre pensée")
    .fill(
      "Contenu synthétique de validation, saisi dans un contexte de test séparé.",
    );
  if (url) await page.getByLabel("Lien source").fill(url);
  await page.getByRole("button", { name: "Sauvegarder", exact: true }).click();
  await dismiss(page);
}
for (const width of [390, 1440]) {
  test(`navigation conserve dossier, archives, recherche et filtre — ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto("/");
    await createProject(page, "Navigation de validation");
    await page.getByLabel("Nouvelle suggestion").fill("Suggestion réversible");
    await page.getByRole("button", { name: "Ajouter à LATER" }).click();
    await dismiss(page);
    await page.getByRole("button", { name: "Écarter", exact: true }).click();
    await dismiss(page);
    await page.getByRole("button", { name: "Archives (1)" }).click();
    const archiveURL = page.url();
    await nav(page, "Explorer");
    await nav(page, "Projets");
    await expect(page).toHaveURL(archiveURL);
    await expect(page.getByText("KILL · ÉCARTÉ")).toBeVisible();
    await page.reload();
    await expect(page.getByText("KILL · ÉCARTÉ")).toBeVisible();
    await page.getByRole("button", { name: "Tous les projets" }).click();
    await page.goBack();
    await expect(page).toHaveURL(archiveURL);
    await expect(
      page.getByRole("button", { name: "Restaurer dans LATER" }),
    ).toBeVisible();
    await capture(page, "Note pour recherche");
    await capture(page, "Lien de validation", "https://example.org/qa");
    await page.getByRole("button", { name: "Notes 1", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Rechercher", exact: true })
      .fill("recherche");
    await expect(page.locator(".reference-card")).toHaveCount(1);
    const searchURL = page.url();
    await nav(page, "Explorer");
    await nav(page, "Saver");
    await expect(page).toHaveURL(searchURL);
    await expect(
      page.getByRole("textbox", { name: "Rechercher", exact: true }),
    ).toHaveValue("recherche");
    await expect(page.getByRole("button", { name: "Notes 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.reload();
    await expect(page.locator(".reference-card")).toHaveCount(1);
    await page.getByRole("button", { name: "Effacer la recherche" }).click();
    await expect(
      page.getByRole("textbox", { name: "Rechercher", exact: true }),
    ).toHaveValue("");
    await capture(
      page,
      "Nouveau lien visible après capture",
      "https://example.org/qa/new",
    );
    await expect(
      page.getByRole("button", { name: "Tout 3", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", {
        name: "Nouveau lien visible après capture",
        exact: true,
      }),
    ).toBeVisible();
  });
  test(`composition réelle dense et vues inspectables — ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto("/");
    await createProject(page, "Carnet de recherche");
    await page
      .getByLabel("Nouvelle suggestion")
      .fill("Comparer les pistes de composition");
    await page.getByRole("button", { name: "Ajouter à LATER" }).click();
    await dismiss(page);
    await createProject(page, "Étude typographique");
    await page
      .getByLabel("Nouvelle suggestion")
      .fill("Examiner les contrastes de lecture");
    await page.getByRole("button", { name: "Ajouter à LATER" }).click();
    await dismiss(page);
    for (const [title, url] of [
      ["Le rythme des marges", "https://example.org/qa/marges"],
      ["Une idée à laisser mûrir", ""],
      ["Matière et lumière", "https://example.org/qa/matiere"],
      ["Notes de direction", ""],
    ])
      await capture(page, title, url);
    await page.getByRole("button", { name: "Réduire", exact: true }).click();
    await nav(page, "Explorer");
    for (const [brand, fact, inference] of [
      [
        "Étude de rythme",
        "Composition de validation : une grille régulière alterne blocs courts et espaces de respiration.",
        "Piste de validation : expérimenter cette alternance sur une mise en page.",
      ],
      [
        "Recherche de matière",
        "Observation synthétique de validation : rapprochement de textures mates et de lumière diffuse.",
        "",
      ],
    ]) {
      await page.getByRole("button", { name: "Ajouter un signal" }).click();
      await page.getByLabel("Marque ou sujet").fill(brand);
      await page.getByLabel("Fait observé").fill(fact);
      await page
        .getByLabel("Lien de la source")
        .fill("https://example.org/qa/observation");
      await page.getByLabel("Date du fait").fill("2026-10-01");
      await page.getByLabel("Interprétation").fill(inference);
      await page.getByRole("button", { name: "Conserver ce signal" }).click();
      await dismiss(page);
    }
    await expect(
      page.getByRole("heading", { name: "Recherche de matière" }),
    ).toBeInViewport();
    await expect(
      page.getByRole("link", { name: "Voir la source" }).first(),
    ).toBeInViewport();
    for (const route of ["Accueil", "Explorer", "Saver", "Projets"]) {
      await nav(page, route);
      if (route === "Projets")
        await page.getByRole("button", { name: "Tous les projets" }).click();
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: info.outputPath(`${route.toLowerCase()}-${width}.png`),
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth &&
            document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
      await expect(
        page.getByRole("navigation").locator("[aria-current=page]"),
      ).toHaveCount(1);
    }
    await page.getByRole("button", { name: /Carnet de recherche/ }).click();
    await page.screenshot({
      path: info.outputPath(`projet-detail-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Accepter dans NOW" }).click();
    await dismiss(page);
    await nav(page, "Accueil");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Comparer les pistes de composition",
    );
    await page.screenshot({
      path: info.outputPath(`accueil-now-${width}.png`),
      fullPage: true,
    });
  });
}
test("clavier : accès direct au contenu et filtre vide explicite", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await nav(page, "Saver");
  await page.getByRole("button", { name: "Liens 0" }).click();
  await expect(
    page.getByRole("heading", { name: "Aucune correspondance." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Capturer", exact: true }),
  ).toHaveCount(1);
});

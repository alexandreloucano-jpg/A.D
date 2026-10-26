import { test, expect, type Page } from "@playwright/test";
async function hideNotice(page: Page) {
  const b = page.getByRole("button", { name: "Masquer le message" });
  if (await b.isVisible()) await b.click();
}
async function project(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Travail" })
    .click();
  await page.getByRole("button", { name: "Nouveau projet" }).click();
  await page.getByLabel("Nom du projet").fill(name);
  await page
    .getByRole("button", { name: "Créer le projet", exact: true })
    .click();
  await hideNotice(page);
}
test("capture réelle locale, relecture UUID, rechargement et association projet", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await project(page, "Projet de test isolé");
  await page
    .getByRole("button", { name: "Capturer", exact: true })
    .first()
    .click();
  await page.getByLabel("Lien source").fill("https://example.org/reference");
  await page.getByLabel("Titre (facultatif)").fill("Référence de test isolée");
  await page
    .getByLabel("Votre pensée")
    .fill("Note saisie dans ce test uniquement.");
  await page.getByText("Provenance et projet").click();
  await page
    .getByLabel("Associer à un projet")
    .selectOption({ label: "Projet de test isolé" });
  await page.getByRole("button", { name: "Sauvegarder", exact: true }).click();
  await expect(page.getByText("Sauvegarde locale relue")).toBeVisible();
  const id = await page.locator(".receipt code").innerText();
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  await page.reload();
  await expect(page.locator(".receipt code")).toHaveText(id);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Travail" })
    .click();
  await page.getByRole("button", { name: /Projet de test isolé/ }).click();
  await expect(
    page.getByRole("button", { name: "Référence de test isolée" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("LATER → NOW humain, KILL exclu puis restauration LATER", async ({
  page,
}) => {
  await page.goto("/");
  await project(page, "Décisions de test");
  await page.getByLabel("Nouvelle suggestion").fill("Idée de test à examiner");
  await page.getByRole("button", { name: "Ajouter à LATER" }).click();
  await hideNotice(page);
  await expect(page.getByText("LATER · À EXAMINER")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Aujourd’hui" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Aucune prioritéen cours.",
  );
  await page.getByRole("button", { name: /Décisions de test/ }).click();
  await page.getByRole("button", { name: "Accepter dans NOW" }).click();
  await hideNotice(page);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Aujourd’hui" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Idée de test à examiner",
  );
  await page.getByRole("button", { name: "Ouvrir le dossier" }).click();
  await page.getByRole("button", { name: "Écarter", exact: true }).click();
  await hideNotice(page);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Aujourd’hui" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Aucune prioritéen cours.",
  );
  await page.getByRole("button", { name: /Décisions de test/ }).click();
  await page.getByRole("button", { name: "Archives (1)" }).click();
  await page.getByRole("button", { name: "Restaurer dans LATER" }).click();
  await hideNotice(page);
  await page.getByRole("button", { name: "Voir les actions" }).click();
  await expect(page.getByText("LATER · À EXAMINER")).toBeVisible();
});
test("échec de sauvegarde conserve le brouillon et ne confirme rien", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Capturer", exact: true }).click();
  await page.getByLabel("Votre pensée").fill("Brouillon à conserver");
  await page.evaluate(() => {
    Storage.prototype.setItem = function (key: string) {
      if (key === "ad.workspace.v1") throw new Error("Quota de test atteint");
    };
  });
  await page.getByRole("button", { name: "Sauvegarder", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Quota de test atteint");
  await expect(page.getByLabel("Votre pensée")).toHaveValue(
    "Brouillon à conserver",
  );
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.screenshot({
      path: info.outputPath(`saver-erreur-${width}.png`),
      fullPage: true,
    });
  }
});
test("navigation, clavier, connexion désactivée et historique", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Radar" })
    .click();
  await expect(page).toHaveURL(/#\/explorer/);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Bibliothèque" })
    .click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Explorer.", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Réglages et sauvegarde" }).click();
  await expect(page.getByText("Non connecté", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Réglages et sauvegarde" }),
  ).toBeFocused();
});
test("import/export validé et remplacement avec consentement", async ({
  page,
}) => {
  await page.goto("/");
  await project(page, "Sauvegarde de test");
  await page.getByRole("button", { name: "Réglages et sauvegarde" }).click();
  await page.getByText("Sauvegarde et restauration", { exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter mes données" }).click();
  const backup = await download;
  const path = await backup.path();
  expect(path).toBeTruthy();
  await page.locator("input[type=file]").setInputFiles(path!);
  await expect(page.getByText(/1 projet\(s\), 0 référence/)).toBeVisible();
  await page.getByRole("button", { name: "Confirmer le remplacement" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Sauvegarde importée et relue.",
  );
});
test("Grok manuel exige validation ; fait et interprétation restent séparés", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Capturer", exact: true }).click();
  await page.getByLabel("Lien source").fill("https://example.org/scout");
  await page.getByLabel("Titre (facultatif)").fill("Source de test Grok");
  await page.getByText("Provenance et projet").click();
  await page.getByLabel("Provenance", { exact: true }).selectOption("grok");
  await page.getByRole("button", { name: "Valider et sauvegarder" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Valider et sauvegarder" }).click();
  await hideNotice(page);
  await expect(page.getByText("GROK · VALIDÉ PAR VOUS")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Radar" })
    .click();
  await page.getByRole("button", { name: "Ajouter un signal" }).click();
  await page.getByLabel("Marque ou sujet").fill("Sujet de test");
  await page
    .getByLabel("Fait observé")
    .fill("Fait saisi pour validation du formulaire.");
  await page.getByLabel("Lien de la source").fill("https://example.org/fact");
  await page.getByLabel("Date du fait").fill("2026-10-01");
  await page.getByLabel("Interprétation").fill("Piste de test, pas un fait.");
  await page.getByRole("button", { name: "Conserver ce signal" }).click();
  await hideNotice(page);
  await expect(page.getByText("Interprétation · à examiner")).toBeVisible();
  await expect(page.getByText("1 oct. 2026")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Voir la source" }),
  ).toHaveAttribute("href", "https://example.org/fact");
});
for (const width of [375, 390, 430, 768, 1440])
  test(`captures réelles et absence de débordement à ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    for (const route of ["Aujourd’hui", "Radar", "Bibliothèque", "Travail"]) {
      await page
        .getByRole("navigation")
        .getByRole("link", { name: route, exact: true })
        .click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`${route.toLowerCase()}-${width}.png`),
        fullPage: true,
      });
    }
  });

test("stockage illisible protégé et export brut possible", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("ad.workspace.v1", "contenu non lisible"),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Aucune donnée n’a été remplacée",
  );
  await expect(
    page.getByRole("button", { name: "Capturer", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(() => localStorage.getItem("ad.workspace.v1")),
  ).toBe("contenu non lisible");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter le contenu brut" }).click();
  expect((await event).suggestedFilename()).toBe("ad-recovery-raw.json");
});

for (const width of [390, 1440])
  test(`vues remplies par saisie réelle — données de test isolées — ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto("/");
    await project(page, "Étude visuelle · test isolé");
    await page
      .getByLabel("Nouvelle suggestion")
      .fill("Examiner la composition — exemple de test");
    await page.getByRole("button", { name: "Ajouter à LATER" }).click();
    await hideNotice(page);
    await page.getByRole("button", { name: "Capturer", exact: true }).click();
    await page
      .getByLabel("Titre (facultatif)")
      .fill("Note de composition · test isolé");
    await page
      .getByLabel("Votre pensée")
      .fill(
        "Étudier le rythme entre typographie et espace. Contenu synthétique de validation.",
      );
    await page
      .getByRole("button", { name: "Sauvegarder", exact: true })
      .click();
    await hideNotice(page);
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Radar" })
      .click();
    await page.getByRole("button", { name: "Ajouter un signal" }).click();
    await page
      .getByLabel("Marque ou sujet")
      .fill("Sujet de validation visuelle");
    await page
      .getByLabel("Fait observé")
      .fill(
        "Texte synthétique utilisé uniquement pour contrôler la lisibilité de la carte et la visibilité de sa source.",
      );
    await page
      .getByLabel("Lien de la source")
      .fill("https://example.org/visual-test");
    await page.getByLabel("Date du fait").fill("2026-10-01");
    await page.getByRole("button", { name: "Conserver ce signal" }).click();
    await hideNotice(page);
    await expect(
      page.getByRole("heading", { name: "Sujet de validation visuelle" }),
    ).toBeInViewport();
    await expect(
      page.getByRole("link", { name: "Voir la source" }),
    ).toBeInViewport();
    for (const route of ["Aujourd’hui", "Radar", "Bibliothèque", "Travail"]) {
      await page
        .getByRole("navigation")
        .getByRole("link", { name: route, exact: true })
        .click();
      await page.screenshot({
        path: info.outputPath(`${route.toLowerCase()}-populated-${width}.png`),
        fullPage: true,
      });
    }
  });

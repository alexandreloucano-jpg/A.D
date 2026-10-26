import { test, expect, type Page } from "@playwright/test";
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("link", { name, exact: true })
    .click();
}
async function dismiss(page: Page) {
  const b = page.getByRole("button", { name: "Masquer le message" });
  if (await b.isVisible()) await b.click();
}
async function capture(page: Page, title: string, url: string) {
  await page.getByRole("button", { name: "Capturer", exact: true }).click();
  await page.getByLabel("Titre (facultatif)").fill(title);
  await page.getByLabel("Lien source").fill(url);
  await page.getByRole("button", { name: "Sauvegarder", exact: true }).click();
  await dismiss(page);
}
test("genuine saved media, loading, broken-media fallback and retry without changing the receipt", async ({
  page,
}, info) => {
  await page.goto("/");
  await capture(
    page,
    "Architecture fournie",
    new URL("/architecture.svg", page.url()).href,
  );
  await expect(
    page.getByRole("img", { name: "Architecture fournie" }),
  ).toBeVisible();
  await expect(page.locator(".reference-media")).toHaveAttribute(
    "data-state",
    "ready",
  );
  const id = await page.locator(".receipt code").innerText();
  await page.reload();
  await expect(page.locator(".receipt code")).toHaveText(id);
  await expect(page.locator(".reference-media")).toHaveAttribute(
    "data-state",
    "ready",
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("https://example.org/qa/missing.png", async (route) => {
    await gate;
    await route.fulfill({ status: 404, body: "Not found" });
  });
  await capture(
    page,
    "Image indisponible",
    "https://example.org/qa/missing.png",
  );
  await expect(page.getByText("Chargement de l’aperçu…")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("saver-loading-1440.png"),
    fullPage: true,
  });
  release();
  await expect(page.getByText("Aperçu indisponible.")).toBeVisible();
  const failedId = await page.locator(".receipt code").innerText();
  await page.screenshot({
    path: info.outputPath("saver-media-error-1440.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Réessayer l’aperçu" }).click();
  await expect(page.getByText("Aperçu indisponible.")).toBeVisible();
  await expect(page.locator(".receipt code")).toHaveText(failedId);
  await expect(page.locator(".reference-card")).toHaveCount(2);
});
test("Explorer discloses evidence and interpretation; a potential action is a human draft, never NOW", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Radar");
  await page.getByRole("button", { name: "Ajouter un signal" }).click();
  await page.getByLabel("Marque ou sujet").fill("Observation de validation");
  await page
    .getByLabel("Fait observé")
    .fill("Fait rapporté par un utilisateur pour le test.");
  await page
    .getByLabel("Lien de la source")
    .fill("https://example.org/qa/evidence");
  await page.getByLabel("Date du fait").fill("2026-10-01");
  await page
    .getByLabel("Interprétation")
    .fill("Une hypothèse distincte, sans action validée.");
  await page.getByRole("button", { name: "Conserver ce signal" }).click();
  await dismiss(page);
  await expect(page.getByText("À vérifier", { exact: true })).toBeVisible();
  await page.getByText("Interprétation · à examiner", { exact: true }).click();
  await expect(
    page.getByText("Une hypothèse distincte, sans action validée."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Noter une piste" }).click();
  await expect(page.getByLabel("Lien source")).toHaveValue(
    "https://example.org/qa/evidence",
  );
  await page
    .getByLabel("Votre pensée")
    .fill("Une piste que je choisis de garder.");
  await page.getByRole("button", { name: "Sauvegarder", exact: true }).click();
  await dismiss(page);
  await expect(page.locator(".receipt code")).toBeVisible();
  const tasks = await page.evaluate(
    () => JSON.parse(localStorage.getItem("ad.workspace.v1")!).tasks,
  );
  expect(tasks).toHaveLength(0);
  await nav(page, "Aujourd’hui");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Aucune priorité",
  );
});
test("compact mobile keeps all destinations, source access and capture usable", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto("/");
  await nav(page, "Radar");
  await page.getByRole("button", { name: "Ajouter un signal" }).click();
  await page.getByLabel("Marque ou sujet").fill("Format compact");
  await page
    .getByLabel("Fait observé")
    .fill("Observation courte pour vérifier la hauteur disponible.");
  await page
    .getByLabel("Lien de la source")
    .fill("https://example.org/qa/compact");
  await page.getByLabel("Date du fait").fill("2026-10-01");
  await page.getByRole("button", { name: "Conserver ce signal" }).click();
  await dismiss(page);
  for (const name of ["Aujourd’hui", "Radar", "Bibliothèque", "Travail"]) {
    await nav(page, name);
    await expect(
      page.getByRole("navigation").getByRole("link", { name, exact: true }),
    ).toBeInViewport();
    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`${name.toLowerCase()}-390-compact.png`),
      fullPage: true,
    });
  }
  await nav(page, "Radar");
  await page
    .getByRole("link", { name: /Voir la source/ })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("link", { name: /Voir la source/ }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "Capturer", exact: true }).click();
  await page.getByLabel("Votre pensée").fill("Brouillon en vue compacte");
  await page.getByRole("button", { name: "Sauvegarder", exact: true }).click();
  await expect(page.locator(".receipt code")).toBeVisible();
});

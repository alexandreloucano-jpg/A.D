import { test, expect } from "@playwright/test";
for (const width of [390, 1440])
  test(`shared X draft and manual/Grok collections ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 503, json: { error: "isolated_local_fixture" } }),
    );
    const shared = "Mon passage conservé https://x.com/example/status/123";
    await page.goto("/#/saver?share=1&text=" + encodeURIComponent(shared));
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Lien source")).toHaveValue(
      "https://x.com/example/status/123",
    );
    expect(
      await page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("ad.workspace.v1") || '{"references":[]}',
          ).references.length,
      ),
    ).toBe(0);
    await page.getByLabel("Titre (facultatif)").fill("Partage X isolé");
    await page
      .getByRole("button", { name: "Sauvegarder", exact: true })
      .click();
    const notice = page.getByRole("button", { name: "Masquer le message" });
    if (await notice.isVisible()) await notice.click();
    await page
      .getByRole("button", { name: "Nouveau groupe", exact: true })
      .click();
    await page.getByLabel("Nom du groupe").fill("Matières");
    await page
      .getByRole("button", { name: "Créer le groupe", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Groupes de « Partage X isolé »" })
      .click();
    await page.getByLabel("Matières", { exact: true }).check();
    await page.getByRole("button", { name: "Enregistrer les groupes" }).click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Groupes de « Partage X isolé »" }),
    ).toContainText("Matières");
    const id = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ad.workspace.v1")!).references[0].id,
    );
    // The JSON recovery/import path is an administrator tool, not everyday Saver UI.
    await page.goto("/#/saver?admin=1");
    await page.getByRole("button", { name: "Groupes avec Grok" }).click();
    await page
      .getByLabel("Propositions JSON de Grok")
      .fill(
        JSON.stringify({ groups: [{ name: "Ambiances", referenceIds: [id] }] }),
      );
    await page
      .getByRole("button", { name: "Vérifier les propositions" })
      .click();
    await expect(
      page.getByRole("button", { name: "Créer les groupes approuvés" }),
    ).toBeDisabled();
    await page.getByLabel("J’approuve ces groupes", { exact: false }).check();
    await page
      .getByRole("button", { name: "Créer les groupes approuvés" })
      .click();
    await expect(
      page.getByRole("button", { name: "Groupes de « Partage X isolé »" }),
    ).toContainText("Ambiances");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({ path: `artifacts/collections-${width}.png` });
  });

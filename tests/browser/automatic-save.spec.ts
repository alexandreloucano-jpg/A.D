import { test, expect } from "@playwright/test";
for (const width of [390, 1440])
  test(`automatic private copy preserves local UUID and retries safely ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let logged = false,
      fail = true,
      imports = 0;
    let saved: any[] = [];
    await page.route("**/api/**", async (route) => {
      const r = route.request(),
        p = new URL(r.url()).pathname;
      if (p === "/api/session")
        return route.fulfill(
          logged
            ? {
                json: {
                  authenticated: true,
                  csrf: "fixture",
                  ownerId: "340639438",
                },
              }
            : { status: 401, json: { error: "owner_session_required" } },
        );
      if (p === "/api/saver")
        return route.fulfill({ json: { references: saved, next: null } });
      if (p === "/api/collections")
        return route.fulfill({
          json: { collections: { version: 1, revision: 0, groups: [] } },
        });
      if (p === "/api/migrate") {
        imports++;
        expect(r.headers()["x-ad-csrf"]).toBe("fixture");
        if (fail)
          return route.fulfill({
            status: 503,
            json: { error: "temporary_failure" },
          });
        saved = r.postDataJSON().references;
        return route.fulfill({
          json: {
            results: saved.map((row) => ({ id: row.id, verified: true })),
          },
        });
      }
      if (p === "/api/connections/sync")
        return route.fulfill({ json: { completed: true } });
      if (p === "/api/auth/google/status")
        return route.fulfill({
          json: { configured: true, linked: true, canLink: false },
        });
      if (p === "/api/x/status" || p === "/api/instagram/status")
        return route.fulfill({ json: { configured: false, connected: false } });
      if (p === "/api/connections/grok")
        return route.fulfill({ json: { connected: false } });
      return route.fulfill({ status: 404, json: { error: "not_found" } });
    });
    await page.goto("/#/saver");
    await page.getByRole("button", { name: "Capturer", exact: true }).click();
    await page
      .getByLabel("Titre (facultatif)")
      .fill("Référence locale à conserver");
    await page
      .getByLabel("Votre pensée")
      .fill("Annotation humaine locale conservée.");
    await page
      .getByRole("button", { name: "Sauvegarder", exact: true })
      .click();
    const before = await page.evaluate(
      () => JSON.parse(localStorage.getItem("ad.workspace.v1")!).references[0],
    );
    logged = true;
    await page.reload();
    await expect.poll(() => imports).toBeGreaterThan(0);
    expect(saved).toHaveLength(0);
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("ad.workspace.v1")!).references[0].id,
      ),
    ).toBe(before.id);
    fail = false;
    await page.reload();
    await expect.poll(() => saved.length).toBe(1);
    expect(saved[0].id).toBe(before.id);
    expect(saved[0].content).toBe(before.content);
    const successfulImports = imports;
    await page.reload();
    await page.getByRole("button", { name: "Réglages et sauvegarde" }).click();
    await expect(
      page.getByRole("heading", { name: "Mon compte", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Client secret", { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByLabel("Propositions JSON de Grok")).toHaveCount(0);
    expect(imports).toBe(successfulImports);
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("ad.workspace.v1")!).references[0],
      ),
    ).toEqual(before);
    await page.screenshot({ path: `artifacts/automatic-account-${width}.png` });
  });

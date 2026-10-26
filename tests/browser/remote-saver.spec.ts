import { test, expect } from "@playwright/test";
// Browser contract fixtures are isolated; they are not deployed data or a live Grok test.
for (const width of [390, 1440])
  test(`private Saver preserves a draft and UUID after an ambiguous write — ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const writes: { id: string; title: string }[] = [];
    let saved: unknown;
    await page.route("**/api/**", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (url.pathname === "/api/collections")
        return route.fulfill({
          json: { collections: { version: 1, revision: 0, groups: [] } },
        });
      if (url.pathname === "/api/session")
        return route.fulfill({
          json: {
            authenticated: true,
            csrf: "isolated-browser-fixture",
            ownerId: "340639438",
          },
        });
      if (url.pathname === "/api/saver" && request.method() === "GET")
        return route.fulfill({ json: { references: [], next: null } });
      if (url.pathname === "/api/saver" && request.method() === "POST") {
        saved = request.postDataJSON();
        writes.push(saved as { id: string; title: string });
        if (writes.length === 1)
          return route.fulfill({
            status: 503,
            json: {
              error: "ambiguous_fixture_acknowledgement",
              retryable: true,
            },
          });
        return route.fulfill({
          status: 201,
          json: { reference: saved, verified: true },
        });
      }
      if (url.pathname.startsWith("/api/saver/"))
        return route.fulfill({ json: { reference: saved } });
      return route.fulfill({ status: 404, json: { error: "not_found" } });
    });
    await page.goto("/#/saver");
    await page.locator(".saver-service-drawer > summary").click();
    await expect(
      page.getByText("Saver privé connecté", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Capturer", exact: true }).click();
    await page
      .getByLabel("Titre (facultatif)")
      .fill("Server acknowledgement fixture");
    await page
      .getByLabel("Lien source")
      .fill("https://example.org/private-fixture");
    await page
      .getByRole("button", { name: "Sauvegarder", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Service Saver indisponible",
    );
    await expect(page.getByLabel("Titre (facultatif)")).toHaveValue(
      "Server acknowledgement fixture",
    );
    await page.reload();
    await expect(
      page.getByText("Saver privé connecté", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Capturer", exact: true }).click();
    await expect(page.getByLabel("Titre (facultatif)")).toHaveValue(
      "Server acknowledgement fixture",
    );
    await page
      .getByRole("button", { name: "Sauvegarder", exact: true })
      .click();
    await expect(
      page.getByText("Sauvegarde serveur relue", { exact: true }),
    ).toBeVisible();
    expect(writes).toHaveLength(2);
    expect(writes[1].id).toBe(writes[0].id);
    await expect(page.locator(".receipt code")).toHaveText(writes[0].id);
    expect(
      await page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("ad.workspace.v1") || '{"references":[]}',
          ).references,
      ),
    ).toHaveLength(0);
  });

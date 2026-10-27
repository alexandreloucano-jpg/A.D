import { test, expect } from "@playwright/test";
// Isolated UI contracts, never a claim of real provider consent.
for (const width of [390, 1440])
  test(`connected accounts and Google owner linking ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let linked = false,
      linkRequests = 0,
      logout = false;
    await page.route("**/api/**", async (route) => {
      const r = route.request(),
        p = new URL(r.url()).pathname;
      if (p === "/api/session")
        return route.fulfill({
          json: {
            authenticated: true,
            csrf: "fixture-csrf",
            ownerId: "340639438",
          },
        });
      if (p === "/api/saver")
        return route.fulfill({ json: { references: [], next: null } });
      if (p === "/api/collections")
        return route.fulfill({
          json: { collections: { version: 1, revision: 0, groups: [] } },
        });
      if (p === "/api/auth/google/status")
        return route.fulfill({
          json: { configured: true, linked, canLink: true },
        });
      if (p === "/api/auth/google/link") {
        expect(r.method()).toBe("POST");
        expect(r.headers()["x-ad-csrf"]).toBe("fixture-csrf");
        linkRequests++;
        return route.fulfill({
          json: {
            url: "https://accounts.google.com/o/oauth2/v2/auth?state=fixture",
          },
        });
      }
      if (p === "/api/auth/google/unlink") {
        linked = false;
        logout = true;
        return route.fulfill({
          json: { unlinked: true, referencesPreserved: true },
        });
      }
      if (p === "/api/x/status")
        return route.fulfill({
          json: {
            configured: false,
            connected: false,
            permissions: [],
            requestedPermissions: [
              "bookmark.read",
              "tweet.read",
              "users.read",
              "offline.access",
            ],
            username: "",
            enabled: false,
            lastSyncAt: null,
            retryAt: 0,
            catchingUp: false,
            blocker: "Absence d’accès développeur X.",
          },
        });
      if (p === "/api/instagram/status")
        return route.fulfill({
          json: {
            configured: false,
            connected: false,
            permissions: [],
            lastImportAt: null,
            error: null,
            blocker: "Application Meta Instagram Login non configurée.",
          },
        });
      return route.fulfill({ status: 404, json: { error: "not_found" } });
    });
    await page.route("https://accounts.google.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<p>Provider consent fixture only</p>",
      }),
    );
    await page.goto("/#/saver");
    await page.locator(".saver-service-drawer > summary").click();
    await page.getByText("Mes connexions", { exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "X · non configuré" }),
    ).toBeVisible();
    await expect(
      page.getByText(/La connexion X n’est pas encore disponible/),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Instagram · non configuré" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        /L’import des publications enregistrées n’est pas disponible/,
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Vérifier la passerelle MCP", { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Réglages et sauvegarde" }).click();
    await expect(
      page.getByRole("heading", { name: "Mon compte", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Client secret", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByLabel("URL de retour vérifiée", { exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/connected-accounts-${width}.png`,
    });
    // Account-link recovery is preserved only in the back office.
    await page.getByRole("dialog").getByRole("button", { name: "Fermer" }).click();
    await page.goto("/#/saver?admin=1");
    await page.getByRole("button", { name: "Réglages et sauvegarde" }).click();
    await expect(
      page.getByRole("heading", { name: "Google · non lié" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Lier Google à mon propriétaire GitHub" })
      .click();
    await page.waitForURL("https://accounts.google.com/**");
    expect(linkRequests).toBe(1);
    linked = true;
    await page.goto("/#/saver?admin=1");
    await page.getByRole("button", { name: "Réglages et sauvegarde" }).click();
    await expect(
      page.getByRole("heading", { name: "Google · lié au propriétaire" }),
    ).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Délier Google et révoquer ses sessions" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Google · non lié" }),
    ).toBeVisible();
    expect(logout).toBe(true);
  });

for (const width of [390, 1440])
  test(`manual provider import and exact pending states ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const diagnostic = "ae02b13c-7d10-43bd-8f35-7361193e7e92";
    let imports = 0,
      background = 0;
    await page.route("**/api/**", async (route) => {
      const request = route.request(),
        p = new URL(request.url()).pathname;
      if (p === "/api/session")
        return route.fulfill({
          json: { authenticated: true, csrf: "csrf", ownerId: "340639438" },
        });
      if (p === "/api/saver")
        return route.fulfill({ json: { references: [], next: null } });
      if (p === "/api/collections")
        return route.fulfill({
          json: { collections: { version: 1, revision: 0, groups: [] } },
        });
      if (p === "/api/x/status")
        return route.fulfill({
          json: {
            configured: true,
            connected: true,
            state: "connected",
            hasAccount: true,
            importAllowed: true,
            lastSyncAt: null,
          },
        });
      if (p === "/api/instagram/status")
        return route.fulfill({
          json: {
            configured: true,
            connected: false,
            state: "expired",
            hasAccount: true,
            diagnosticId: diagnostic,
            error: "instagram_reauthorization_required",
          },
        });
      if (p === "/api/connections/grok")
        return route.fulfill({
          json: {
            configured: true,
            connected: false,
            state: "verification_required",
            hasAccount: true,
          },
        });
      if (p === "/api/connections/sync") {
        background++;
        return route.fulfill({ json: { completed: true } });
      }
      if (p === "/api/x/sync") {
        imports++;
        expect(request.method()).toBe("POST");
        expect(request.postDataJSON()).toEqual({});
        expect(request.headers()["x-ad-csrf"]).toBe("csrf");
        return route.fulfill({
          status: 429,
          json: { error: "x_rate_limited", requestId: diagnostic },
        });
      }
      return route.fulfill({ status: 404, json: { error: "not_found" } });
    });
    await page.goto("/#/saver?connections=1");
    await expect(
      page.getByRole("heading", {
        name: "Grok · échange à vérifier",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Instagram · accès expiré",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Grok · connecté", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(/Aucune synchronisation automatique/),
    ).toBeVisible();
    expect(imports).toBe(0);
    expect(background).toBe(0);
    await page
      .getByRole("button", { name: "Importer toute la bibliothèque" })
      .click();
    await expect(page.getByRole("status")).toContainText("Quota X atteint");
    await expect(page.getByRole("status")).toContainText(diagnostic);
    expect(imports).toBe(1);
    expect(background).toBe(0);
    await page.screenshot({ path: `artifacts/provider-states-${width}.png` });
    await page
      .getByRole("button", { name: "Ajouter une publication Instagram" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Lien")).toBeVisible();
  });

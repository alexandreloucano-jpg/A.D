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
    await page.getByText("Comptes connectés", { exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Google · non lié" }),
    ).toBeVisible();
    await page.getByText("X · non connecté", { exact: true }).click();
    await expect(page.getByText(/Absence d’accès développeur X/)).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Autoriser la lecture de mes signets X",
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Instagram · non connecté" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        /L’API ne permet pas d’importer vos publications enregistrées/,
      ),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/connected-accounts-${width}.png`,
    });
    await page
      .getByRole("button", { name: "Lier Google à mon propriétaire GitHub" })
      .click();
    await page.waitForURL("https://accounts.google.com/**");
    expect(linkRequests).toBe(1);
    linked = true;
    await page.goto("/#/saver");
    await page.getByText("Comptes connectés", { exact: true }).click();
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

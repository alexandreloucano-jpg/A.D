import { test, expect } from "@playwright/test";
import { parseArticle } from "../../server/market/analyze";
for (const width of [390, 1440])
  test(
    "commercial shortlist, separate culture and honest source registry " +
      width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const now = new Date();
      const commercial = Array.from({ length: 7 }, (_, i) =>
        parseArticle(
          `<h1>Maison Test ${i} ouvrira un hôtel à Paris 8e</h1><time datetime="${now.toISOString()}"></time><article>La marque prépare une ouverture le 20 novembre 2026 au 75008 Paris.</article>`,
          "https://www.journalduluxe.fr/fr/business/test-" + i,
          now,
        )!,
      );
      const culture = parseArticle(
        `<h1>Chanel présente sa collection à Paris</h1><time datetime="${now.toISOString()}"></time><article>Une magnifique collection, déjà présentée lors du défilé.</article>`,
        "https://www.journalduluxe.fr/fr/mode/chanel-culture",
        now,
      )!;
      await page.route("**/api/market/**", async (route) => {
        const p = new URL(route.request().url()).pathname;
        let body: unknown = {};
        if (p.endsWith("/status"))
          body = { enabled: true, sourceCount: 2, lastRun: null, stale: false };
        else if (p.endsWith("/opportunities"))
          body = { items: [culture, ...commercial] };
        else if (p.endsWith("/brief/today"))
          body = {
            observations: [culture, ...commercial],
            acceptedNowActions: [],
          };
        else if (p.endsWith("/sources"))
          body = {
            items: [
              {
                id: "doit",
                name: "Do It In Paris",
                url: "https://www.doitinparis.com/fr",
                purpose: "commercial",
                connected: false,
                enabled: true,
                accessNote: "Extraction non confirmée.",
              },
              {
                id: "creator",
                name: "CreatorIQ",
                url: "https://www.creatoriq.com/blog",
                purpose: "strategic",
                connected: false,
                enabled: false,
                accessNote: "Référence stratégique.",
              },
            ],
          };
        await route.fulfill({ json: body });
      });
      await page.goto("/#/explorer");
      await expect(page.locator(".market-finding")).toHaveCount(5);
      await expect(
        page.getByRole("heading", { name: culture.headline }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Signaux culturels", exact: true })
        .click();
      await expect(page.locator(".market-finding")).toHaveCount(1);
      await expect(
        page.getByRole("heading", { name: culture.headline }),
      ).toBeVisible();
      await page
        .getByText("Sources et état réel des connexions", { exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Détection commerciale",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "Intelligence stratégique / Taste",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Référence · non connectée", { exact: false }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      await page.screenshot({ path: `artifacts/radar-registry-${width}.png` });
      await page
        .getByRole("navigation")
        .getByRole("link", { name: "Accueil", exact: true })
        .click();
      await expect(page.locator(".market-home .market-finding")).toHaveCount(5);
      await expect(
        page
          .locator(".market-home")
          .getByRole("heading", { name: culture.headline }),
      ).toHaveCount(0);
      await page.screenshot({ path: `artifacts/radar-home-${width}.png` });
    },
  );

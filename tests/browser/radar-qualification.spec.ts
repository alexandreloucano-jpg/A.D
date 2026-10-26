import { test, expect } from "@playwright/test";
import { SOURCE_REGISTRY } from "../../server/market/sources";
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
      commercial.forEach((f) => {
        f.corroboratingPrimarySource = "https://issuer.example/press/fixture";
      });
      const culture = parseArticle(
        `<h1>Chanel présente sa collection à Paris</h1><time datetime="${now.toISOString()}"></time><article>Une magnifique collection, déjà présentée lors du défilé.</article>`,
        "https://www.journalduluxe.fr/fr/mode/chanel-culture",
        now,
      )!;
      const strategic = parseArticle(
        `<h1>Luxury Briefing: Dior drove Paris Fashion Week’s record buzz</h1><time datetime="${now.toISOString()}"></time><article>Earned media value (EMV) is a vendor estimate.</article>`,
        SOURCE_REGISTRY.find((s) => s.id === "glossy-luxury")!.url,
        now,
      )!;
      await page.route("**/api/market/**", async (route) => {
        const p = new URL(route.request().url()).pathname;
        let body: unknown = {};
        if (p.endsWith("/status"))
          body = { enabled: true, sourceCount: 2, lastRun: null, stale: false };
        else if (p.endsWith("/opportunities"))
          body = { items: [culture, strategic, ...commercial] };
        else if (p.endsWith("/brief/today"))
          body = {
            observations: [culture, strategic, ...commercial],
            acceptedNowActions: [],
          };
        else if (p.endsWith("/sources"))
          body = {
            items: [
              {
                ...SOURCE_REGISTRY.find((s) => s.id === "scholar-rhode")!,
                connected: false,
                lastIngestedAt: null,
              },
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
        .getByRole("button", { name: "Analyses stratégiques", exact: true })
        .click();
      await expect(page.locator(".market-finding")).toHaveCount(1);
      await expect(
        page.getByRole("heading", { name: strategic.companyName }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Signaux culturels", exact: true })
        .click();
      await expect(page.locator(".market-finding")).toHaveCount(1);
      await expect(
        page.getByRole("heading", { name: culture.companyName }),
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
        .getByRole("button", { name: "Recherche manuelle", exact: true })
        .click();
      await expect(
        page.locator(".market-findings .market-finding"),
      ).toHaveCount(0);
      await expect(
        page
          .getByRole("link", { name: "Google Scholar — recherche Rhode ↗" })
          .first(),
      ).toHaveAttribute(
        "href",
        SOURCE_REGISTRY.find((s) => s.id === "scholar-rhode")!.url,
      );
      await page
        .getByRole("navigation")
        .getByRole("link", { name: "Aujourd’hui", exact: true })
        .click();
      await expect(page.locator(".market-home .home-market-row")).toHaveCount(9);
      await expect(
        page
          .locator(".market-home")
          .getByText(culture.companyName, { exact: true }),
      ).toBeVisible();
      await page.screenshot({ path: `artifacts/radar-home-${width}.png` });
    },
  );
test("Rhode closing date remains October 4 in the Paris timezone", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
      timezoneId: "Europe/Paris",
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage();
  const source = SOURCE_REGISTRY.find((s) => s.id === "cosmetics-business")!,
    f = parseArticle(
      '<h1>Rhode lands in Sephora Europe with Café Rhode pop-up</h1><byline class="article-byline">Published: 30-Sep-2026</byline><article>Rhode enters Sephora Europe. Café Rhode runs from 30 September to 4 October.</article>',
      source.url,
      new Date("2026-10-17"),
    )!;
  await context.route("**/api/market/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    const data = path.endsWith("/status")
      ? { enabled: true, sourceCount: 1, lastRun: null, stale: false }
      : path.endsWith("/opportunities")
        ? { items: [f] }
        : path.endsWith("/brief/today")
          ? { observations: [], acceptedNowActions: [] }
          : path.endsWith("/sources")
            ? { items: [] }
            : { opportunity: f, actions: [], timeline: [] };
    await r.fulfill({ json: data });
  });
  await page.goto(baseURL + "/#/explorer");
  await page
    .getByRole("button", { name: "Analyses stratégiques", exact: true })
    .click();
  await page.getByRole("button", { name: "Examiner", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Début : 30/09/2026 · Fin : 04/10/2026", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Événement passé : pas de priorité urgente.", { exact: true }),
  ).toBeVisible();
  await context.close();
});

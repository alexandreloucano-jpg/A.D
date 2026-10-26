import { test, expect } from "@playwright/test";
import { parseArticle } from "../../server/market/analyze";
for (const width of [390, 1440])
  test("market review and explicit acceptance " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const f = parseArticle(
      '<h1>Maison Orbe ouvrira un hôtel à Paris 8e</h1><time datetime="2026-10-15"></time><article class="article-content">La marque prépare une ouverture le 20 novembre 2026.</article>',
      "https://www.journalduluxe.fr/fr/mode/qa-fixture",
      new Date("2026-10-16"),
    )!;
    let actions: unknown[] = [];
    await page.route("**/api/market/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let response: unknown = {};
      if (path.endsWith("/status"))
        response = {
          enabled: true,
          sourceCount: 1,
          lastRun: null,
          stale: false,
        };
      else if (path.endsWith("/opportunities"))
        response = { items: [f], nextCursor: null, totalApprox: 1 };
      else if (path.endsWith("/brief/today"))
        response = { observations: [f], acceptedNowActions: actions };
      else if (path.endsWith("/review")) {
        f.reviewState = "saved";
        response = f;
      } else if (path.endsWith("/draft-action")) {
        actions = [
          {
            id: f.id,
            opportunityId: f.id,
            lane: "LATER",
            proposalText: "Examiner la source",
          },
        ];
        response = actions[0];
      } else if (path.endsWith("/accept")) {
        actions = [
          {
            id: f.id,
            opportunityId: f.id,
            lane: "NOW",
            proposalText: "Examiner la source",
            acceptedAt: new Date().toISOString(),
          },
        ];
        response = actions[0];
      } else
        response = {
          opportunity: f,
          signals: [f],
          evidence: [{ url: f.canonicalUrl }],
          timeline: [],
          actions,
        };
      await route.fulfill({ json: response });
    });
    await page.route("**/api/session", (route) =>
      route.fulfill({ json: { authenticated: true, csrf: "fixture" } }),
    );
    await page.goto("/#/explorer");
    await expect(
      page.getByRole("heading", { name: "Où créer de la valeur." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Examiner", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByText("Date exacte du fait", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sauvegarder en pipeline" }).click();
    await page
      .getByRole("button", { name: "Conserver une proposition LATER" })
      .click();
    await expect(
      page.getByText("LATER · Examiner la source", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "J’accepte cette action NOW" })
      .click();
    await expect(
      page.getByText("NOW · Examiner la source", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await page.screenshot({
      path: `test-results/market-fixture-explorer-${width}.png`,
      fullPage: true,
    });
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Maison Orbe ouvrira un hôtel à Paris 8e",
      }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    expect(overflow).toBe(false);
  });
test("one explicit scan continues bounded slices and shows only server-confirmed findings", async ({
  page,
}) => {
  const f = parseArticle(
    '<h1>Dior ouvre une boutique à Paris</h1><time datetime="2026-10-15"></time><article class="article-content">Annonce de boutique.</article>',
    "https://www.journalduluxe.fr/fr/mode/qa-scan",
    new Date("2026-10-16"),
  )!;
  let calls = 0;
  let run: Record<string, unknown> | null = null;
  await page.route("**/api/session", (r) =>
    r.fulfill({ json: { authenticated: true, csrf: "fixture" } }),
  );
  await page.route("**/api/market/**", async (route) => {
    const p = new URL(route.request().url()).pathname;
    let b: unknown = {};
    if (p.endsWith("/status"))
      b = { enabled: true, sourceCount: 1, lastRun: run, stale: false };
    else if (p.includes("/runs")) {
      calls++;
      run = {
        id: "c4456ccb-c437-47bc-a6aa-bbe1527a9794",
        status: calls === 1 ? "partial" : "succeeded",
        paused: calls === 1,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        itemsSeen: calls === 1 ? 0 : 1,
        insertedCount: calls === 1 ? 0 : 1,
        failures: [],
        sourceCount: 1,
      };
      b = run;
    } else if (p.endsWith("/opportunities"))
      b = {
        items: calls === 2 ? [f] : [],
        nextCursor: null,
        totalApprox: calls === 2 ? 1 : 0,
      };
    else if (p.endsWith("/brief/today"))
      b = { acceptedNowActions: [], observations: [] };
    await route.fulfill({ json: b });
  });
  await page.goto("/#/explorer");
  await page.getByRole("button", { name: "Lancer le premier scan" }).click();
  await expect(page.getByRole("heading", { name: f.headline })).toBeVisible();
  expect(calls).toBe(2);
});

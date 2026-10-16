import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
for (const width of [390, 1440])
  test(`native Saver import preview, verified receipt and recovery ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const refs: Record<string, unknown>[] = [];
    const id = "c3ab60bf-3820-4a8f-8888-6481a274ac15";
    await page.route("**/api/**", async (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p === "/api/session")
        return route.fulfill({
          json: { authenticated: true, csrf: "fixture", ownerId: "340639438" },
        });
      if (p === "/api/saver")
        return route.fulfill({ json: { references: refs, next: null } });
      if (p === "/api/collections")
        return route.fulfill({
          json: { collections: { version: 1, revision: 0, groups: [] } },
        });
      if (p === "/api/intake" && route.request().method() === "POST") {
        expect(route.request().headers()["x-ad-csrf"]).toBe("fixture");
        const items = route.request().postDataJSON().items;
        expect(items).toHaveLength(1);
        refs.push({
          id,
          title: items[0].title,
          content: items[0].text,
          url: items[0].url,
          origin: "human",
          revision: 1,
          capturedAt: new Date().toISOString(),
          approvedAt: new Date().toISOString(),
          isInternalQA: false,
        });
        return route.fulfill({
          json: {
            results: [
              { url: items[0].url, id, verified: true, existing: false },
            ],
          },
        });
      }
      if (p === "/api/intake") return route.fulfill({ json: { sources: [] } });
      return route.fulfill({ status: 404, json: { error: "not_found" } });
    });
    await page.goto("/#/saver");
    await page
      .getByRole("button", { name: "Importer des signets", exact: true })
      .click();
    await page.getByLabel("Fichier de signets").setInputFiles({
      name: "bookmarks.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "url,title,notes\nhttps://x.com/a/status/987654,Architecture mobile,Human note\nhttps://twitter.com/a/status/987654,Duplicate,Other note",
      ),
    });
    await expect(
      page.getByText("Architecture mobile", { exact: true }),
    ).toBeVisible();
    expect(refs).toHaveLength(0);
    await page.reload();
    await expect(
      page.getByText("Architecture mobile", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Conserver uniquement sur cet appareil").uncheck();
    await page.screenshot({ path: `artifacts/intake-preview-${width}.png` });
    await page
      .getByRole("button", {
        name: "Enregistrer 1 référence(s) sélectionnée(s)",
        exact: true,
      })
      .click();
    await expect.poll(() => refs.length).toBe(1);
    await expect
      .poll(() =>
        page.evaluate(() => sessionStorage.getItem("ad.intake.draft.v1")),
      )
      .toBeNull();
    await page.screenshot({
      path: `artifacts/intake-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("capture reads only the rendered X fixture", async ({ page }) => {
  await page.route("https://x.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<article data-testid="tweet"><a href="/author/status/123456"><time datetime="2026-10-15T12:00:00Z"></time></a><div data-testid="tweetText">Real rendered fixture</div></article>',
    }),
  );
  await page.goto("https://x.com/i/bookmarks");
  const source = await readFile("extensions/ad-saver/collect.js", "utf8");
  await page.addScriptTag({
    type: "module",
    content: source + "\nwindow.collectAD=collectRenderedPosts;",
  });
  const result = await page.evaluate(async () => {
    const w = window as unknown as {
      collectAD: (
        walk: boolean,
      ) => Promise<{ items: { url: string; text: string }[] }>;
    };
    return await w.collectAD(false);
  });
  expect(result.items).toHaveLength(1);
  expect(result.items[0].url).toBe("https://x.com/i/web/status/123456");
  expect(result.items[0].text).toBe("Real rendered fixture");
});

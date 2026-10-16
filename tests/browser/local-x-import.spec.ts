import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
for (const width of [390, 1440])
  test(`local X content, real media bytes, no cloud upload, reload ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let cloudWrites = 0;
    await page.route("**/api/**", (route) => {
      const p = new URL(route.request().url()).pathname;
      if (route.request().method() === "POST") cloudWrites++;
      if (p === "/api/session")
        return route.fulfill({
          json: { authenticated: true, csrf: "fixture", ownerId: "340639438" },
        });
      if (p === "/api/saver")
        return route.fulfill({ json: { references: [], next: null } });
      if (p === "/api/collections")
        return route.fulfill({
          json: { collections: { version: 1, revision: 0, groups: [] } },
        });
      if (p === "/api/intake") return route.fulfill({ json: { sources: [] } });
      return route.fulfill({ status: 404, json: { error: "not_found" } });
    });
    const video = (await readFile("tests/fixtures/local-media.mp4")).toString(
      "base64",
    );
    await page.addInitScript(
      ({ video }) =>
        window.addEventListener("message", (e) => {
          if (e.source === window && e.data?.type === "AD_SAVER_MEDIA_REQUEST")
            window.postMessage(
              {
                type: "AD_SAVER_MEDIA_RESULT",
                nonce: e.data.nonce,
                id: e.data.id,
                mime: e.data.url.includes("video.twimg.com")
                  ? "video/mp4"
                  : "image/png",
                base64: e.data.url.includes("video.twimg.com")
                  ? video
                  : "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=",
              },
              location.origin,
            );
        }),
      { video },
    );
    await page.goto("/#/saver");
    await page.evaluate(() =>
      window.postMessage(
        {
          type: "AD_SAVER_CAPTURE",
          nonce: "ac6ac0b4-2175-4d40-bf45-a2571f957151",
          items: [
            {
              url: "https://x.com/i/web/status/98712345",
              title: "Archive X locale",
              text: "Texte de la publication",
              originalText:
                "Texte complet conservé avec direction artistique azur",
              images: ["https://pbs.twimg.com/media/fixture.png"],
              videos: ["https://video.twimg.com/fixture.mp4"],
              tags: ["Matières"],
              notes: [],
            },
          ],
        },
        location.origin,
      ),
    );
    await expect(
      page.getByText("Archive X locale", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Enregistrer 1 référence(s) sélectionnée(s)",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Contenu conservé sur cet appareil · 2/2 fichiers", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await page.reload();
    await page
      .getByText("Contenu conservé sur cet appareil · 2/2 fichiers", {
        exact: true,
      })
      .click();
    const original = page.locator(".local-original");
    await expect(original).toContainText("direction artistique azur");
    await expect
      .poll(() =>
        page
          .locator(".local-content img")
          .evaluate((n: HTMLImageElement) => n.naturalWidth),
      )
      .toBe(1);
    await expect
      .poll(() =>
        page
          .locator(".local-content video")
          .evaluate((n: HTMLVideoElement) => n.duration),
      )
      .toBeGreaterThan(0);
    expect(cloudWrites).toBe(0);
    await page.screenshot({ path: `artifacts/local-x-${width}.png` });
    await page
      .getByRole("textbox", { name: "Rechercher", exact: true })
      .fill("artistique azur");
    await expect(
      page.getByRole("button", { name: "Archive X locale", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
test("partial selections keep the extension cursor unconfirmed until all items are saved", async ({
  page,
}) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 401, json: { error: "unauthenticated" } }),
  );
  await page.addInitScript(() => {
    (window as unknown as { acks: number }).acks = 0;
    window.addEventListener("message", (e) => {
      if (e.data?.type === "AD_SAVER_CAPTURE_SAVED")
        (window as unknown as { acks: number }).acks++;
    });
  });
  await page.goto("/#/saver");
  await page.evaluate(() =>
    window.postMessage(
      {
        type: "AD_SAVER_CAPTURE",
        nonce: "ac6ac0b4-2175-4d40-bf45-a2571f957151",
        items: [
          {
            url: "https://x.com/a/status/111",
            title: "Premier signet",
            text: "Premier",
          },
          {
            url: "https://x.com/a/status/222",
            title: "Second signet",
            text: "Second",
          },
        ],
      },
      location.origin,
    ),
  );
  await page.getByRole("checkbox", { name: /Second signet/ }).uncheck();
  await page
    .getByRole("button", {
      name: "Enregistrer 1 référence(s) sélectionnée(s)",
      exact: true,
    })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(sessionStorage.getItem("ad.intake.draft.v1") || "{}").items
            ?.length,
      ),
    )
    .toBe(1);
  expect(
    await page.evaluate(() => (window as unknown as { acks: number }).acks),
  ).toBe(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("ad.intake.draft.v1") || "{}").nonce,
    ),
  ).toBe("ac6ac0b4-2175-4d40-bf45-a2571f957151");
  await page
    .getByRole("button", {
      name: "Enregistrer 1 référence(s) sélectionnée(s)",
      exact: true,
    })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { acks: number }).acks),
    )
    .toBe(1);
});

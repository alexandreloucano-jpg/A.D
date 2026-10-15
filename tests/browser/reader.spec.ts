import { test, expect } from "@playwright/test";
// Isolated browser API fixtures; live persistence is verified separately against SQL.
for (const width of [390, 1440])
  test(`reader selection, persisted note and reload ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const id = "9f4b4155-b317-4d08-abbe-9dc759ed52e1";
    const text =
      "Une citation exacte pour une lecture attentive.\n\nUn second paragraphe conservé.";
    const now = "2026-10-15T12:00:00.000Z",
      version = "a".repeat(64);
    const reference = {
      id,
      title: "Lecture isolée",
      content: text,
      capturedAt: now,
      revision: 1,
      origin: "human",
      approvedAt: now,
      isInternalQA: false,
    };
    const readerDocument = {
      referenceId: id,
      version,
      text,
      kind: "text",
      provenance: "capture",
      publishedAt: null,
      updatedAt: now,
    };
    const annotations: unknown[] = [];
    await page.route("**/api/**", async (route) => {
      const r = route.request(),
        p = new URL(r.url()).pathname;
      if (p === "/api/collections")
        return route.fulfill({
          json: { collections: { version: 1, revision: 0, groups: [] } },
        });
      if (p === "/api/session")
        return route.fulfill({
          json: { authenticated: true, csrf: "fixture", ownerId: "340639438" },
        });
      if (p === "/api/saver")
        return route.fulfill({ json: { references: [reference], next: null } });
      if (p === `/api/reader/${id}`)
        return route.fulfill({
          json: { document: readerDocument, annotations, aiAvailable: false },
        });
      if (p === `/api/reader/${id}/annotations` && r.method() === "POST") {
        const annotation = {
          ...r.postDataJSON(),
          referenceId: id,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        };
        annotations.push(annotation);
        return route.fulfill({
          status: 201,
          json: { annotation, verified: true },
        });
      }
      return route.fulfill({ status: 404, json: { error: "not_found" } });
    });
    await page.goto(`/#/saver?reference=${id}&reader=1`);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator(".reader-text")).toHaveText(text);
    await page.locator(".reader-text").evaluate((el) => {
      const range = new Range(),
        node = el.querySelector("span")!.firstChild!;
      range.setStart(node, 0);
      range.setEnd(node, 19);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    await page.getByLabel("Note humaine").fill("Ma note persistante de test");
    await page
      .getByRole("button", { name: "Enregistrer la note", exact: true })
      .click();
    await expect(page.locator(".reader-annotation")).toContainText(
      "Ma note persistante de test",
    );
    await page.reload();
    await expect(page.locator(".reader-annotation")).toContainText(
      "Ma note persistante de test",
    );
    await expect(page.locator(".reader-text mark")).toHaveText(
      text.slice(0, 19),
    );
    await expect(
      page.getByText("L’assistant de lecture n’est pas encore disponible", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retour à la bibliothèque" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });

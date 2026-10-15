import { test, expect } from "@playwright/test";
// Browser contract fixtures only; these do not claim an external X or AI-provider login.
for (const width of [390, 1440])
  test(`source extraction, cited answer and Taste separation ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const id = "f09993ec-e0ad-4113-9d3e-64e064f7f961",
      now = "2026-10-15T12:00:00.000Z";
    const reference = {
      id,
      title: "Article de test isolé",
      url: "https://example.org/article",
      content: "Texte conservé initial.",
      capturedAt: now,
      approvedAt: now,
      origin: "human",
      revision: 1,
      isInternalQA: false,
    };
    let doc = {
      referenceId: id,
      version: "a".repeat(64),
      text: reference.content,
      kind: "text",
      provenance: "capture",
      publishedAt: null as string | null,
      updatedAt: now,
    };
    let questions = 0,
      extractions = 0;
    await page.route("**/api/**", async (route) => {
      const r = route.request(),
        path = new URL(r.url()).pathname;
      if (path === "/api/session")
        return route.fulfill({
          json: { authenticated: true, csrf: "fixture", ownerId: "340639438" },
        });
      if (path === "/api/saver")
        return route.fulfill({ json: { references: [reference], next: null } });
      if (path === "/api/collections")
        return route.fulfill({
          json: { collections: { version: 1, revision: 0, groups: [] } },
        });
      if (path === "/api/x/status")
        return route.fulfill({
          json: {
            configured: false,
            connected: false,
            username: "",
            enabled: false,
            lastSyncAt: null,
            retryAt: 0,
            catchingUp: false,
            callback: "https://example.org/api/x/callback",
            blocker: "Accès développeur X absent.",
          },
        });
      if (path === `/api/reader/${id}`)
        return route.fulfill({
          json: { document: doc, annotations: [], aiAvailable: true },
        });
      if (path === `/api/reader/${id}/extract`) {
        extractions++;
        doc = {
          ...doc,
          version: "b".repeat(64),
          text: "La matière crée une tension précise.\n\nLe prix reste inconnu.",
          provenance: "extraction",
          publishedAt: "2020-01-01T00:00:00.000Z",
        };
        return route.fulfill({
          json: { document: doc, verified: true, originalPreserved: true },
        });
      }
      if (path === `/api/reader/${id}/question`) {
        questions++;
        return route.fulfill({
          json: {
            answer: {
              explicit: "La source décrit une tension.",
              inferences: "Une piste esthétique à examiner.",
              unknowns: "Le prix reste inconnu.",
              citations: [
                {
                  paragraphId: "p-0",
                  quote: "La matière crée une tension précise.",
                },
              ],
              provenance: {
                provider: "xai-fixture",
                model: "fixture-model",
                generatedAt: now,
                contentVersion: doc.version,
              },
            },
          },
        });
      }
      if (path === "/api/taste/context")
        return route.fulfill({
          json: {
            humanAnnotations: [],
            aiInterpretations: [{ question: "Fixture" }],
            updatesConfirmedPreferences: false,
            createsTasks: false,
          },
        });
      return route.fulfill({ status: 404, json: { error: "not_found" } });
    });
    await page.goto(`/#/saver?reference=${id}&reader=1`);
    await page
      .getByRole("button", { name: "Extraire le texte de la source autorisée" })
      .click();
    await expect(page.locator(".reader-text")).toContainText(
      "La matière crée une tension précise.",
    );
    await expect(
      page.getByRole("link", { name: "Télécharger l’original conservé" }),
    ).toBeVisible();
    await page.locator(".reader-text").evaluate((el) => {
      const node = el.querySelector("span")!.firstChild!,
        range = new Range();
      range.setStart(node, 0);
      range.setEnd(node, 10);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    await page.getByLabel("Question sur ce passage").fill("Quelle tension ?");
    await page
      .getByRole("button", { name: "Demander une réponse sourcée" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Interprétation IA", level: 4 }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Voir le paragraphe cité/ }).click();
    await page
      .getByText("Mémoire Taste de cette référence", { exact: true })
      .click();
    await page
      .getByRole("button", { name: "Relire le contexte Taste" })
      .click();
    await expect(
      page.getByText(
        "0 annotation(s) humaine(s), 1 interprétation(s) IA conservée(s).",
      ),
    ).toBeVisible();
    expect(extractions).toBe(1);
    expect(questions).toBe(1);
    await page.screenshot({
      path: `artifacts/reader-integration-${width}.png`,
    });
  });

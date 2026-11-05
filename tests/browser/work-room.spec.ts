import { test, expect, type Page } from "@playwright/test";
import { emptyWorkspace, type Workspace } from "../../src/domain";
import { stageOpportunity } from "../../src/opportunity/open";
import type { Finding } from "../../src/scout-market/schema";

// Isolated browser-only QA records. No live service or production storage.
const projectId = "a8ad4f0e-348e-4b8e-8039-d4f209791cca";
function fixture(withEvidence = true): Workspace {
  const data = emptyWorkspace();
  data.projects = [{ id: projectId, title: "Dossier QA — étude de lieu", updatedAt: "2026-10-24T10:00:00.000Z" }];
  data.references = ["Lumière documentaire", "Gestes et matière"].map((title, i) => ({
    id: `cce3edb4-037e-4c4b-91b3-e4f54da5b62${i}`, title, content: "Note de référence de test",
    url: `https://example.org/reference-${i}`, capturedAt: "2026-10-24T10:00:00.000Z",
    revision: 1, origin: "human", approvedAt: "2026-10-24T10:00:00.000Z", isInternalQA: false,
  }));
  if (!withEvidence) return data;
  const finding = {
    id: "5cbaf1a6-04db-455c-a0a3-cd886ff32290", signalId: "d0b2e61e-fc1d-4c4b-8acb-ec9c220ea45f",
    companyId: "01d687c9-fd22-4ac3-b5bf-3be160d12352", evidenceId: "cce3edb4-037e-4c4b-91b3-e4f54da5b625",
    companyName: "Lieu QA", headline: "Annonce de test", reportedFact: "Une ouverture est annoncée dans la source de test.",
    canonicalUrl: "https://example.org/announcement", publisher: "Source QA", knownUnknowns: ["Budget inconnu", "Interlocuteur non vérifié"],
    reviewState: "saved", projectId,
  } as Finding;
  return stageOpportunity(data, finding, [{ id: finding.evidenceId, url: finding.canonicalUrl,
    publisher: finding.publisher, claimSupported: finding.reportedFact, publishedAt: null }], "2026-10-24T10:00:00.000Z").workspace;
}
async function open(page: Page, data: Workspace) {
  await page.route("**/api/**", route => route.fulfill({ status: 503, json: { error: "QA offline" } }));
  await page.goto("/");
  await page.evaluate(data => localStorage.setItem("ad.workspace.v1", JSON.stringify(data)), data);
  await page.goto(`/#/projets?project=${projectId}`);
  await page.reload();
}

for (const viewport of [{ width: 390, height: 640 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`Work room preserves evidence, references and a treatment ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const original = fixture();
    await open(page, original);
    const nav = page.getByRole("navigation", { name: "Parcours du dossier" });
    await expect(nav).toBeVisible();
    const evidence = page.getByRole("region", { name: "Preuves de l'opportunité" });
    await expect(evidence).toContainText("Budget inconnu");
    await expect(evidence).toContainText("LIEN SERVEUR À REPRENDRE");
    await page.screenshot({ path: info.outputPath("work-evidence.png") });
    await nav.getByRole("button", { name: /Relier/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#work-sources")).toBeFocused();
    const search = page.getByRole("searchbox", { name: "Retrouver une référence Saver" });
    await search.fill("Lumière");
    await page.getByLabel("Sélectionner Lumière documentaire").check();
    await search.fill("introuvable");
    // Selection remains reachable when a new search does not match it.
    await expect(page.getByLabel("Sélectionner Lumière documentaire")).toBeChecked();
    await search.fill("");
    await nav.getByRole("button", { name: /Créer/ }).click();
    await expect(page.locator("#work-brief")).toBeFocused();
    await page.getByLabel("L'intention créative").fill("Construire un récit documentaire du lieu et de ses gestes pour une étude créative privée.");
    await page.getByRole("button", { name: "Préparer le canevas (sans IA)" }).click();
    await page.getByRole("button", { name: "Enregistrer une version" }).click();
    await expect(page.locator(".ad-create-message")).toContainText("Version 1 enregistrée localement");
    await page.reload();
    await expect(page.getByLabel("Sélectionner Lumière documentaire")).toBeChecked();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("ad.workspace.v1")!));
    expect(saved.projects).toHaveLength(1);
    expect(saved.references).toHaveLength(2);
    expect(saved.creativeBoards[0].revisions[0].referenceIds).toEqual([fixture().references[0].id]);
    expect(saved.opportunityLinks[0]).toEqual(original.opportunityLinks![0]);
    expect(saved.opportunityLinks[0].status).toBe("PENDING");
    await page.getByRole("navigation", { name: "Parcours du dossier" }).getByRole("button", { name: /Relier/ }).click();
    await page.screenshot({ path: info.outputPath("work-references.png") });
    await page.getByRole("button", { name: "Lire la source ↗" }).first().click();
    await expect(page).toHaveURL(/saver.*reference=/);
    await page.goBack();
    await expect(page.getByLabel("L'intention créative")).toHaveValue(/Construire un récit/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
  test(`Work room empty state ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const data = fixture(false); data.references = [];
    await open(page, data);
    await expect(page.getByRole("heading", { name: "Partir d’une source." })).toBeVisible();
    await expect(page.locator(".ad-create-empty")).toContainText("Aucune référence enregistrée");
    await page.screenshot({ path: info.outputPath("work-empty.png") });
    await page.getByRole("navigation", { name: "Parcours du dossier" }).getByRole("button", { name: /Relier/ }).click();
    await expect(page.getByRole("button", { name: "Capturer une référence" })).toBeVisible();
  });
}

test("Work room retains a draft when another tab changes storage", async ({ page }) => {
  await open(page, fixture());
  const brief = page.getByLabel("L'intention créative");
  await brief.fill("Une intention documentaire suffisamment précise pour préparer deux directions de travail.");
  await page.getByRole("button", { name: "Préparer le canevas (sans IA)" }).click();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("ad.workspace.v1")!);
    data.revision += 1;
    localStorage.setItem("ad.workspace.v1", JSON.stringify(data));
  });
  await page.getByRole("button", { name: "Enregistrer une version" }).click();
  await expect(page.locator(".ad-create-error")).toContainText("Le brouillon reste affiché");
  await expect(brief).toHaveValue(/Une intention documentaire/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("ad.workspace.v1")!));
  expect(saved.creativeBoards).toHaveLength(0);
});

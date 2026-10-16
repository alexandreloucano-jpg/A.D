import { test, expect } from "@playwright/test";
test("one click shares local-only text and stable UUID with a separate phone context", async ({
  browser,
  baseURL,
}) => {
  const desktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    }),
    phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const id = "a8341c2d-5feb-4a3f-9c33-484da7eb8f74";
  const refs: Record<string, unknown>[] = [];
  let source: Record<string, unknown> | null = null;
  for (const context of [desktop, phone])
    await context.route("**/api/**", async (route) => {
      const u = new URL(route.request().url());
      const method = route.request().method();
      let b: unknown = {};
      if (u.pathname === "/api/session")
        b = { authenticated: true, csrf: "fixture" };
      else if (u.pathname === "/api/saver")
        b = { references: refs, next: null };
      else if (u.pathname === "/api/migrate") {
        const body = route.request().postDataJSON();
        for (const r of body.references)
          if (!refs.some((x) => x.id === r.id)) refs.push(r);
        b = {
          results: body.references.map((r: { id: string }) => ({
            id: r.id,
            verified: true,
          })),
        };
      } else if (u.pathname === "/api/intake") {
        if (method === "POST") {
          const item = route.request().postDataJSON().items[0];
          source = {
            referenceId: id,
            sourceText: item.originalText,
            images: [],
            videos: item.videos || [],
            notes: [],
          };
          b = {
            results: [
              { url: item.url, id, verified: true, sourceTextVerified: true },
            ],
          };
        } else b = { sources: source ? [source] : [] };
      } else if (u.pathname === "/api/collections")
        b = { collections: { version: 1, revision: 0, groups: [] } };
      await route.fulfill({ json: b });
    });
  const page = await desktop.newPage();
  await page.goto(baseURL! + "/#/saver");
  await page.evaluate(async (id) => {
    const modulePath = "/src/intake/local-archive.ts";
    const { saveLocalCopies, setLocalOnly } = await import(modulePath);
    // Read the app's existing persisted workspace; use the real local archive and local-only preference.
    const raw = JSON.parse(
      localStorage.getItem("ad.workspace.v1") ||
        JSON.stringify({
          version: 1,
          revision: 0,
          references: [],
          projects: [],
          tasks: [],
          signals: [],
        }),
    );
    const workspace = raw.data || raw;
    workspace.references.push({
      id,
      title: "Signet local de test",
      content: "Texte court de test",
      url: "https://x.com/i/web/status/123456789",
      origin: "human",
      capturedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      revision: 1,
      isInternalQA: false,
    });
    if (raw.data) raw.data = workspace;
    localStorage.setItem(
      "ad.workspace.v1",
      JSON.stringify(raw.data ? raw : workspace),
    );
    setLocalOnly([id], true);
    await saveLocalCopies(
      [
        {
          url: "https://x.com/i/web/status/123456789",
          title: "Signet local de test",
          text: "Texte court de test",
          originalText: "Texte intégral conservé pour le test entre appareils.",
          images: [],
          videos: [],
          notes: [],
          tags: [],
        },
      ],
      [id],
    );
  }, id);
  await page.reload();
  await page
    .getByRole("button", { name: "Retrouver mes références sur iPhone" })
    .click();
  await expect(
    page.getByText(
      "Texte et références synchronisés. 0 fichier(s) photo/vidéo sauvegardé(s) en privé et vérifié(s). Actualisez Saver sur iPhone.",
    ),
  ).toBeVisible();
  expect(refs[0].id).toBe(id);
  const mobile = await phone.newPage();
  await mobile.goto(baseURL! + "/#/saver");
  await expect(
    mobile.getByRole("heading", { name: "Signet local de test" }),
  ).toBeVisible();
  await mobile
    .getByRole("button", { name: "Reçu de sauvegarde", exact: true })
    .click();
  await mobile
    .getByText("Texte et vidéos synchronisés", { exact: true })
    .click();
  await expect(
    mobile.getByText("Texte intégral conservé pour le test entre appareils.", {
      exact: true,
    }),
  ).toBeVisible();
  await desktop.close();
  await phone.close();
});
test("an empty phone has a direct owner sign-in action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/**", (r) =>
    r.fulfill({ status: 401, json: { error: "owner_session_required" } }),
  );
  await page.goto("/#/saver");
  await expect(
    page.getByRole("link", { name: "Se connecter avec Google", exact: true }),
  ).toHaveAttribute("href", "/api/auth/google/login");
});
test("a source read-back failure keeps the local-only choice and original content", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const archivePath = "/src/intake/local-archive.ts",
      syncPath = "/src/intake/DeviceSync.tsx";
    const archive = await import(archivePath),
      sync = await import(syncPath);
    const id = crypto.randomUUID();
    const item = {
      url: "https://x.com/i/web/status/987654321",
      title: "Source de test",
      text: "Texte court",
      originalText: "Original à conserver même si la copie échoue.",
      images: [],
      videos: [],
      tags: [],
      notes: [],
    };
    await archive.saveLocalCopies([item], [id]);
    archive.setLocalOnly([id], true);
    const reference = {
      id,
      title: item.title,
      content: item.text,
      url: item.url,
      origin: "human",
      capturedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      revision: 1,
      isInternalQA: true,
    };
    reference.isInternalQA = false;
    let failed = false;
    try {
      await sync.syncDeviceReferences(
        [reference],
        {
          connected: true,
          references: [],
          migrate: async () => {},
          refresh: async () => {},
          reader: async () => ({
            results: [
              { url: item.url, id, verified: true, sourceTextVerified: false },
            ],
          }),
        },
        () => {},
      );
    } catch {
      failed = true;
    }
    return {
      failed,
      stillLocal: archive.localOnlyIds().has(id),
      original: (await archive.readLocalCopy(id)).item.originalText,
    };
  });
  expect(result).toEqual({
    failed: true,
    stillLocal: true,
    original: "Original à conserver même si la copie échoue.",
  });
});

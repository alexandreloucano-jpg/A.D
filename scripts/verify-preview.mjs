import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
// file:// navigation is blocked by this machine's browser policy. Serve the
// unchanged standalone artifact over the supported local HTTP transport.
const html = await readFile("artifacts/AD-preview.html");
const server = createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  const unexpected = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !(r.url() === origin + "/" && r.isNavigationRequest())
    )
      unexpected.push(r.url());
  });
  await page.goto(origin);
  await page.evaluate(() => document.fonts.ready);
  await context.setOffline(true);
  for (const name of ["Explorer", "Saver", "Projets", "Accueil"]) {
    await page
      .getByRole("navigation")
      .getByRole("link", { name, exact: true })
      .click();
    if (!(await page.locator("h1").isVisible()))
      throw new Error("Missing view " + name);
  }
  await page.getByRole("button", { name: "Capturer", exact: true }).click();
  await page
    .getByLabel("Votre pensée")
    .fill("Validation hors ligne du bundle exporté.");
  await page.getByRole("button", { name: "Sauvegarder", exact: true }).click();
  const id = await page.locator(".receipt code").innerText();
  await context.setOffline(false);
  await page.reload();
  if ((await page.locator(".receipt code").innerText()) !== id)
    throw new Error("Readback after reload failed");
  if (
    !(await page.evaluate(
      () =>
        document.fonts.check("16px Inter") &&
        document.fonts.check('32px "Bodoni Moda"'),
    ))
  )
    throw new Error("Fonts not available");
  if (errors.length || unexpected.length)
    throw new Error(JSON.stringify({ errors, unexpected }));
  await context.close();
  console.log(
    "Standalone artifact over local HTTP: 4 views + save with network offline, UUID readback after reload, embedded fonts, 0 external/asset requests, 0 JS errors. file:// opening remains unverified (browser policy).",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

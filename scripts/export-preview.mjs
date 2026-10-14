// Package the exact production bundle, not a second UI or a seeded demo.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
const dist = path.resolve("dist");
const types = {
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
async function asset(url, base = dist) {
  const file = path.resolve(
    base,
    url.startsWith("/") ? "." + url : path.join(".", url),
  );
  if (!file.startsWith(dist + path.sep))
    throw new Error("Unexpected asset path");
  const mime = types[path.extname(file)];
  if (!mime) throw new Error("Unsupported asset: " + url);
  return `data:${mime};base64,${(await readFile(file)).toString("base64")}`;
}
let html = await readFile(path.join(dist, "index.html"), "utf8");
for (const match of [
  ...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g),
]) {
  const url = match[1];
  const cssFile = path.join(dist, url.replace(/^\//, ""));
  let css = await readFile(cssFile, "utf8");
  for (const item of [...css.matchAll(/url\((['"]?)([^)'"\s]+)\1\)/g)])
    if (!item[2].startsWith("data:"))
      css = css.replace(
        item[0],
        `url("${await asset(item[2], item[2].startsWith("/") ? dist : path.dirname(cssFile))}")`,
      );
  html = html.replace(match[0], () => `<style>${css}</style>`);
}
for (const match of [
  ...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g),
]) {
  const js = await readFile(
    path.join(dist, match[1].replace(/^\//, "")),
    "utf8",
  );
  html = html.replace(
    match[0],
    () =>
      `<script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script>`,
  );
}
if (/(?:src|href)="\/(?:assets|architecture)/.test(html))
  throw new Error("Unbundled application asset");
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/AD-preview.html", html);
console.log(
  "Interactive production app: artifacts/AD-preview.html (self-contained, no seed data)",
);

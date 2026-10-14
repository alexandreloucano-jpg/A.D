import {
  readdir,
  readFile,
  writeFile,
  copyFile,
  mkdir,
  access,
} from "node:fs/promises";
import path from "node:path";
const output = "artifacts/review";
await mkdir(output, { recursive: true });
await copyFile(
  "artifacts/AD-preview.html",
  path.join(output, "AD-preview.html"),
);
const dirs = (await readdir("test-results", { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const views = [
  ["accueil", "Accueil · aucune priorité imposée"],
  ["explorer", "Explorer · observation et source"],
  ["saver", "Saver · bibliothèque"],
  ["projets", "Projets · dossiers"],
  ["projet-detail", "Projet · décisions humaines"],
  ["accueil-now", "Accueil · action acceptée"],
];
let sections = "";
for (const [slug, title] of views) {
  let figures = "";
  for (const width of [1440, 390]) {
    const name = `${slug}-${width}.png`;
    const matches = [];
    for (const dir of dirs.filter((d) =>
      d.startsWith("frontend-composition"),
    )) {
      const candidate = path.join("test-results", dir, name);
      try {
        await access(candidate);
        matches.push(candidate);
      } catch {}
    }
    if (matches.length !== 1)
      throw new Error(
        `Expected one current screenshot for ${name}, found ${matches.length}`,
      );
    await copyFile(matches[0], path.join(output, name));
    const bytes = await readFile(matches[0]);
    figures += `<figure class="w${width}"><figcaption>${width}px · Chromium</figcaption><a href="${name}" target="_blank"><img src="data:image/png;base64,${bytes.toString("base64")}" alt="${title}, ${width}px" loading="lazy"/></a></figure>`;
  }
  sections += `<section id="${slug}"><h2>${title}</h2><div class="screens">${figures}</div></section>`;
}
const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A.D — Revue frontend</title><style>*{box-sizing:border-box}body{margin:0;background:#edf0e7;color:#1b3023;font:15px/1.6 system-ui,sans-serif}header,main{max-width:1320px;margin:auto;padding:24px}header{border-bottom:1px solid #b7c6aa}h1{font:48px/1.1 Georgia,serif;margin:12px 0}h2{font-size:22px;font-weight:500}p{max-width:850px}nav{display:flex;flex-wrap:wrap;gap:8px}a{color:inherit}nav a,.open{padding:10px 14px;display:inline-block;border:1px solid #a9bca0;border-radius:4px;text-decoration:none;min-height:44px}.open{background:#203a2b;color:white;margin:8px 10px 16px 0}.screens{display:flex;gap:24px;align-items:flex-start}figure{margin:0;min-width:0}.w1440{flex:1}.w390{width:28%}figcaption{padding-bottom:10px;font-size:12px}img{width:100%;height:auto;border:1px solid #b2c1a6;display:block}section{margin:30px 0 60px;scroll-margin:20px}a:focus-visible{outline:3px solid #315c40;outline-offset:4px}@media(max-width:700px){header,main{padding:18px}h1{font-size:36px}.screens{flex-direction:column}.w390{width:min(390px,100%)}.w1440{width:100%}}</style><header><p>A.D / REVUE DU FRONTEND</p><h1>Le produit, en fonctionnement.</h1><p>Captures réelles des composants React existants dans Chromium à 390 × 844 et 1440 × 900. Les contenus affichés sont un jeu synthétique de validation isolé : aucun projet, préférence ou signal utilisateur inventé dans l’application normale. Sites V66 est inchangée.</p><a class="open" href="AD-preview.html" target="_blank">Ouvrir l’application interactive ↗</a><a href="AD-preview.html" download>Télécharger le HTML autonome</a><p>La prévisualisation utilise le bundle de production, sans données préchargées. Elle fonctionne localement et n’est connectée ni à Sites ni à Grok. Aucune URL publique d’hébergement n’est configurée.</p><nav>${views.map(([slug, title]) => `<a href="#${slug}">${title.split(" · ")[0]}${slug === "accueil-now" ? " · NOW" : slug === "projet-detail" ? " · détail" : ""}</a>`).join("")}</nav></header><main>${sections}</main></html>`;
await writeFile(path.join(output, "index.html"), html);
console.log(
  "Review gallery + 12 screenshots + exact interactive production bundle: " +
    output,
);

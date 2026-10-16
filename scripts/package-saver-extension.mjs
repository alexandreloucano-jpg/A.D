import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const files = [
  "manifest.json",
  "background.js",
  "collect.js",
  "bridge.js",
  "popup.html",
  "popup.js",
  "README.md",
];
const manifest = JSON.parse(
  await readFile("extensions/ad-saver/manifest.json", "utf8"),
);
if (
  manifest.permissions.some((p) =>
    ["cookies", "webRequest", "debugger", "tabs"].includes(p),
  )
)
  throw Error("Unexpected broad permission");
await mkdir("public", { recursive: true });
execFileSync("python3", [
  "-c",
  `import zipfile
files=${JSON.stringify(files)}
with zipfile.ZipFile('public/ad-saver-extension.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in files:z.write('extensions/ad-saver/'+f,f)
`,
]);
await writeFile(
  "public/ad-saver-extension-info.json",
  JSON.stringify(
    {
      version: manifest.version,
      distribution: "development-zip",
      permissions: manifest.permissions,
      recordsOnlyAfterOwnerApproval: true,
    },
    null,
    2,
  ),
);
console.log(
  "A.D browser capture packaged; no credentials or user data included.",
);

import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const files = [
  "manifest.json",
  "background.js",
  "collect.js",
  "bridge.js",
  "popup.html",
  "popup.js",
  "README.md",
  "media.js",
  "transfer-x.js",
];
const manifest = JSON.parse(
  await readFile("extensions/ad-saver/manifest.json", "utf8"),
);
if (
  manifest.permissions.some((p) =>
    ["debugger", "tabs", "proxy", "nativeMessaging"].includes(p),
  )
)
  throw Error("Unexpected broad permission");
if (
  manifest.host_permissions.some(
    (p) =>
      ![
        "https://x.com/*",
        "https://twitter.com/*",
        "https://abs.twimg.com/*",
        "https://pbs.twimg.com/*",
        "https://video.twimg.com/*",
      ].includes(p),
  )
)
  throw Error("Unexpected host permission");
async function include(dir) {
  for (const entry of await readdir("extensions/ad-saver/" + dir, {
    withFileTypes: true,
  })) {
    const path = dir + "/" + entry.name;
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) await include(path);
    else files.push(path);
  }
}
await include("xarchive");
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

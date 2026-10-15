// Packaging only: same repository code, no second frontend and no copied secrets.
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  destination = resolve(root, "../ad-scout-service");
await mkdir(destination, { recursive: true });
for (const name of [
  "api",
  "server",
  "src",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "scripts/build-scout.mjs",
])
  await cp(resolve(root, name), resolve(destination, name), {
    recursive: true,
  });
await cp(
  resolve(root, "vercel-gateway.json"),
  resolve(destination, "vercel.json"),
);
await mkdir(resolve(destination, ".vercel"), { recursive: true });
await writeFile(
  resolve(destination, ".vercel/project.json"),
  JSON.stringify({
    projectId: "prj_m4DTCPbHGK4sEdHOLQzkycge3O2S",
    orgId: "team_LHj9tH7oxkjJfpPdYBfG5lmy",
    projectName: "ad-saver-scout-gateway",
  }),
);
await writeFile(
  resolve(destination, ".gitignore"),
  "node_modules/\n.env*\n.vercel/\n",
);
console.log(
  "Scout service package prepared from existing repository code; no environment files copied.",
);

import { it, expect } from "vitest";
import ts from "typescript";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
it("loads the compiled shared intake model in the real Node ESM runtime", async () => {
  const root = await mkdtemp(resolve("artifacts/intake-node-"));
  try {
    await mkdir(root + "/src/intake", { recursive: true });
    for (const file of ["src/domain", "src/intake/model"]) {
      const compiled = ts.transpileModule(
        await readFile(file + ".ts", "utf8"),
        {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
          },
        },
      ).outputText;
      await writeFile(root + "/" + file + ".js", compiled);
    }
    const url = pathToFileURL(root + "/src/intake/model.js").href;
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const m=await import(${JSON.stringify(url)}); console.log(m.normalizeIntake({url:'https://twitter.com/a/status/123'}).url);`,
      ],
      { encoding: "utf8" },
    );
    expect(output.trim()).toBe("https://x.com/i/web/status/123");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

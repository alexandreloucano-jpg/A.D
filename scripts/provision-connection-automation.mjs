// Operator-only bootstrap. No repository secrets or personal tokens in the scheduler.
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parseEnv } from "node:util";
const project = JSON.parse(await readFile(".vercel/project.json", "utf8"));
if (project.projectId !== "prj_1NK0BFtjwVt0lktqLgIXquYWjiMG")
  throw Error("Wrong project.");
const team = "team_LHj9tH7oxkjJfpPdYBfG5lmy",
  gateway = "prj_m4DTCPbHGK4sEdHOLQzkycge3O2S";
const run = (command, args, input) =>
  execFileSync(command, args, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
let saved;
try {
  saved = parseEnv(await readFile(".env.automation.local", "utf8"));
} catch {}
const jobSecret =
  saved?.AD_AUTOMATION_SECRET || randomBytes(32).toString("base64url");
let bypass = saved?.AD_VERCEL_JOB_BYPASS;
if (!bypass) {
  try {
    bypass = JSON.parse(
      await readFile(".automation-bypass-request.local", "utf8"),
    ).generate.secret;
  } catch {}
}
const needsBypass = !bypass;
if (!bypass) bypass = randomBytes(16).toString("hex");
await writeFile(
  ".env.automation.local",
  `AD_AUTOMATION_SECRET=${jobSecret}\nAD_VERCEL_JOB_BYPASS=${bypass}\n`,
  { mode: 0o600 },
);
let installed = [];
try {
  installed = JSON.parse(
    await readFile(".automation-configured.local", "utf8"),
  );
} catch {}
let stage = "initialize";
try {
  if (needsBypass) {
    stage = "project automation access";
    await writeFile(
      ".automation-bypass-request.local",
      JSON.stringify({
        generate: {
          secret: bypass,
          note: "A.D fixed connection-sync job; application owner auth remains required elsewhere",
        },
      }),
      { mode: 0o600 },
    );
    run("vercel", [
      "api",
      `/v1/projects/${project.projectId}/protection-bypass?teamId=${team}`,
      "--method",
      "PATCH",
      "--input",
      ".automation-bypass-request.local",
    ]);
  }
  for (const [projectId, key, value] of [
    [project.projectId, "AD_AUTOMATION_SECRET", jobSecret],
    [gateway, "AD_JOB_RELAY_SECRET", jobSecret],
    [gateway, "AD_JOB_RELAY_BYPASS", bypass],
  ]) {
    stage = "service environment " + key;
    const existing = JSON.parse(
      run("vercel", ["api", `/v9/projects/${projectId}/env?teamId=${team}`]),
    );
    const env = existing.envs?.find(
      (e) => e.key === key && e.target?.includes("preview"),
    );
    const marker = projectId + ":" + key;
    if (env && installed.includes(marker)) continue;
    if (env)
      run("vercel", [
        "env",
        "rm",
        key,
        "preview",
        "--yes",
        "--scope",
        "alexandreloucano-3399",
        "--cwd",
        projectId === project.projectId
          ? process.cwd()
          : new URL("../../ad-scout-service", import.meta.url).pathname,
      ]);
    const file = ".automation-environment-request.local";
    await writeFile(
      file,
      JSON.stringify({ key, value, type: "sensitive", target: ["preview"] }),
      { mode: 0o600 },
    );
    run("vercel", [
      "api",
      `/v10/projects/${projectId}/env?teamId=${team}`,
      "--method",
      "POST",
      "--input",
      file,
    ]);
    installed.push(marker);
    await writeFile(".automation-configured.local", JSON.stringify(installed), {
      mode: 0o600,
    });
  }
  console.log(
    "Fixed job credentials configured on the two existing services. Scheduler uses GitHub OIDC, no GitHub secrets. Application SSO unchanged.",
  );
} catch {
  throw Error(
    "Automation provisioning failed at " +
      stage +
      ". No credentials or response bodies are printed.",
  );
}

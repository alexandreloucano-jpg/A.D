// Scoped to the isolated beta. Values are never printed or supplied as CLI arguments.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
const scope = "alexandreloucano-3399",
  app = "ad-saver-reader-beta",
  gateway = "ad-saver-scout-gateway";
const appOrigin =
    "https://ad-saver-reader-beta-alexandreloucano-3399.vercel.app",
  gatewayOrigin =
    "https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app";
try {
  const project = JSON.parse(await readFile(".vercel/project.json", "utf8"));
  if (
    project.projectId !== "prj_1NK0BFtjwVt0lktqLgIXquYWjiMG" ||
    process.env.AD_SCOUT_BETA_PROVISION !== "1"
  )
    throw Error("Wrong isolated beta target.");
  if (!process.env.DATABASE_URL) throw Error("Database missing.");
  const sql = neon(process.env.DATABASE_URL);
  const roles =
    await sql`SELECT rolname FROM pg_roles WHERE rolname='ad_scout_gateway'`;
  if (roles.length)
    throw Error(
      "Role already exists; do not regenerate or rotate its credentials.",
    );
  const owners =
    await sql`SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname IN ('ad_saver','ad_records','ad_quota','ad_audit') AND pg_get_userbyid(c.relowner)=current_user`;
  if (owners[0].count !== 4) throw Error("App must retain table-owner access.");
  const password = randomBytes(32).toString("hex"),
    url = new URL(process.env.DATABASE_URL);
  url.username = "ad_scout_gateway";
  url.password = password;
  const encryptionKey = randomBytes(32).toString("base64");
  // Private recovery material in an ignored file, before remote mutation. Never publish this file.
  await writeFile(
    ".env.scout-provisioned.local",
    "SCOUT_DATABASE_URL=" +
      JSON.stringify(url.href) +
      "\nAD_TOKEN_ENCRYPTION_KEY=" +
      JSON.stringify(encryptionKey) +
      "\n",
    { mode: 0o600, flag: "wx" },
  );
  const statements = (
    await readFile("sql/003-scout-least-privilege.sql", "utf8")
  )
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  await sql.transaction([
    ...statements.map((s) => sql.query(s)),
    sql.query("ALTER ROLE ad_scout_gateway LOGIN PASSWORD '" + password + "'"),
  ]);
  const restricted = neon(url.href);
  const metadata = await restricted`SELECT current_user AS role`;
  if (metadata[0].role !== "ad_scout_gateway")
    throw Error("Scoped role identity unverified.");
  for (const namespace of [
    "session",
    "x-account",
    "collections",
    "reader-answer",
  ]) {
    const rows = await restricted.query(
      "SELECT key FROM ad_records WHERE namespace=$1 LIMIT 1",
      [namespace],
    );
    if (rows.length) throw Error("Role boundary failed.");
  }
  let denied = false;
  try {
    await restricted`SELECT id FROM ad_reader_annotations LIMIT 1`;
  } catch {
    denied = true;
  }
  if (!denied) throw Error("Annotations must be inaccessible.");
  console.log(
    "Scoped Scout role verified: no sessions, X tokens, collections, Taste or annotation access.",
  );
  function env(project, name, value, force = false, type = "config") {
    execFileSync(
      "vercel",
      [
        "env",
        "add",
        name,
        "preview",
        "--project",
        project,
        "--scope",
        scope,
        "--type",
        type,
        "--yes",
        ...(force ? ["--force"] : []),
      ],
      { input: value, stdio: ["pipe", "pipe", "pipe"], env: process.env },
    );
    console.log(project + ": " + name + " configured; value suppressed.");
  }
  for (const [name, value] of Object.entries({
    DATABASE_URL: url.href,
    AD_SERVICE_ROLE: "gateway",
    APP_ORIGIN: appOrigin,
    GATEWAY_ORIGIN: gatewayOrigin,
  }))
    env(
      gateway,
      name,
      value,
      false,
      name === "DATABASE_URL" ? "secret" : "config",
    );
  env(app, "GATEWAY_ORIGIN", gatewayOrigin, true);
  env(app, "AD_TOKEN_ENCRYPTION_KEY", encryptionKey, false, "secret");
} catch {
  console.error(
    "Scoped beta provisioning stopped. No secret value is included in this error. Inspect the provisioning stage before retrying; never rotate an existing role.",
  );
  process.exitCode = 1;
}

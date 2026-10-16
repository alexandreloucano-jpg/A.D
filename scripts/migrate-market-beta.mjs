import { readFile, mkdir, writeFile, chmod } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
const project = JSON.parse(await readFile(".vercel/project.json", "utf8"));
if (
  project.projectName !== "ad-saver-reader-beta" ||
  process.env.AD_MARKET_MIGRATE !== "1"
)
  throw Error("Explicit isolated beta migration only.");
const sql = neon(process.env.DATABASE_URL);
await mkdir("artifacts", { recursive: true });
const tables = await sql.query(
  "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'ad_%'",
);
const backup = { createdAt: new Date().toISOString(), tables: {} };
for (const { tablename } of tables) {
  if (!/^ad_[a-z_]+$/.test(tablename)) throw Error("Unsafe table name");
  backup.tables[tablename] = await sql.query(
    'SELECT to_jsonb(t) AS row FROM public."' + tablename + '" t',
  );
}
const path = "artifacts/market-pre-migration-" + Date.now() + ".private.local";
await writeFile(path, JSON.stringify(backup), { mode: 0o600 });
await chmod(path, 0o600);
const verified = JSON.parse(await readFile(path, "utf8"));
if (Object.keys(verified.tables).length !== tables.length)
  throw Error("Backup not verified");
const statements = (await readFile("sql/005-market-intelligence.sql", "utf8"))
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);
await sql.transaction(statements.map((q) => sql.query(q)));
const result = await sql.query(
  "SELECT count(*)::int AS tables FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'ad_market_%'",
);
console.log(
  JSON.stringify({
    backupVerified: true,
    migration: "005-market-intelligence.sql",
    ...result[0],
  }),
);

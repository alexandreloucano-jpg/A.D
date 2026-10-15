import { readFile, writeFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
const project = JSON.parse(await readFile(".vercel/project.json", "utf8"));
if (
  project.projectId !== "prj_1NK0BFtjwVt0lktqLgIXquYWjiMG" ||
  process.env.AD_READER_BETA_MIGRATION !== "1"
)
  throw Error("Isolated beta project guard required.");
const sql = neon(process.env.DATABASE_URL);
const before = await sql`SELECT count(*)::int AS total FROM ad_saver`;
const policies =
  await sql`SELECT policyname,qual,with_check FROM pg_policies WHERE tablename IN ('ad_records','ad_quota','ad_audit')`;
try {
  await writeFile(
    ".scout-policies-before-automation.local",
    JSON.stringify(policies),
    { mode: 0o600, flag: "wx" },
  );
} catch (e) {
  if (e.code !== "EEXIST") throw e;
}
const source = await readFile(
  "sql/004-scout-automatic-registration.sql",
  "utf8",
);
const statements = source
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);
await sql.transaction(statements.map((statement) => sql.query(statement)));
const after = await sql`SELECT count(*)::int AS total FROM ad_saver`;
if (before[0].total !== after[0].total)
  throw Error("Reference counts changed unexpectedly.");
console.log(
  "Dedicated OAuth registration/refresh policies applied atomically; reference count unchanged.",
);

import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
const project = JSON.parse(await readFile(".vercel/project.json", "utf8"));
if (
  project.projectName !== "ad-saver-reader-beta" ||
  process.env.AD_READER_BETA_MIGRATION !== "1"
)
  throw Error(
    "Reader migrations are restricted to the explicitly selected isolated beta project.",
  );
if (!process.env.DATABASE_URL)
  throw Error("Provision the isolated beta database first.");
const sql = neon(process.env.DATABASE_URL);
for (const file of ["001-private-saver.sql", "002-reader-beta.sql"]) {
  const statements = (
    await readFile(new URL("../sql/" + file, import.meta.url), "utf8")
  )
    .split(";")
    .map((text) => text.trim())
    .filter(Boolean);
  await sql.transaction(statements.map((text) => sql.query(text)));
}
console.log(
  "Isolated reader beta schema ready. Historical Sites storage untouched.",
);

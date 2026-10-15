import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
it("enforces the dedicated Scout boundary in PostgreSQL, independently of application code", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(await readFile("sql/001-private-saver.sql", "utf8"));
    await pg.exec(await readFile("sql/002-reader-beta.sql", "utf8"));
    const own = randomUUID(),
      project = randomUUID(),
      other = randomUUID();
    for (const [owner, id, ref] of [
      ["340639438", own, {}],
      ["340639438", project, { projectId: randomUUID() }],
      ["another-owner", other, {}],
    ] as const)
      await pg.query(
        "INSERT INTO ad_saver(owner_id,id,reference,fingerprint,captured_at) VALUES($1,$2,$3::jsonb,$4,now())",
        [owner, id, JSON.stringify(ref), "fixture"],
      );
    await pg.query(
      "INSERT INTO ad_records(namespace,key,data) VALUES('session','private','{}'),('x-account','private','{}'),('collections','private','{}'),('reader-answer','private','{}'),('client','dedicated','{\"owner\":\"340639438\",\"resource\":\"https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app/mcp\"}')",
    );
    await pg.exec(await readFile("sql/003-scout-least-privilege.sql", "utf8"));
    await pg.exec("SET ROLE ad_scout_gateway");
    expect(
      (await pg.query<{ id: string }>("SELECT id FROM ad_saver")).rows.map(
        (r) => r.id,
      ),
    ).toEqual([own]);
    expect(
      (
        await pg.query<{ namespace: string }>(
          "SELECT namespace FROM ad_records",
        )
      ).rows.map((r) => r.namespace),
    ).toEqual(["client"]);
    await expect(
      pg.query("SELECT * FROM ad_reader_annotations"),
    ).rejects.toThrow(/permission denied/);
    await expect(pg.query("DELETE FROM ad_saver")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      pg.query(
        "INSERT INTO ad_records(namespace,key,data) VALUES('session','forged','{}')",
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      pg.query(
        "INSERT INTO ad_records(namespace,key,data) VALUES('token','wrong-resource',$1::jsonb)",
        [
          JSON.stringify({
            owner: "340639438",
            resource: "https://global.example/mcp",
            scope: "saver:read saver:write",
          }),
        ],
      ),
    ).rejects.toThrow(/row-level security/);
    await pg.exec("RESET ROLE");
    expect((await pg.query("SELECT id FROM ad_saver")).rows).toHaveLength(3);
    expect(
      (await pg.query("SELECT namespace FROM ad_records")).rows,
    ).toHaveLength(5);
  } finally {
    await pg.close();
  }
}, 30000);

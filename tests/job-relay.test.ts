import {
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  it,
  expect,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { Store } from "../server/store";
import { handle } from "../server/service";
import type { Config } from "../server/security";
let pg: PGlite, s: Store, key: CryptoKey, jwk: object;
const c: Config = {
  role: "gateway",
  app: "https://app.example",
  gateway: "https://gateway.example",
  owner: "340639438",
  githubClient: "",
  githubSecret: "",
  redirects: [],
};
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(await readFile("sql/001-private-saver.sql", "utf8"));
  s = new Store(
    async (q, p = []) =>
      (await pg.query(q, p)).rows as Record<string, unknown>[],
  );
  const pair = await generateKeyPair("RS256");
  key = pair.privateKey;
  jwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: "github-fixture",
    alg: "RS256",
    use: "sig",
  };
}, 30000);
beforeEach(async () => {
  await pg.exec("TRUNCATE ad_records,ad_quota,ad_audit");
  vi.stubEnv("AD_JOB_RELAY_SECRET", "a".repeat(43));
  vi.stubEnv("AD_JOB_RELAY_BYPASS", "b".repeat(32));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(async () => pg.close());
async function identity(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    repository: "alexandreloucano-jpg/A.D",
    repository_id: "1418840826",
    repository_owner_id: "340639438",
    ref: "refs/heads/codex/ad-rebuild",
    workflow_ref:
      "alexandreloucano-jpg/A.D/.github/workflows/connections.yml@refs/heads/codex/ad-rebuild",
    event_name: "schedule",
    run_id: "123",
    run_attempt: "1",
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "github-fixture" })
    .setSubject("repo:alexandreloucano-jpg@340639438/A.D@1418840826:ref:refs/heads/codex/ad-rebuild")
    .setIssuer("https://token.actions.githubusercontent.com")
    .setAudience(c.gateway + "/jobs/connections")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}
function request(token: string) {
  return new Request(c.gateway + "/jobs/connections", {
    method: "POST",
    headers: { authorization: "Bearer " + token },
  });
}
it("accepts only the signed exact workflow and relays only the fixed job, never private Saver routes", async () => {
  let jobs = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init: any) => {
      if (String(url).includes("/.well-known/jwks"))
        return Response.json({ keys: [jwk] });
      expect(String(url)).toBe(c.app + "/api/jobs/connections");
      expect(init.redirect).toBe("error");
      expect(init.headers.authorization).toBe("Bearer " + "a".repeat(43));
      expect(init.headers["x-vercel-protection-bypass"]).toBe("b".repeat(32));
      jobs++;
      return Response.json({ completed: true, outcomes: [] });
    }),
  );
  const token = await identity(),
    result = await handle(request(token), s, c);
  expect(await result.json()).toEqual({ completed: true, pending: false });
  expect(jobs).toBe(1);
  expect((await handle(request(token), s, c)).status).toBe(429);
  expect(jobs).toBe(1);
  expect(
    (
      await handle(
        new Request(c.gateway + "/api/saver", {
          headers: { authorization: "Bearer " + token },
        }),
        s,
        c,
      )
    ).status,
  ).toBe(404);
});
it("rejects another repository, branch, workflow and untrusted pull-request event before any job executes", async () => {
  let jobs = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any) => {
      if (String(url).includes("/.well-known/jwks"))
        return Response.json({ keys: [jwk] });
      jobs++;
      throw Error("must not run");
    }),
  );
  for (const claims of [
    { repository: "attacker/A.D" },
    { repository_id: "999" },
    { repository_owner_id: "999" },
    { ref: "refs/heads/other" },
    {
      workflow_ref:
        "alexandreloucano-jpg/A.D/.github/workflows/evil.yml@refs/heads/codex/ad-rebuild",
    },
    { event_name: "pull_request" },
  ])
    expect((await handle(request(await identity(claims)), s, c)).status).toBe(
      401,
    );
  expect(jobs).toBe(0);
  expect((await handle(request("not-a-jwt"), s, c)).status).toBe(401);
});

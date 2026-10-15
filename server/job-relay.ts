import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { Store, ServiceError } from "./store.js";
import type { Config } from "./security.js";
const keys = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
  {
    [customFetch]: (url, options) =>
      fetch(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      }),
  },
);
export async function relayConnections(r: Request, s: Store, c: Config) {
  if (c.role !== "gateway") throw new ServiceError(404, "not_found");
  if (r.method !== "POST") throw new ServiceError(405, "method_not_allowed");
  const authorization = r.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer "))
    throw new ServiceError(401, "job_identity_required");
  let run = "";
  try {
    const { payload } = await jwtVerify(authorization.slice(7), keys, {
      issuer: "https://token.actions.githubusercontent.com",
      audience: c.gateway + "/jobs/connections",
      algorithms: ["RS256"],
      requiredClaims: [
        "sub",
        "exp",
        "iat",
        "repository",
        "ref",
        "workflow_ref",
        "event_name",
        "run_id",
        "run_attempt",
      ],
      maxTokenAge: "10 minutes",
      clockTolerance: 5,
    });
    if (
      payload.repository !== "alexandreloucano-jpg/A.D" ||
      payload.ref !== "refs/heads/codex/ad-rebuild" ||
      payload.sub !==
        "repo:alexandreloucano-jpg/A.D:ref:refs/heads/codex/ad-rebuild" ||
      payload.workflow_ref !==
        "alexandreloucano-jpg/A.D/.github/workflows/connections.yml@refs/heads/codex/ad-rebuild" ||
      (payload.job_workflow_ref !== undefined &&
        payload.job_workflow_ref !== payload.workflow_ref) ||
      !["schedule", "workflow_dispatch", "push"].includes(
        String(payload.event_name),
      ) ||
      !/^\d{1,20}$/.test(String(payload.run_id)) ||
      !/^\d{1,4}$/.test(String(payload.run_attempt))
    )
      throw Error("claims");
    run = String(payload.run_id) + ":" + String(payload.run_attempt);
  } catch {
    throw new ServiceError(401, "job_identity_rejected");
  }
  await s.quota("job-relay-hour:" + c.owner, 8, 3600);
  await s.quota("job-relay-run:" + run, 1, 86400);
  const secret = process.env.AD_JOB_RELAY_SECRET || "",
    bypass = process.env.AD_JOB_RELAY_BYPASS || "";
  if (secret.length < 40 || bypass.length !== 32)
    throw new ServiceError(503, "job_relay_not_configured");
  let response: Response;
  try {
    response = await fetch(c.app + "/api/jobs/connections", {
      method: "POST",
      redirect: "error",
      headers: {
        authorization: "Bearer " + secret,
        "x-vercel-protection-bypass": bypass,
      },
      signal: AbortSignal.timeout(55000),
    });
  } catch {
    throw new ServiceError(503, "connection_job_unreachable");
  }
  if (!response.ok) throw new ServiceError(503, "connection_job_not_confirmed");
  const result = (await response.json()) as {
    completed?: boolean;
    pending?: boolean;
  };
  return Response.json(
    { completed: result.completed === true, pending: result.pending === true },
    { headers: { "cache-control": "no-store" } },
  );
}

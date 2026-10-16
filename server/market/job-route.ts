import { z } from "zod";
import { equal, type Config } from "../security.js";
import { ServiceError, type Store } from "../store.js";
import { scan } from "./jobs.js";
// Operator capability: only a bounded public-source scan. Cannot read private data or mint sessions.
export async function marketJob(r: Request, s: Store, c: Config) {
  if (c.role !== "app" || r.method !== "POST")
    throw new ServiceError(404, "not_found");
  const secret = process.env.AD_MARKET_SCAN_SECRET || "";
  if (
    secret.length < 40 ||
    !equal(r.headers.get("authorization") || "", "Bearer " + secret)
  )
    throw new ServiceError(401, "job_authorization_required");
  if (
    process.env.AD_MARKET_ENABLED !== "1" ||
    process.env.AD_MARKET_SCAN_ENABLED !== "1"
  )
    throw new ServiceError(503, "market_scan_disabled");
  const b = z
    .object({ runId: z.string().uuid().optional() })
    .strict()
    .parse(await r.json());
  const result = await scan(s, c.owner, b.runId);
  const { urls, ...receipt } = result;
  void urls;
  return Response.json(receipt, {
    headers: { "cache-control": "private, no-store" },
  });
}

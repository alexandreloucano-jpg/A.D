import { z } from "zod";
import type { Config } from "../security.js";
import { owner } from "../security.js";
import { ServiceError, type Store } from "../store.js";
import { runLifecycleDryRun } from "./engine.js";

export async function lifecycleRoute(request: Request, store: Store, config: Config) {
  if (config.role !== "app") throw new ServiceError(404, "not_found");
  if (new URL(request.url).pathname !== "/api/lifecycle/dry-run")
    throw new ServiceError(404, "not_found");
  if (request.method !== "POST")
    throw new ServiceError(405, "method_not_allowed");

  const session = await owner(request, store, config, true);
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 1024)
    throw new ServiceError(413, "request_too_large");
  let input: unknown;
  try {
    input = JSON.parse(raw || "{}");
  } catch {
    throw new ServiceError(400, "invalid_json");
  }
  z.object({}).strict().parse(input);
  await store.quota("lifecycle-dry-run:" + session.owner, 20, 86400);

  return Response.json(await runLifecycleDryRun(store, session.owner, config), {
    headers: {
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

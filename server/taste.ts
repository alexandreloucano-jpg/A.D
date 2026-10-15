import { owner, type Config } from "./security.js";
import { type Store, ServiceError } from "./store.js";
import { ReaderStore } from "./reader.js";
import { z } from "zod";
export async function tasteRoute(request: Request, store: Store, c: Config) {
  if (request.method !== "GET")
    throw new ServiceError(405, "method_not_allowed");
  const session = await owner(request, store, c),
    id = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("reference"));
  const reference = await store.read(session.owner, id);
  if (!reference || reference.isInternalQA)
    throw new ServiceError(404, "reference_not_found");
  const reader = new ReaderStore(store);
  const interpretations = await store.query(
    "SELECT data FROM ad_records WHERE namespace='reader-answer' AND key LIKE $1 AND data->>'referenceId'=$2 ORDER BY key LIMIT 50",
    [session.owner + ":" + id + ":%", id],
  );
  return new Response(
    JSON.stringify({
      referenceId: id,
      source: {
        reference,
        document: await reader.current(session.owner, reference),
      },
      humanAnnotations: await reader.annotations(session.owner, id),
      aiInterpretations: interpretations.map((r) => r.data),
      updatesConfirmedPreferences: false,
      createsTasks: false,
    }),
    {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    },
  );
}

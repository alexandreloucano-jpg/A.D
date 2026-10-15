import {
  collectionsSchema,
  emptyCollections,
} from "../src/collections/model.js";
import { owner, type Config } from "./security.js";
import { Store, ServiceError } from "./store.js";
export async function collectionsRoute(
  request: Request,
  store: Store,
  config: Config,
) {
  const write = request.method === "PUT";
  if (!write && request.method !== "GET")
    throw new ServiceError(405, "method_not_allowed");
  const session = await owner(request, store, config, write);
  const read = async () =>
    collectionsSchema.parse(
      (await store.get("collections", session.owner)) ?? emptyCollections(),
    );
  const json = (value: unknown) =>
    new Response(JSON.stringify(value), {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  if (!write) return json({ collections: await read() });
  await store.quota("collections:" + session.owner, 30);
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 300000)
    throw new ServiceError(413, "request_too_large");
  const expected = collectionsSchema.parse(JSON.parse(raw));
  const ids = [...new Set(expected.groups.flatMap((g) => g.referenceIds))];
  if (ids.length) {
    const rows = await store.query(
      "SELECT id FROM ad_saver WHERE owner_id=$1 AND id=ANY($2::uuid[])",
      [session.owner, ids],
    );
    if (rows.length !== ids.length)
      throw new ServiceError(400, "reference_not_owned");
  }
  const next = { ...expected, revision: expected.revision + 1 };
  const rows = await store.query(
    "INSERT INTO ad_records(namespace,key,data) SELECT 'collections',$1,$2::jsonb WHERE $3::int=0 OR EXISTS(SELECT 1 FROM ad_records WHERE namespace='collections' AND key=$1) ON CONFLICT(namespace,key) DO UPDATE SET data=excluded.data WHERE (ad_records.data->>'revision')::int=$3 RETURNING key",
    [session.owner, JSON.stringify(next), expected.revision],
  );
  if (!rows.length) throw new ServiceError(409, "collections_changed");
  const saved = await read();
  if (JSON.stringify(saved) !== JSON.stringify(next))
    throw new ServiceError(409, "collections_readback_failed");
  await store.audit(session.owner, "owner", "collections_update", "verified");
  return json({ collections: saved, verified: true });
}

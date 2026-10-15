import { Store, ServiceError } from "./store.js";
import { equal, owner, type Config } from "./security.js";
import { syncBookmarks } from "./x.js";
import { maintainInstagram } from "./instagram.js";
export async function runConnections(s: Store, c: Config) {
  const outcomes: { service: string; status: string; error?: string }[] = [];
  const x = await s.get<{
    enabled: boolean;
    lastSyncAt: string | null;
    retryAt: number;
  }>("x-account", c.owner);
  if (
    x?.enabled &&
    x.retryAt <= Date.now() &&
    Date.now() - (Date.parse(x.lastSyncAt || "") || 0) >= 30 * 60000
  ) {
    try {
      await s.quota("automatic-x:" + c.owner, 4, 900);
      await syncBookmarks(s, c);
      await s.remove("x-error", c.owner);
      outcomes.push({ service: "x", status: "verified" });
    } catch (e) {
      const error =
        e instanceof ServiceError ? e.code : "x_temporarily_unavailable";
      await s.put("x-error", c.owner, {
        code: error,
        at: new Date().toISOString(),
      });
      outcomes.push({ service: "x", status: "retry", error });
    }
  } else
    outcomes.push({
      service: "x",
      status: x?.enabled ? "not_due" : "not_connected_or_paused",
    });
  try {
    outcomes.push({
      service: "instagram",
      status: await maintainInstagram(s, c),
    });
  } catch (e) {
    outcomes.push({
      service: "instagram",
      status: "retry",
      error: e instanceof ServiceError ? e.code : "instagram_unavailable",
    });
  }
  await s.put("connection-job", c.owner, {
    checkedAt: new Date().toISOString(),
    outcomes,
  });
  return { completed: true, outcomes };
}
export async function automationRoute(r: Request, s: Store, c: Config) {
  if (c.role !== "app") throw new ServiceError(404, "not_found");
  if (r.method !== "POST") throw new ServiceError(405, "method_not_allowed");
  const cron = new URL(r.url).pathname === "/api/jobs/connections";
  if (cron) {
    const secret = process.env.AD_AUTOMATION_SECRET || "";
    if (
      secret.length < 40 ||
      !equal(r.headers.get("authorization") || "", "Bearer " + secret)
    )
      throw new ServiceError(401, "job_authorization_required");
  } else await owner(r, s, c, true);
  // A distributed lease makes scheduled and foreground triggers idempotent.
  const rows = await s.query(
    "INSERT INTO ad_records(namespace,key,data,expires_at) VALUES('connection-job-lock',$1,'{}',now()+interval '2 minutes') ON CONFLICT(namespace,key) DO UPDATE SET expires_at=excluded.expires_at WHERE ad_records.expires_at<now() RETURNING key",
    [c.owner],
  );
  if (!rows.length)
    return Response.json(
      { completed: false, pending: true },
      { headers: { "cache-control": "no-store" } },
    );
  try {
    return Response.json(await runConnections(s, c), {
      headers: { "cache-control": "no-store" },
    });
  } finally {
    await s.remove("connection-job-lock", c.owner);
  }
}

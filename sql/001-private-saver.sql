-- Independent PostgreSQL database only. Never run against historical Sites storage.
CREATE TABLE IF NOT EXISTS ad_records (
 namespace text NOT NULL,
 key text NOT NULL,
 data jsonb NOT NULL,
 expires_at timestamptz,
 PRIMARY KEY(namespace,key)
);
CREATE INDEX IF NOT EXISTS ad_records_expiry ON ad_records(expires_at) WHERE expires_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS ad_saver (
 owner_id text NOT NULL,
 id uuid NOT NULL,
 reference jsonb NOT NULL,
 fingerprint text NOT NULL,
 captured_at timestamptz NOT NULL,
 PRIMARY KEY(owner_id,id)
);
CREATE INDEX IF NOT EXISTS ad_saver_recent ON ad_saver(owner_id,captured_at,id);
CREATE TABLE IF NOT EXISTS ad_quota (
 principal text NOT NULL,
 bucket_window bigint NOT NULL,
 used integer NOT NULL,
 PRIMARY KEY(principal,bucket_window)
);
CREATE TABLE IF NOT EXISTS ad_audit (
 id uuid PRIMARY KEY,
 owner_id text NOT NULL,
 principal text NOT NULL,
 operation text NOT NULL,
 outcome text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);

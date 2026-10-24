-- A.D V3: owner-only versioned workspace snapshots.
-- Apply to a disposable database first; production migration requires explicit backup approval.
-- No permissions are granted to public or Saver/MCP gateway roles.
CREATE TABLE IF NOT EXISTS ad_workspace_head (
  owner_id text PRIMARY KEY,
  server_revision integer NOT NULL CHECK(server_revision > 0),
  workspace jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ad_workspace_history (
  owner_id text NOT NULL,
  server_revision integer NOT NULL CHECK(server_revision > 0),
  workspace jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,server_revision)
);
CREATE INDEX IF NOT EXISTS ad_workspace_history_owner_date
  ON ad_workspace_history(owner_id,created_at DESC);

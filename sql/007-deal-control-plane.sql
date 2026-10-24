-- A.D Control Plane — proposed additive migration, NOT APPLIED.
-- This schema is PRIVATE / mono-owner until server auth and tenant isolation are audited.
-- Never grant these tables to the existing ad-saver-scout gateway role.
-- Every SQL access must constrain owner_id from authenticated server session.
-- Require a transaction + optimistic lock for deal update + audit insertion.

CREATE TABLE IF NOT EXISTS ad_deals (
  owner_id text NOT NULL,
  id uuid NOT NULL,
  company_id uuid,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  relationship text NOT NULL CHECK (relationship IN ('NEW','EXISTING')),
  state text NOT NULL CHECK (state IN ('CAPTURED','VERIFIED','QUALIFIED',
    'CREATIVE_DRAFT','FINANCIAL_REVIEW','OFFER_DRAFT','LEGAL_REVIEW',
    'READY_FOR_APPROVAL','APPROVED','WON','LOST','PAUSED','NO_DEAL','DELIVERY','OUTCOME')),
  model text CHECK (model IN ('CASH','CASH_PLUS_EQUITY','BRAND_JV','IP_LICENCE','SOFTWARE','NO_DEAL')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,id)
);

CREATE TABLE IF NOT EXISTS ad_deal_artifacts (
  owner_id text NOT NULL,
  id uuid NOT NULL,
  deal_id uuid NOT NULL,
  artifact_type text NOT NULL CHECK (artifact_type IN ('EVIDENCE','CREATIVE','FINANCE',
    'OFFER','CONTRACT_DRAFT','DELIVERY','OUTCOME','QA','OTHER')),
  version integer NOT NULL CHECK (version >= 1),
  status text NOT NULL CHECK (status IN ('DRAFT','NEEDS_REVIEW','APPROVED','REJECTED','SUPERSEDED')),
  source_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  rights_scope text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,id),
  FOREIGN KEY(owner_id,deal_id) REFERENCES ad_deals(owner_id,id)
);

CREATE TABLE IF NOT EXISTS ad_deal_events (
  owner_id text NOT NULL,
  id uuid NOT NULL,
  deal_id uuid NOT NULL,
  sequence bigint NOT NULL CHECK(sequence > 0),
  actor_type text NOT NULL CHECK(actor_type IN ('OWNER','AGENT','SYSTEM','SPECIALIST')),
  actor_id text NOT NULL,
  event_type text NOT NULL,
  input_version integer,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,id),
  UNIQUE(owner_id,deal_id,sequence),
  FOREIGN KEY(owner_id,deal_id) REFERENCES ad_deals(owner_id,id)
);

CREATE TABLE IF NOT EXISTS ad_deal_approvals (
  owner_id text NOT NULL,
  id uuid NOT NULL,
  deal_id uuid NOT NULL,
  artifact_id uuid,
  artifact_version integer,
  action text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('APPROVE','REJECT','REQUEST_CHANGES')),
  approved_by text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY(owner_id,id),
  FOREIGN KEY(owner_id,deal_id) REFERENCES ad_deals(owner_id,id),
  FOREIGN KEY(owner_id,artifact_id) REFERENCES ad_deal_artifacts(owner_id,id)
);

CREATE TABLE IF NOT EXISTS ad_agent_runs (
  owner_id text NOT NULL,
  id uuid NOT NULL,
  deal_id uuid,
  agent_id text NOT NULL,
  agent_version text NOT NULL,
  policy_scope text NOT NULL CHECK (policy_scope IN ('RUN_PRIVATE','DRAFT')),
  idempotency_key text NOT NULL,
  status text NOT NULL CHECK(status IN ('PENDING','RUNNING','DONE','HELD','FAILED')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  lease_until timestamptz,
  input_hash text NOT NULL,
  output_artifact_id uuid,
  token_cost integer NOT NULL DEFAULT 0 CHECK (token_cost >= 0),
  estimated_cost_eur numeric(14,4) NOT NULL DEFAULT 0 CHECK (estimated_cost_eur >= 0),
  error_code text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,id),
  UNIQUE(owner_id,idempotency_key),
  FOREIGN KEY(owner_id,deal_id) REFERENCES ad_deals(owner_id,id),
  FOREIGN KEY(owner_id,output_artifact_id) REFERENCES ad_deal_artifacts(owner_id,id)
);
CREATE INDEX IF NOT EXISTS ad_deals_by_state ON ad_deals(owner_id,state,updated_at DESC);
CREATE INDEX IF NOT EXISTS ad_deal_events_latest ON ad_deal_events(owner_id,deal_id,sequence DESC);
CREATE INDEX IF NOT EXISTS ad_agent_runs_pending ON ad_agent_runs(owner_id,status,lease_until);

-- Production gate:
-- 1. Backup, test in isolated staging; verify exact DB principal and permissions.
-- 2. Verify owner-scoped API read/write on every access; cross-owner negatives.
-- 3. Implement transactional optimistic locking, append-only audit policy, idempotent jobs.
-- 4. Consider RLS with verified session scoping prior to multi-tenant use.
-- 5. Do not auto-migrate or expose any public route solely because this file exists.

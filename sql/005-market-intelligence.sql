-- Additive private domain. No privileges granted to the Saver gateway role.
CREATE TABLE IF NOT EXISTS ad_market_sources(owner_id text NOT NULL, source_id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY(owner_id,source_id));
CREATE TABLE IF NOT EXISTS ad_market_scan_runs(owner_id text NOT NULL,id uuid NOT NULL,data jsonb NOT NULL,PRIMARY KEY(owner_id,id));
CREATE TABLE IF NOT EXISTS ad_market_leases(owner_id text PRIMARY KEY,lease_id uuid NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS ad_market_companies(owner_id text NOT NULL,id uuid NOT NULL,canonical_name text NOT NULL,data jsonb NOT NULL,PRIMARY KEY(owner_id,id),UNIQUE(owner_id,canonical_name));
CREATE TABLE IF NOT EXISTS ad_market_signals(owner_id text NOT NULL,id uuid NOT NULL,company_id uuid NOT NULL,canonical_url text NOT NULL,event_key text NOT NULL,data jsonb NOT NULL,PRIMARY KEY(owner_id,id),UNIQUE(owner_id,canonical_url),UNIQUE(owner_id,event_key),FOREIGN KEY(owner_id,company_id) REFERENCES ad_market_companies(owner_id,id));
CREATE TABLE IF NOT EXISTS ad_market_evidence(owner_id text NOT NULL,id uuid NOT NULL,signal_id uuid NOT NULL,url text NOT NULL,data jsonb NOT NULL,PRIMARY KEY(owner_id,id),UNIQUE(owner_id,url),FOREIGN KEY(owner_id,signal_id) REFERENCES ad_market_signals(owner_id,id));
CREATE TABLE IF NOT EXISTS ad_market_opportunities(owner_id text NOT NULL,id uuid NOT NULL,company_id uuid NOT NULL,signal_id uuid NOT NULL,data jsonb NOT NULL,PRIMARY KEY(owner_id,id),UNIQUE(owner_id,signal_id),FOREIGN KEY(owner_id,company_id) REFERENCES ad_market_companies(owner_id,id),FOREIGN KEY(owner_id,signal_id) REFERENCES ad_market_signals(owner_id,id));
CREATE TABLE IF NOT EXISTS ad_market_actions(owner_id text NOT NULL,id uuid NOT NULL,opportunity_id uuid NOT NULL,data jsonb NOT NULL CHECK(data->>'lane' IN ('LATER','NOW','KILL')) CHECK(data->>'lane'<>'NOW' OR data->>'acceptedAt' IS NOT NULL),PRIMARY KEY(owner_id,id),FOREIGN KEY(owner_id,opportunity_id) REFERENCES ad_market_opportunities(owner_id,id));
CREATE TABLE IF NOT EXISTS ad_market_contacts(owner_id text NOT NULL,id uuid NOT NULL,company_id uuid NOT NULL,data jsonb NOT NULL,PRIMARY KEY(owner_id,id),FOREIGN KEY(owner_id,company_id) REFERENCES ad_market_companies(owner_id,id));
CREATE TABLE IF NOT EXISTS ad_market_feedback(owner_id text NOT NULL,id uuid NOT NULL,opportunity_id uuid NOT NULL,data jsonb NOT NULL,PRIMARY KEY(owner_id,id),FOREIGN KEY(owner_id,opportunity_id) REFERENCES ad_market_opportunities(owner_id,id));
CREATE TABLE IF NOT EXISTS ad_market_briefs(owner_id text NOT NULL,brief_date date NOT NULL,data jsonb NOT NULL,PRIMARY KEY(owner_id,brief_date));
CREATE INDEX IF NOT EXISTS ad_market_review_idx ON ad_market_opportunities(owner_id,(data->>'reviewState'),id);
CREATE INDEX IF NOT EXISTS ad_market_stage_idx ON ad_market_opportunities(owner_id,(data->>'stage'),id);
CREATE INDEX IF NOT EXISTS ad_market_run_idx ON ad_market_scan_runs(owner_id,(data->>'startedAt'));

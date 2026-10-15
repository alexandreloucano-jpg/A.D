-- Isolated beta only. App connection is the table owner and retains its existing access.
-- This role is NOLOGIN until provisioned with a fresh secret through a private deployment script.
CREATE ROLE ad_scout_gateway NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO ad_scout_gateway;
GRANT SELECT,INSERT ON ad_saver TO ad_scout_gateway;
GRANT SELECT,INSERT,UPDATE,DELETE ON ad_records TO ad_scout_gateway;
GRANT SELECT,INSERT,UPDATE ON ad_quota TO ad_scout_gateway;
GRANT INSERT ON ad_audit TO ad_scout_gateway;
ALTER TABLE ad_saver ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_quota ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY scout_saver_read ON ad_saver FOR SELECT TO ad_scout_gateway USING(owner_id='340639438' AND COALESCE(reference->>'projectId','')='' AND COALESCE((reference->>'isInternalQA')::boolean,false)=false);
CREATE POLICY scout_saver_insert ON ad_saver FOR INSERT TO ad_scout_gateway WITH CHECK(owner_id='340639438' AND COALESCE(reference->>'projectId','')='' AND COALESCE((reference->>'isInternalQA')::boolean,false)=false);
CREATE POLICY scout_oauth_read ON ad_records FOR SELECT TO ad_scout_gateway USING((namespace='client' AND data->>'owner'='340639438' AND data->>'resource'='https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app/mcp') OR (namespace IN ('code','token') AND data->>'owner'='340639438' AND data->>'resource'='https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app/mcp' AND data->>'scope'='saver:read saver:write'));
CREATE POLICY scout_oauth_insert ON ad_records FOR INSERT TO ad_scout_gateway WITH CHECK(namespace='token' AND data->>'owner'='340639438' AND data->>'resource'='https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app/mcp' AND data->>'scope'='saver:read saver:write');
CREATE POLICY scout_oauth_update ON ad_records FOR UPDATE TO ad_scout_gateway USING(namespace='token' AND data->>'owner'='340639438' AND data->>'resource'='https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app/mcp') WITH CHECK(namespace='token' AND data->>'owner'='340639438' AND data->>'resource'='https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app/mcp' AND data->>'scope'='saver:read saver:write');
CREATE POLICY scout_oauth_delete ON ad_records FOR DELETE TO ad_scout_gateway USING(namespace IN ('code','token') AND data->>'owner'='340639438' AND data->>'resource'='https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app/mcp');
CREATE POLICY scout_quota ON ad_quota FOR ALL TO ad_scout_gateway USING(principal LIKE 'mcp:%' OR principal LIKE 'token:%' OR principal='mcp-owner:340639438') WITH CHECK(principal LIKE 'mcp:%' OR principal LIKE 'token:%' OR principal='mcp-owner:340639438');
CREATE POLICY scout_audit ON ad_audit FOR INSERT TO ad_scout_gateway WITH CHECK(owner_id='340639438' AND operation IN ('token_issue','token_revoke','tool_denied','get_saved_inspiration','get_saver_capture','save_inspiration_reference','save_reference_batch'));

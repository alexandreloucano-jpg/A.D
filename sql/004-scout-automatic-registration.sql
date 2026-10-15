-- Dedicated beta gateway only. No grants on owner accounts, tokens, annotations,
-- preferences or historical Sites. Automatic registration is NOT authorization.
DROP POLICY IF EXISTS scout_oauth_insert ON ad_records;
CREATE POLICY scout_oauth_insert ON ad_records FOR INSERT TO ad_scout_gateway WITH CHECK(
  (namespace IN ('token','refresh') AND data->>'owner'='340639438' AND data->>'resource'='https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app/mcp' AND data->>'scope'='saver:read saver:write')
  OR (namespace='client' AND key=data->>'id' AND data->>'owner'='340639438' AND data->>'resource'='https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app/mcp'
      AND data->>'registration'='dynamic' AND data->>'defaultScope'='saver:read saver:write'
      AND data->'redirects'='["https://grok.com/connectors-oauth-exchange-code/"]'::jsonb
      AND data->'revoked'='false'::jsonb AND data->'refreshAllowed'='true'::jsonb
      AND ((data->>'authMethod'='none' AND data->>'secretHash'='') OR (data->>'authMethod' IN ('client_secret_post','client_secret_basic') AND data->>'secretHash' ~ '^[a-f0-9]{64}$')))
);
DROP POLICY IF EXISTS scout_oauth_read ON ad_records;
CREATE POLICY scout_oauth_read ON ad_records FOR SELECT TO ad_scout_gateway USING(
 (namespace='client' AND data->>'owner'='340639438' AND data->>'resource'='https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app/mcp')
 OR (namespace IN ('code','token','refresh') AND data->>'owner'='340639438' AND data->>'resource'='https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app/mcp' AND data->>'scope'='saver:read saver:write')
);
DROP POLICY IF EXISTS scout_oauth_delete ON ad_records;
CREATE POLICY scout_oauth_delete ON ad_records FOR DELETE TO ad_scout_gateway USING(namespace IN ('code','token','refresh') AND data->>'owner'='340639438' AND data->>'resource'='https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app/mcp');
DROP POLICY IF EXISTS scout_quota ON ad_quota;
CREATE POLICY scout_quota ON ad_quota FOR ALL TO ad_scout_gateway USING(principal LIKE 'mcp:%' OR principal LIKE 'token:%' OR principal IN ('mcp-owner:340639438','dcr-hour:340639438','dcr-day:340639438','job-relay-hour:340639438') OR principal LIKE 'job-relay-run:%') WITH CHECK(principal LIKE 'mcp:%' OR principal LIKE 'token:%' OR principal IN ('mcp-owner:340639438','dcr-hour:340639438','dcr-day:340639438','job-relay-hour:340639438') OR principal LIKE 'job-relay-run:%');
DROP POLICY IF EXISTS scout_audit ON ad_audit;
CREATE POLICY scout_audit ON ad_audit FOR INSERT TO ad_scout_gateway WITH CHECK(owner_id='340639438' AND operation IN ('client_register','token_issue','token_refresh','token_revoke','tool_denied','get_saved_inspiration','get_saver_capture','save_inspiration_reference','save_reference_batch'));

-- A.D Studio public enquiry inbox, gated by AD_PUBLIC_ENQUIRIES_ENABLED.
-- NOT APPLIED. Owner-only app server role, never Saver gateway.
-- Personal data: put accurate identity, privacy terms, retention and deletion process in place.
CREATE TABLE IF NOT EXISTS ad_studio_inquiries (
 owner_id text NOT NULL,
 id uuid NOT NULL,
 name text NOT NULL,
 email text NOT NULL,
 brand text NOT NULL,
 website text,
 sector text NOT NULL,
 challenge text NOT NULL,
 stage text NOT NULL DEFAULT 'NEW'
   CHECK(stage IN ('NEW','REVIEWING','QUALIFIED','DISCOVERY','PROPOSAL','WON','LOST','CLOSED')),
 marketing_opt_in boolean NOT NULL DEFAULT false,
 source_path text NOT NULL DEFAULT '/studio',
 notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,id)
);
CREATE INDEX IF NOT EXISTS ad_studio_inquiries_owner_updated ON ad_studio_inquiries(owner_id,updated_at DESC);
-- Application owner must execute deletion requests (manual before automated routine exists).
-- Suggested 180-day policy for unqualified submissions; confirm with a legal adviser.
-- Do not grant external MCP gateway or unrelated clients access to this table.

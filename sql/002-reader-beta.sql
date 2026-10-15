-- Additive reader tables, exclusively for the isolated beta database.
CREATE TABLE IF NOT EXISTS ad_reader_documents (
 owner_id text NOT NULL, reference_id uuid NOT NULL, version text NOT NULL,
 document jsonb NOT NULL, is_current boolean NOT NULL DEFAULT false,
 PRIMARY KEY(owner_id,reference_id,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS ad_reader_current ON ad_reader_documents(owner_id,reference_id) WHERE is_current;
CREATE TABLE IF NOT EXISTS ad_reader_heads (
 owner_id text NOT NULL, reference_id uuid NOT NULL, version text NOT NULL,
 PRIMARY KEY(owner_id,reference_id)
);
CREATE TABLE IF NOT EXISTS ad_reader_annotations (
 owner_id text NOT NULL, reference_id uuid NOT NULL, id uuid NOT NULL,
 annotation jsonb NOT NULL, revision integer NOT NULL,
 PRIMARY KEY(owner_id,id)
);
CREATE INDEX IF NOT EXISTS ad_reader_annotations_reference ON ad_reader_annotations(owner_id,reference_id);

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY,
  organization_id text NOT NULL,
  owner_id text NOT NULL,
  blob_path text NOT NULL,
  blob_url text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  bytes integer NOT NULL,
  duration_ms_from_client integer NOT NULL,
  etag text NOT NULL,
  metadata jsonb NOT NULL,
  options jsonb NOT NULL,
  status text NOT NULL,
  stage text NOT NULL,
  stage_index integer NOT NULL,
  stage_count integer NOT NULL,
  run_id text,
  transcript_version integer NOT NULL DEFAULT 0,
  draft_version integer NOT NULL DEFAULT 0,
  error jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS transcript_versions (
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  version integer NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (job_id, version)
);
CREATE TABLE IF NOT EXISTS draft_versions (
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  version integer NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (job_id, version)
);
CREATE TABLE IF NOT EXISTS cms_deliveries (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  draft_version integer NOT NULL,
  idempotency_key uuid NOT NULL UNIQUE,
  receipt_id text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY,
  job_hash text NOT NULL,
  event text NOT NULL,
  success boolean NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_org_id_idx ON jobs (organization_id, id);
CREATE INDEX IF NOT EXISTS jobs_expiry_idx ON jobs (expires_at, status);

-- Additive migration. Existing private_reserved rows stay unreadable to askers
-- until the owner confirms again: confirmed_content is not backfilled, and
-- seen_at stays empty so nothing is marked delivered or read.

ALTER TABLE questions ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE questions ADD COLUMN public_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE questions ADD COLUMN view_token_hash TEXT;

CREATE UNIQUE INDEX questions_view_token_hash
  ON questions (view_token_hash)
  WHERE view_token_hash IS NOT NULL;

ALTER TABLE answers ADD COLUMN confirmed_content TEXT;
ALTER TABLE answers ADD COLUMN confirmed_at TEXT;
ALTER TABLE answers ADD COLUMN seen_at TEXT;
ALTER TABLE answers ADD COLUMN draft_revision INTEGER NOT NULL DEFAULT 0;

UPDATE answers
SET confirmed_at = sent_at
WHERE delivery_state = 'private_reserved'
  AND sent_at IS NOT NULL
  AND confirmed_at IS NULL;

ALTER TABLE ai_generations ADD COLUMN input_tokens INTEGER;
ALTER TABLE ai_generations ADD COLUMN output_tokens INTEGER;
ALTER TABLE ai_generations ADD COLUMN latency_ms INTEGER;
ALTER TABLE ai_generations ADD COLUMN error_code TEXT;

CREATE TABLE ai_inflight (
  question_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  started_at TEXT NOT NULL
);

CREATE INDEX ai_inflight_owner ON ai_inflight (owner_id, started_at);

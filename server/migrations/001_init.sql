-- Ask "Me" MVP schema. SQLite is the local default; PostgreSQL is still an open product choice.
-- delivery_state is the reply state machine:
--   draft             saved text, not confirmed
--   private_reserved  owner confirmed a private reply; nothing is emailed or notified
--   published         owner confirmed a public reply; the public page only shows it when the flag is on

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX users_email_unique ON users (email);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE question_boxes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL UNIQUE REFERENCES users (id),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  anonymous_mode TEXT NOT NULL CHECK (anonymous_mode IN ('allowed', 'disabled')),
  default_reply_visibility TEXT NOT NULL CHECK (default_reply_visibility IN ('private', 'public')),
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  reply_tone TEXT NOT NULL CHECK (reply_tone IN ('warm', 'direct', 'playful', 'professional')),
  reply_length TEXT NOT NULL CHECK (reply_length IN ('short', 'medium', 'long')),
  reply_language TEXT NOT NULL CHECK (reply_language IN ('auto', 'zh', 'en')),
  reply_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  box_id TEXT NOT NULL REFERENCES question_boxes (id),
  content TEXT NOT NULL,
  asker_display_name TEXT,
  is_anonymous INTEGER NOT NULL CHECK (is_anonymous IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN (
    'submitted', 'reviewing', 'drafted', 'answered_private', 'published',
    'archived', 'spam', 'flagged', 'deleted'
  )),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('none', 'review')),
  submitted_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX questions_box_status ON questions (box_id, status);
CREATE INDEX questions_box_submitted ON questions (box_id, submitted_at);

CREATE TABLE question_idempotency (
  box_id TEXT NOT NULL REFERENCES question_boxes (id),
  idempotency_key TEXT NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions (id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (box_id, idempotency_key)
);

-- Anti-abuse lookup only. Stores hashes, not raw IPs, emails, or a second copy of the question.
CREATE TABLE submission_guards (
  id TEXT PRIMARY KEY,
  box_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  question_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX submission_guards_lookup
  ON submission_guards (box_id, content_hash, ip_hash, created_at);

CREATE TABLE answers (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL UNIQUE REFERENCES questions (id),
  content TEXT NOT NULL,
  published_content TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')),
  source TEXT NOT NULL CHECK (source IN ('human', 'ai_assisted')),
  delivery_state TEXT NOT NULL CHECK (delivery_state IN ('draft', 'private_reserved', 'published')),
  updated_at TEXT NOT NULL,
  published_at TEXT,
  sent_at TEXT
);

CREATE TABLE ai_generations (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions (id),
  owner_id TEXT NOT NULL REFERENCES users (id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  output TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
  created_at TEXT NOT NULL
);

CREATE INDEX ai_generations_question ON ai_generations (question_id, created_at);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX audit_logs_created ON audit_logs (created_at);

CREATE TABLE rate_hits (
  scope TEXT NOT NULL,
  at_ms INTEGER NOT NULL
);

CREATE INDEX rate_hits_scope ON rate_hits (scope, at_ms);

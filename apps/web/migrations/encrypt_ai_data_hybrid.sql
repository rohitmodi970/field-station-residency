-- ============================================================
-- Migration: Hybrid Asymmetric + Symmetric AI Data Encryption
-- FORCE Security Architecture v2 — Phase 3 (AI Tables)
-- ============================================================
--
-- Strategy:
--   • Each table gets *_encrypted TEXT and *_iv TEXT columns per
--     sensitive field, plus is_encrypted BOOLEAN DEFAULT false.
--   • The *_encrypted column stores EITHER:
--       v1 — direct AES-256-GCM base64 ciphertext (client-side writes)
--       v2 — a packed JSON ECIES envelope (server-side writes):
--            { v:2, epk, wk, wiv, ct }
--   • The *_iv column always stores the AES data IV (base64, 12 bytes).
--   • Original plaintext columns are KEPT during the transition window
--     so that old rows continue to be readable via the plaintext path.
--     They will be dropped in a follow-up migration after backfill.
--   • journal_embeddings.embedding (VECTOR) is intentionally excluded
--     from encryption to preserve pgvector similarity search.
--
-- Run order: this file is idempotent (all statements use IF NOT EXISTS
-- or ADD COLUMN IF NOT EXISTS equivalents).
-- ============================================================

-- ------------------------------------------------------------
-- 1. users table — ECDH P-256 key pair columns
-- ------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS encryption_public_key    TEXT,   -- ECDH P-256 public key (JWK, base64 — safe to store plain)
  ADD COLUMN IF NOT EXISTS encrypted_private_key    TEXT,   -- Private key encrypted with master key (AES-256-GCM, base64)
  ADD COLUMN IF NOT EXISTS private_key_iv           TEXT;   -- IV for private key encryption (base64, 12 bytes)

COMMENT ON COLUMN users.encryption_public_key  IS 'ECDH P-256 public key in JWK format, base64-encoded. Safe to store in plaintext — used by the server to encrypt AI output for this user.';
COMMENT ON COLUMN users.encrypted_private_key  IS 'ECDH P-256 private key, AES-256-GCM encrypted with the user''s master key. Only the client can decrypt this.';
COMMENT ON COLUMN users.private_key_iv         IS 'AES-256-GCM IV (12 bytes, base64) for encrypted_private_key.';

-- ------------------------------------------------------------
-- 2. audio_analysis_history
--    Sensitive fields: summary, results
-- ------------------------------------------------------------

ALTER TABLE audio_analysis_history
  ALTER COLUMN results DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS summary_encrypted   TEXT,           -- AES-256-GCM or ECIES envelope (base64)
  ADD COLUMN IF NOT EXISTS summary_iv          TEXT,           -- AES data IV (base64)
  ADD COLUMN IF NOT EXISTS results_encrypted   TEXT,           -- AES-256-GCM or ECIES envelope (base64)
  ADD COLUMN IF NOT EXISTS results_iv          TEXT,           -- AES data IV (base64)
  ADD COLUMN IF NOT EXISTS is_encrypted        BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN audio_analysis_history.summary_encrypted IS 'Encrypted summary text. v1=direct AES; v2=ECIES JSON envelope {v,epk,wk,wiv,ct}.';
COMMENT ON COLUMN audio_analysis_history.results_encrypted IS 'Encrypted results JSON. v1=direct AES; v2=ECIES JSON envelope.';
COMMENT ON COLUMN audio_analysis_history.is_encrypted      IS 'True when *_encrypted columns hold ciphertext; false when legacy plaintext columns are the source of truth.';

-- Index to quickly find unencrypted rows during backfill
CREATE INDEX IF NOT EXISTS idx_audio_analysis_history_not_encrypted
  ON audio_analysis_history (user_id)
  WHERE is_encrypted = false;

-- ------------------------------------------------------------
-- 3. ai_prompt_cache
--    Sensitive fields: response (JSONB — serialized to text before encryption)
-- ------------------------------------------------------------

ALTER TABLE ai_prompt_cache
  ALTER COLUMN response DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS response_encrypted  TEXT,           -- AES-256-GCM or ECIES envelope
  ADD COLUMN IF NOT EXISTS response_iv         TEXT,           -- AES data IV (base64)
  ADD COLUMN IF NOT EXISTS is_encrypted        BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ai_prompt_cache.response_encrypted IS 'Encrypted response JSON (serialized from JSONB). v1=direct AES; v2=ECIES JSON envelope.';
COMMENT ON COLUMN ai_prompt_cache.is_encrypted       IS 'True when response_encrypted is the source of truth.';

-- Index to quickly find unencrypted rows during backfill
CREATE INDEX IF NOT EXISTS idx_ai_prompt_cache_not_encrypted
  ON ai_prompt_cache (user_id)
  WHERE is_encrypted = false;

-- ------------------------------------------------------------
-- 4. ai_todos
--    Sensitive fields: title, description, ai_reasoning,
--                      category, calendar_event_title
-- ------------------------------------------------------------

ALTER TABLE ai_todos
  ALTER COLUMN title DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS title_encrypted               TEXT,   -- AES-256-GCM or ECIES envelope
  ADD COLUMN IF NOT EXISTS title_iv                      TEXT,
  ADD COLUMN IF NOT EXISTS description_encrypted         TEXT,   -- AES-256-GCM or ECIES envelope
  ADD COLUMN IF NOT EXISTS description_iv                TEXT,
  ADD COLUMN IF NOT EXISTS ai_reasoning_encrypted        TEXT,   -- AES-256-GCM or ECIES envelope
  ADD COLUMN IF NOT EXISTS ai_reasoning_iv               TEXT,
  ADD COLUMN IF NOT EXISTS category_encrypted            TEXT,   -- AES-256-GCM or ECIES envelope
  ADD COLUMN IF NOT EXISTS category_iv                   TEXT,
  ADD COLUMN IF NOT EXISTS calendar_event_title_encrypted TEXT,  -- AES-256-GCM or ECIES envelope
  ADD COLUMN IF NOT EXISTS calendar_event_title_iv        TEXT,
  ADD COLUMN IF NOT EXISTS is_encrypted                  BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ai_todos.is_encrypted IS 'True when *_encrypted columns are the source of truth for sensitive fields.';

CREATE INDEX IF NOT EXISTS idx_ai_todos_not_encrypted
  ON ai_todos (user_id)
  WHERE is_encrypted = false;

-- ------------------------------------------------------------
-- 5. cognition_responses
--    Sensitive fields: insight_core, insight_tension, entry_text,
--                      question_responses (JSONB), analysis_snapshot (JSONB),
--                      generated_tasks (JSONB), output_state (JSONB)
-- ------------------------------------------------------------

ALTER TABLE cognition_responses
  ADD COLUMN IF NOT EXISTS insight_core_encrypted          TEXT,
  ADD COLUMN IF NOT EXISTS insight_core_iv                 TEXT,
  ADD COLUMN IF NOT EXISTS insight_tension_encrypted       TEXT,
  ADD COLUMN IF NOT EXISTS insight_tension_iv              TEXT,
  ADD COLUMN IF NOT EXISTS entry_text_encrypted            TEXT,
  ADD COLUMN IF NOT EXISTS entry_text_iv                   TEXT,
  ADD COLUMN IF NOT EXISTS question_responses_encrypted    TEXT,  -- Serialized JSONB, then encrypted
  ADD COLUMN IF NOT EXISTS question_responses_iv           TEXT,
  ADD COLUMN IF NOT EXISTS analysis_snapshot_encrypted     TEXT,  -- Serialized JSONB, then encrypted
  ADD COLUMN IF NOT EXISTS analysis_snapshot_iv            TEXT,
  ADD COLUMN IF NOT EXISTS generated_tasks_encrypted       TEXT,  -- Serialized JSONB, then encrypted
  ADD COLUMN IF NOT EXISTS generated_tasks_iv              TEXT,
  ADD COLUMN IF NOT EXISTS output_state_encrypted          TEXT,  -- Serialized JSONB, then encrypted
  ADD COLUMN IF NOT EXISTS output_state_iv                 TEXT,
  ADD COLUMN IF NOT EXISTS is_encrypted                    BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN cognition_responses.is_encrypted IS 'True when *_encrypted columns are the source of truth.';

CREATE INDEX IF NOT EXISTS idx_cognition_responses_not_encrypted
  ON cognition_responses (user_id)
  WHERE is_encrypted = false;

-- ------------------------------------------------------------
-- 6. journal_embeddings
--    Sensitive fields: keyword, category
--    NOTE: embedding VECTOR(768) is intentionally NOT encrypted
--    to preserve pgvector cosine similarity search capability.
-- ------------------------------------------------------------

ALTER TABLE journal_embeddings
  ADD COLUMN IF NOT EXISTS keyword_encrypted   TEXT,
  ADD COLUMN IF NOT EXISTS keyword_iv          TEXT,
  ADD COLUMN IF NOT EXISTS category_encrypted  TEXT,
  ADD COLUMN IF NOT EXISTS category_iv         TEXT,
  ADD COLUMN IF NOT EXISTS is_encrypted        BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN journal_embeddings.keyword_encrypted   IS 'Encrypted keyword text. v1=direct AES; v2=ECIES JSON envelope.';
COMMENT ON COLUMN journal_embeddings.category_encrypted  IS 'Encrypted category text. v1=direct AES; v2=ECIES JSON envelope.';
COMMENT ON COLUMN journal_embeddings.is_encrypted        IS 'True when *_encrypted columns are the source of truth. embedding VECTOR is never encrypted.';

CREATE INDEX IF NOT EXISTS idx_journal_embeddings_not_encrypted
  ON journal_embeddings (user_id)
  WHERE is_encrypted = false;

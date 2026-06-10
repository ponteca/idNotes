-- Esquema do idNotes backend.
-- RNF005: a idKey nunca é persistida em texto claro — somente o hash bcrypt.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  idkey_hash    TEXT NOT NULL,          -- hash bcrypt da idKey (RNF005)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

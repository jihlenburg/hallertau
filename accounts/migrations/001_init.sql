-- Migration 001: Initial schema for DoldenBlick accounts service.
-- Forward-compatible: includes farm_members for future multi-user, passkey_credentials,
-- geometry as jsonb (no PostGIS), citext for case-insensitive email.

CREATE EXTENSION IF NOT EXISTS citext;

-- ── users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email              citext      NOT NULL UNIQUE,
  email_verified_at  timestamptz,
  name               text,
  last_login_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ── farms ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS farms (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  betriebsnummer  text,
  name            text        NOT NULL,
  anbaugebiet     text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── farm_members (forward-compat multi-user) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS farm_members (
  farm_id    uuid        NOT NULL REFERENCES farms  (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users  (id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('owner', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (farm_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_farm_members_farm_id ON farm_members (farm_id);
CREATE INDEX IF NOT EXISTS idx_farm_members_user_id ON farm_members (user_id);

-- ── passkey_credentials ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS passkey_credentials (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  credential_id  text        NOT NULL UNIQUE,
  public_key     bytea       NOT NULL,
  counter        bigint      NOT NULL DEFAULT 0,
  transports     text[],
  device_name    text,
  last_used_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user_id ON passkey_credentials (user_id);

-- ── magic_link_tokens ─────────────────────────────────────────────────────────
-- Only the SHA-256 hash is stored (never the raw token).
-- Single-use enforced via used_at; TTL enforced by expires_at.
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES users (id) ON DELETE CASCADE,
  email       citext      NOT NULL,
  token_hash  text        NOT NULL UNIQUE,
  purpose     text        NOT NULL DEFAULT 'login',
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_token_hash ON magic_link_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_email      ON magic_link_tokens (email);

-- ── sessions ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  user_agent  text,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

-- ── schlaege (Felder) ─────────────────────────────────────────────────────────
-- Geometry stored as GeoJSON jsonb (no PostGIS; point-in-polygon done in JS).
CREATE TABLE IF NOT EXISTS schlaege (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id     uuid        NOT NULL REFERENCES farms (id) ON DELETE CASCADE,
  name        text        NOT NULL,
  flik        text,
  geometry    jsonb,
  kultur      text,
  sorte       text,
  source      text        NOT NULL CHECK (source IN ('draw', 'ibalis')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schlaege_farm_id ON schlaege (farm_id);

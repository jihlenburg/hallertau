-- Migration 002: WebAuthn challenge column for passkey registration.
--
-- Stores the pending registration (and future authentication) challenge server-side,
-- tied to the user row.  NULL = no challenge pending.
-- A separate table would be cleaner at scale but adds a join; for the single-user-at-a-
-- time passkey flow this column is the simplest correct solution.

ALTER TABLE users ADD COLUMN IF NOT EXISTS current_webauthn_challenge text;

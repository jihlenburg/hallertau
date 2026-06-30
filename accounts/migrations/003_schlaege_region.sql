-- Migration 003: Add in_region + region to schlaege.
-- Soft sanity flag set at import time via isInHopRegion (point-in-polygon, JS).
-- Never used to reject a field — pure advisory metadata.
-- in_region: true  → centroid fell inside a German hop Anbaugebiet.
-- region   : name of the matched Anbaugebiet, or NULL when in_region = false.

ALTER TABLE schlaege
  ADD COLUMN IF NOT EXISTS in_region boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS region    text;

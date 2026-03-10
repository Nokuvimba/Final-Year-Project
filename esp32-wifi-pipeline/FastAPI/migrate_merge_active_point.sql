-- ============================================================
-- Migration 4: Merge active_point into scan_point

-- WHAT THIS DOES:
-- Moves assigned_node + assigned_at directly onto scan_point.
--   active_point table is then dropped.
--
-- WHAT IS NOT TOUCHED:
--   wifi_scan      — unchanged, scan_point_id FK stays valid
--   scan_point.id  — unchanged, no rows are deleted
--   All other tables — unchanged
--

BEGIN;

-- Add the two new columns to scan_point
ALTER TABLE scan_point
  ADD COLUMN IF NOT EXISTS assigned_node TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at   TIMESTAMPTZ;

--  Enforce one device per point (a physical device is in one place)
ALTER TABLE scan_point
  ADD CONSTRAINT scan_point_assigned_node_unique UNIQUE (assigned_node);

-- Copy existing assignments across from active_point
UPDATE scan_point sp
SET
  assigned_node = ap.node,
  assigned_at   = ap.assigned_at
FROM active_point ap
WHERE ap.scan_point_id = sp.id;

--  Drop active_point — no longer needed
DROP TABLE IF EXISTS active_point;

COMMIT;

-- ── Final scan_point shape ─────────────────────────────────────────────────
--
--   id            SERIAL PK
--   floorplan_id  INTEGER FK → floor_plan(id)
--   x             FLOAT  (0.0–1.0 normalised, fraction of image width)
--   y             FLOAT  (0.0–1.0 normalised, fraction of image height)
--   label         TEXT nullable
--   assigned_node TEXT nullable UNIQUE   ← was active_point.node
--   assigned_at   TIMESTAMPTZ nullable   ← was active_point.assigned_at
--   created_at    TIMESTAMPTZ
--
-- For future sensor tables (temperature, humidity, air_quality) l will just add:
--   scan_point_id INTEGER FK → scan_point(id)
-- No further changes to this table required.
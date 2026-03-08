-- ============================================================
-- MIGRATION: Coordinate-based scanning
-- Replace active_room + wifi_scan.room_id  with
--            active_point + scan_point + wifi_scan.scan_point_id
-- ============================================================
-- Room table is KEPT for admin organisational use.
-- ============================================================


-- Step 1: Create scan_point table
-- Each row is a physical coordinate on a floor plan where an ESP32 sits.
-- label is display-only — it has NO foreign key to the room table.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_point (
    id           SERIAL PRIMARY KEY,
    floorplan_id INTEGER NOT NULL REFERENCES floor_plan(id) ON DELETE CASCADE,
    x            FLOAT   NOT NULL CHECK (x >= 0 AND x <= 1),
    y            FLOAT   NOT NULL CHECK (y >= 0 AND y <= 1),
    label        TEXT,                          -- e.g. "Near window", "Lab bench 3" (optional)
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_point_floorplan ON scan_point(floorplan_id);


-- Step 2: Create active_point table  (replaces active_room)
-- One row per ESP32 node. Points to which scan_point it is currently at.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS active_point (
    node            TEXT PRIMARY KEY,
    scan_point_id   INTEGER REFERENCES scan_point(id) ON DELETE SET NULL,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Step 3: Add scan_point_id column to wifi_scan
-- This is the new FK stamped at ingest time.
-- room_id stays on the table but is no longer written at ingest.
-- ----------------------------------------------------------------
ALTER TABLE wifi_scan
    ADD COLUMN IF NOT EXISTS scan_point_id INTEGER REFERENCES scan_point(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wifi_scan_scan_point ON wifi_scan(scan_point_id);


-- Step 4: Migrate existing active_room rows → active_point
-- We can't auto-map room coords to scan_points (they don't exist yet),
-- so we copy nodes over as unassigned — admin will place points manually.
-- ----------------------------------------------------------------
INSERT INTO active_point (node, scan_point_id, assigned_at)
SELECT node, NULL, assigned_at
FROM active_room
ON CONFLICT (node) DO NOTHING;


-- Step 5: Drop active_room (replaced by active_point)
-- wifi_scan.room_id column is KEPT — it remains useful for organisational
-- display (e.g. "which room does this scan_point belong to visually?")
-- but it is no longer written at ingest time.
-- ----------------------------------------------------------------
DROP TABLE IF EXISTS active_room CASCADE;


-- Done! New schema:
--
--   building
--     └── floor_plan
--           └── scan_point (id, floorplan_id, x, y, label)  ← admin places on image
--                 └── wifi_scan.scan_point_id               ← stamped at ingest
--
--   active_point (node PK → scan_point_id)  ← device registry
--
--   room table stays for admin organisation only, no scan data connection
-- ============================================================
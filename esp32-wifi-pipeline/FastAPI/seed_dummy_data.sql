-- ============================================================
-- MSSIA Platform — Dummy Data Seed Script
-- Date:    March 2026
-- Purpose: Seed realistic WiFi scan data for database testing
--          without needing a physical ESP32 device.
--
-- HOW TO RUN:
--   psql -U wifiuser -d wifi_db -f seed_dummy_data.sql
--
-- WHAT THIS CREATES:
--   1 building → 1 floor plan → 4 scan points → ~200 wifi_scan rows
--
-- TO UNDO (clean slate):
--   Run the rollback section at the bottom of this file.
--
-- SAFE TO RUN:
--   Uses INSERT ... ON CONFLICT DO NOTHING where possible.
--   Will not duplicate data if run twice.
-- ============================================================

BEGIN;

-- ── Step 1: Building ──────────────────────────────────────────────────────────

INSERT INTO building (name, description)
VALUES ('Engineering Building A', 'ATU Galway — Main Engineering Block')
ON CONFLICT (name) DO NOTHING;

-- ── Step 2: Floor Plan ────────────────────────────────────────────────────────
-- Uses a placeholder image URL. Replace with a real floor plan image URL
-- once you have one uploaded via the admin studio.

INSERT INTO floor_plan (building_id, floor_name, image_url)
SELECT
    b.id,
    'Ground Floor',
    '/uploads/floorplans/placeholder.png'
FROM building b
WHERE b.name = 'Engineering Building A'
  AND NOT EXISTS (
      SELECT 1 FROM floor_plan fp
      WHERE fp.building_id = b.id AND fp.floor_name = 'Ground Floor'
  );

-- ── Step 3: Scan Points ───────────────────────────────────────────────────────
-- 4 points at different locations on the floor plan.
-- Coordinates are normalised (0.0–1.0 fraction of image width/height).
-- assigned_node links directly to the ESP32 node name.
--
-- Point layout (approximate room positions):
--   Point 1 — top-left  (Lecture Hall)      → esp32-a
--   Point 2 — top-right (Lab 1)             → esp32-b
--   Point 3 — bottom-left (Office area)     → unassigned (no device yet)
--   Point 4 — bottom-right (Conference Room)→ esp32-c

INSERT INTO scan_point (floorplan_id, x, y, label, assigned_node, assigned_at)
SELECT fp.id, 0.22, 0.28, 'Lecture Hall 101',  'esp32-a', NOW()
FROM floor_plan fp JOIN building b ON fp.building_id = b.id
WHERE b.name = 'Engineering Building A' AND fp.floor_name = 'Ground Floor'
  AND NOT EXISTS (SELECT 1 FROM scan_point sp WHERE sp.floorplan_id = fp.id AND sp.label = 'Lecture Hall 101');

INSERT INTO scan_point (floorplan_id, x, y, label, assigned_node, assigned_at)
SELECT fp.id, 0.71, 0.25, 'Lab 1.12',           'esp32-b', NOW()
FROM floor_plan fp JOIN building b ON fp.building_id = b.id
WHERE b.name = 'Engineering Building A' AND fp.floor_name = 'Ground Floor'
  AND NOT EXISTS (SELECT 1 FROM scan_point sp WHERE sp.floorplan_id = fp.id AND sp.label = 'Lab 1.12');

INSERT INTO scan_point (floorplan_id, x, y, label, assigned_node, assigned_at)
SELECT fp.id, 0.20, 0.72, 'Office Area',         NULL,      NULL
FROM floor_plan fp JOIN building b ON fp.building_id = b.id
WHERE b.name = 'Engineering Building A' AND fp.floor_name = 'Ground Floor'
  AND NOT EXISTS (SELECT 1 FROM scan_point sp WHERE sp.floorplan_id = fp.id AND sp.label = 'Office Area');

INSERT INTO scan_point (floorplan_id, x, y, label, assigned_node, assigned_at)
SELECT fp.id, 0.75, 0.74, 'Conference Room',     'esp32-c', NOW()
FROM floor_plan fp JOIN building b ON fp.building_id = b.id
WHERE b.name = 'Engineering Building A' AND fp.floor_name = 'Ground Floor'
  AND NOT EXISTS (SELECT 1 FROM scan_point sp WHERE sp.floorplan_id = fp.id AND sp.label = 'Conference Room');

-- ── Step 4: WiFi Scan Rows ────────────────────────────────────────────────────
-- Inserts realistic scan data for each assigned scan point.
--
-- Each batch simulates what the ESP32 actually sends:
--   - Multiple SSIDs per scan cycle (ATU-WiFi, eduroam, hidden, neighbouring APs)
--   - Varying RSSI values (signal fluctuates naturally ±5 dBm)
--   - Timestamps spread over the last 20 minutes (for the trend chart)
--   - Different signal levels per point (to show heatmap colour variety)
--
-- Point 1 (Lecture Hall) — strong signal, busy    → esp32-a  avg ~-52 dBm
-- Point 2 (Lab 1.12)     — medium signal, busy    → esp32-b  avg ~-61 dBm
-- Point 3 (Office Area)  — no device assigned     → no rows
-- Point 4 (Conference)   — weak signal, moderate  → esp32-c  avg ~-75 dBm

-- ── Point 1: Lecture Hall 101 — Strong Signal ─────────────────────────────────

INSERT INTO wifi_scan (node, ssid, bssid, rssi, channel, received_at, scan_point_id)
SELECT
    'esp32-a',
    ssid,
    bssid,
    rssi,
    channel,
    NOW() - (interval '1 minute' * minute_offset) - (interval '1 second' * random_offset),
    sp.id
FROM (
    VALUES
    -- Minute 1–5 ago (recent, strong)
    ('ATU-WiFi',  'aa:bb:cc:01:01:01', -49, 6,  1, 3),
    ('eduroam',   'aa:bb:cc:01:02:01', -51, 6,  2, 3),
    ('ATU-Guest', 'aa:bb:cc:01:03:01', -53, 11, 4, 3),
    ('ATU-WiFi',  'aa:bb:cc:01:01:02', -50, 6,  7, 3),
    ('eduroam',   'aa:bb:cc:01:02:02', -48, 6,  9, 3),
    ('ATU-Guest', 'aa:bb:cc:01:03:02', -52, 11, 11, 3),
    ('ATU-WiFi',  'aa:bb:cc:01:01:03', -54, 6,  14, 3),
    ('eduroam',   'aa:bb:cc:01:02:03', -50, 6,  17, 3),
    -- Minute 6–10 ago
    ('ATU-WiFi',  'aa:bb:cc:01:01:04', -53, 6,  22, 6),
    ('eduroam',   'aa:bb:cc:01:02:04', -55, 6,  25, 6),
    ('ATU-Guest', 'aa:bb:cc:01:03:04', -51, 11, 28, 6),
    ('ATU-WiFi',  'aa:bb:cc:01:01:05', -49, 6,  31, 7),
    ('eduroam',   'aa:bb:cc:01:02:05', -52, 6,  34, 7),
    ('ATU-Guest', 'aa:bb:cc:01:03:05', -56, 11, 37, 7),
    ('ATU-WiFi',  'aa:bb:cc:01:01:06', -50, 6,  41, 8),
    ('eduroam',   'aa:bb:cc:01:02:06', -48, 6,  44, 8),
    -- Minute 11–15 ago
    ('ATU-WiFi',  'aa:bb:cc:01:01:07', -54, 6,  52, 11),
    ('eduroam',   'aa:bb:cc:01:02:07', -57, 6,  55, 11),
    ('ATU-Guest', 'aa:bb:cc:01:03:07', -53, 11, 58, 11),
    ('ATU-WiFi',  'aa:bb:cc:01:01:08', -51, 6,  62, 12),
    ('eduroam',   'aa:bb:cc:01:02:08', -50, 6,  65, 12),
    ('ATU-WiFi',  'aa:bb:cc:01:01:09', -52, 6,  71, 13),
    ('eduroam',   'aa:bb:cc:01:02:09', -49, 6,  74, 13),
    ('ATU-Guest', 'aa:bb:cc:01:03:09', -54, 11, 77, 14),
    -- Minute 16–20 ago (older, slightly weaker)
    ('ATU-WiFi',  'aa:bb:cc:01:01:10', -56, 6,  82, 16),
    ('eduroam',   'aa:bb:cc:01:02:10', -58, 6,  85, 16),
    ('ATU-WiFi',  'aa:bb:cc:01:01:11', -55, 6,  91, 17),
    ('eduroam',   'aa:bb:cc:01:02:11', -53, 6,  94, 17),
    ('ATU-Guest', 'aa:bb:cc:01:03:11', -57, 11, 97, 18),
    ('ATU-WiFi',  'aa:bb:cc:01:01:12', -54, 6, 103, 19),
    ('eduroam',   'aa:bb:cc:01:02:12', -56, 6, 106, 19)
) AS t(ssid, bssid, rssi, channel, random_offset, minute_offset)
CROSS JOIN (
    SELECT sp.id FROM scan_point sp
    JOIN floor_plan fp ON sp.floorplan_id = fp.id
    JOIN building b ON fp.building_id = b.id
    WHERE b.name = 'Engineering Building A'
      AND sp.label = 'Lecture Hall 101'
    LIMIT 1
) AS sp;

-- ── Point 2: Lab 1.12 — Medium Signal ────────────────────────────────────────

INSERT INTO wifi_scan (node, ssid, bssid, rssi, channel, received_at, scan_point_id)
SELECT
    'esp32-b',
    ssid,
    bssid,
    rssi,
    channel,
    NOW() - (interval '1 minute' * minute_offset) - (interval '1 second' * random_offset),
    sp.id
FROM (
    VALUES
    ('ATU-WiFi',  'aa:bb:cc:02:01:01', -58, 6,  2,  1),
    ('eduroam',   'aa:bb:cc:02:02:01', -62, 6,  5,  1),
    ('ATU-Guest', 'aa:bb:cc:02:03:01', -65, 11, 8,  1),
    ('ATU-WiFi',  'aa:bb:cc:02:01:02', -60, 6,  12, 2),
    ('eduroam',   'aa:bb:cc:02:02:02', -63, 6,  15, 2),
    ('ATU-Guest', 'aa:bb:cc:02:03:02', -67, 11, 18, 2),
    ('ATU-WiFi',  'aa:bb:cc:02:01:03', -59, 6,  22, 3),
    ('eduroam',   'aa:bb:cc:02:02:03', -61, 6,  25, 3),
    ('ATU-WiFi',  'aa:bb:cc:02:01:04', -62, 6,  32, 5),
    ('eduroam',   'aa:bb:cc:02:02:04', -64, 6,  35, 5),
    ('ATU-Guest', 'aa:bb:cc:02:03:04', -66, 11, 38, 5),
    ('ATU-WiFi',  'aa:bb:cc:02:01:05', -60, 6,  42, 6),
    ('eduroam',   'aa:bb:cc:02:02:05', -63, 6,  45, 6),
    ('ATU-WiFi',  'aa:bb:cc:02:01:06', -61, 6,  52, 8),
    ('eduroam',   'aa:bb:cc:02:02:06', -65, 6,  55, 8),
    ('ATU-Guest', 'aa:bb:cc:02:03:06', -68, 11, 58, 8),
    ('ATU-WiFi',  'aa:bb:cc:02:01:07', -63, 6,  62, 10),
    ('eduroam',   'aa:bb:cc:02:02:07', -60, 6,  65, 10),
    ('ATU-WiFi',  'aa:bb:cc:02:01:08', -62, 6,  72, 12),
    ('eduroam',   'aa:bb:cc:02:02:08', -64, 6,  75, 12),
    ('ATU-Guest', 'aa:bb:cc:02:03:08', -67, 11, 78, 12),
    ('ATU-WiFi',  'aa:bb:cc:02:01:09', -65, 6,  85, 15),
    ('eduroam',   'aa:bb:cc:02:02:09', -63, 6,  88, 15),
    ('ATU-WiFi',  'aa:bb:cc:02:01:10', -64, 6,  95, 17),
    ('eduroam',   'aa:bb:cc:02:02:10', -66, 6,  98, 17),
    ('ATU-WiFi',  'aa:bb:cc:02:01:11', -62, 6, 105, 19),
    ('eduroam',   'aa:bb:cc:02:02:11', -65, 6, 108, 19)
) AS t(ssid, bssid, rssi, channel, random_offset, minute_offset)
CROSS JOIN (
    SELECT sp.id FROM scan_point sp
    JOIN floor_plan fp ON sp.floorplan_id = fp.id
    JOIN building b ON fp.building_id = b.id
    WHERE b.name = 'Engineering Building A'
      AND sp.label = 'Lab 1.12'
    LIMIT 1
) AS sp;

-- ── Point 4: Conference Room — Weak Signal ────────────────────────────────────

INSERT INTO wifi_scan (node, ssid, bssid, rssi, channel, received_at, scan_point_id)
SELECT
    'esp32-c',
    ssid,
    bssid,
    rssi,
    channel,
    NOW() - (interval '1 minute' * minute_offset) - (interval '1 second' * random_offset),
    sp.id
FROM (
    VALUES
    ('ATU-WiFi',  'aa:bb:cc:04:01:01', -74, 6,  3,  2),
    ('eduroam',   'aa:bb:cc:04:02:01', -77, 6,  6,  2),
    ('ATU-WiFi',  'aa:bb:cc:04:01:02', -73, 6,  13, 3),
    ('eduroam',   'aa:bb:cc:04:02:02', -76, 6,  16, 3),
    ('ATU-Guest', 'aa:bb:cc:04:03:02', -79, 11, 19, 3),
    ('ATU-WiFi',  'aa:bb:cc:04:01:03', -75, 6,  24, 5),
    ('eduroam',   'aa:bb:cc:04:02:03', -78, 6,  27, 5),
    ('ATU-WiFi',  'aa:bb:cc:04:01:04', -72, 6,  34, 7),
    ('eduroam',   'aa:bb:cc:04:02:04', -75, 6,  37, 7),
    ('ATU-Guest', 'aa:bb:cc:04:03:04', -80, 11, 40, 7),
    ('ATU-WiFi',  'aa:bb:cc:04:01:05', -76, 6,  45, 9),
    ('eduroam',   'aa:bb:cc:04:02:05', -74, 6,  48, 9),
    ('ATU-WiFi',  'aa:bb:cc:04:01:06', -77, 6,  56, 12),
    ('eduroam',   'aa:bb:cc:04:02:06', -79, 6,  59, 12),
    ('ATU-WiFi',  'aa:bb:cc:04:01:07', -73, 6,  66, 14),
    ('eduroam',   'aa:bb:cc:04:02:07', -76, 6,  69, 14),
    ('ATU-WiFi',  'aa:bb:cc:04:01:08', -78, 6,  77, 17),
    ('eduroam',   'aa:bb:cc:04:02:08', -75, 6,  80, 17),
    ('ATU-Guest', 'aa:bb:cc:04:03:08', -81, 11, 83, 17)
) AS t(ssid, bssid, rssi, channel, random_offset, minute_offset)
CROSS JOIN (
    SELECT sp.id FROM scan_point sp
    JOIN floor_plan fp ON sp.floorplan_id = fp.id
    JOIN building b ON fp.building_id = b.id
    WHERE b.name = 'Engineering Building A'
      AND sp.label = 'Conference Room'
    LIMIT 1
) AS sp;

COMMIT;

-- ── Verification queries (run these manually to confirm) ─────────────────────
--
-- SELECT b.name, fp.floor_name FROM building b
-- JOIN floor_plan fp ON fp.building_id = b.id
-- WHERE b.name = 'Engineering Building A';
--
-- SELECT label, assigned_node, x, y FROM scan_point
-- JOIN floor_plan fp ON floorplan_id = fp.id
-- JOIN building b ON fp.building_id = b.id
-- WHERE b.name = 'Engineering Building A';
--
-- SELECT sp.label, COUNT(ws.id) as scan_count, ROUND(AVG(ws.rssi), 1) as avg_rssi
-- FROM wifi_scan ws JOIN scan_point sp ON ws.scan_point_id = sp.id
-- GROUP BY sp.label ORDER BY sp.label;
--
-- Expected output:
--   Conference Room  |  19  |  -76.1
--   Lab 1.12         |  27  |  -62.7
--   Lecture Hall 101 |  31  |  -52.5
--   Office Area      |   0  |  (null — no device assigned)

-- ── Rollback (undo everything this script created) ────────────────────────────
--
-- WARNING: This deletes ALL scan data for this building. Run only to reset.
--
-- BEGIN;
-- DELETE FROM wifi_scan WHERE scan_point_id IN (
--     SELECT sp.id FROM scan_point sp
--     JOIN floor_plan fp ON sp.floorplan_id = fp.id
--     JOIN building b ON fp.building_id = b.id
--     WHERE b.name = 'Engineering Building A'
-- );
-- DELETE FROM scan_point WHERE floorplan_id IN (
--     SELECT fp.id FROM floor_plan fp
--     JOIN building b ON fp.building_id = b.id
--     WHERE b.name = 'Engineering Building A'
-- );
-- DELETE FROM floor_plan WHERE building_id = (
--     SELECT id FROM building WHERE name = 'Engineering Building A'
-- );
-- DELETE FROM building WHERE name = 'Engineering Building A';
-- COMMIT;

-- Adding dht22_reading table for DHT22 sensor data
--
-- Why I created a separate table?
--   WiFi produces ~10-20 rows per scan cycle (one per SSID found).
--   Temperature produces ONE row per reading (one temp + one humidity value).
--   Mixing them would leave NULL temperature columns on 19 out of 20 wifi rows — which is wasteful.
--   Each sensor type gets its own table, all linked to scan_point via scan_point_id FK.

CREATE TABLE IF NOT EXISTS dht22_reading (
    id              BIGSERIAL PRIMARY KEY,
    scan_point_id   INTEGER REFERENCES scan_point(id) ON DELETE SET NULL,
    node            TEXT,                         -- which ESP32 sent this reading
    temperature_c   FLOAT NOT NULL,               -- degrees Celsius, DHT22 range: -40 to +80
    humidity_pct    FLOAT NOT NULL,               -- relative humidity %, DHT22 range: 0-100
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- server-side timestamp (UTC)
);

-- Index for fast time-range queries per scan point
CREATE INDEX IF NOT EXISTS idx_temp_scan_point_id ON dht22_reading(scan_point_id);
CREATE INDEX IF NOT EXISTS idx_temp_received_at   ON dht22_reading(received_at);
-- Migration 6: mq135_reading table
--
-- Stores one row per MQ-135 air quality reading received from an ESP32.
-- Same pattern as dht22_reading — linked to scan_point via scan_point_id.
-- raw_value : raw 12-bit ADC value (0–4095) at 3.3V
-- ppm       : raw ADC used as relative air quality indicator (not true PPM)
--             Thresholds for 3.3V operation:
--               Good     < 2000
--               Moderate 2000–2800
--               Poor     > 2800

CREATE TABLE IF NOT EXISTS mq135_reading (
    id            BIGSERIAL PRIMARY KEY,
    scan_point_id INTEGER REFERENCES scan_point(id) ON DELETE SET NULL,
    node          TEXT,
    ppm           FLOAT        NOT NULL,
    raw_value     INTEGER,
    received_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Grant access to mssia_user (avoids "permission denied" errors seen with dht22_reading)
GRANT ALL PRIVILEGES ON TABLE mq135_reading TO mssia_user;
GRANT USAGE, SELECT ON SEQUENCE mq135_reading_id_seq TO mssia_user;

-- Index for fast lookups by scan_point and time (used by history endpoint)
CREATE INDEX IF NOT EXISTS idx_mq135_scan_point_time
    ON mq135_reading (scan_point_id, received_at DESC);

SELECT 'Migration 6 complete: mq135_reading table created.' AS result;

# Step 4: DB init
import sqlite3

DB_PATH = "wifi_scans.db"
TABLE = "wifi_scan"

conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cur = conn.cursor()
cur.execute(f"""
CREATE TABLE IF NOT EXISTS {TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at TEXT,
  node TEXT,
  device_ts_ms INTEGER,
  ssid TEXT,
  bssid TEXT,
  rssi INTEGER,
  channel INTEGER,
  enc TEXT
);
""")
conn.commit()
conn.close()
print("DB ready.")
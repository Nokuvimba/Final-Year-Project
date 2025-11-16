# Step 5: Serial → JSON → SQLite
import json
from datetime import datetime
import serial # pyright: ignore[reportMissingModuleSource]
import sqlite3

PORT = "/dev/cu.usbserial-130"       # ← change to your port, e.g. /dev/cu.SLAB_USBtoUART
BAUD = 115200
DB_PATH = "wifi_scans.db"
TABLE = "wifi_scan"

ser = serial.Serial(PORT, BAUD, timeout=2)
conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cur = conn.cursor()

print(f"Reading {PORT} @ {BAUD}. Ctrl+C to stop.")
try:
    while True:
        raw = ser.readline()
        if not raw:
            continue
        line = raw.decode("utf-8", errors="replace").strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            # ignore any non-JSON banner lines
            continue

        cur.execute(f"""
            INSERT INTO {TABLE} (received_at, node, device_ts_ms, ssid, bssid, rssi, channel, enc)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            datetime.utcnow().isoformat(timespec="seconds"),
            obj.get("node"),
            obj.get("ts"),
            obj.get("ssid"),
            obj.get("bssid"),
            obj.get("rssi"),
            obj.get("channel"),
            obj.get("enc"),
        ))
        conn.commit()
except KeyboardInterrupt:
    print("\nStopping.")
finally:
    try: ser.close()
    except: pass
    conn.close()
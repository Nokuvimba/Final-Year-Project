"""
Reads Wi-Fi scan JSON data from the ESP32 over serial
and inserts each record into a PostgreSQL database.


"""

import json
import serial
import psycopg2
from datetime import datetime, timezone

# Serial and Database setup 
PORT = "/dev/cu.usbserial-130"   
BAUD = 115200                     

DB_CONFIG = {
    "host": "localhost",
    "dbname": "wifi_db",
    "user": "wifiuser",
    "password": "Password",       # Same password I used when creating the DB user
}

TABLE = "wifi_scan"  # use the singular table name


# Connect to Postgres database
try:
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = True
    cur = conn.cursor()
    print("Connected to PostgreSQL.")
except Exception as e:
    print("Couldn’t connect to the database:", e)
    exit()


# Create table if it does not exist
cur.execute(f"""
CREATE TABLE IF NOT EXISTS {TABLE} (
    id BIGSERIAL PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    node TEXT,
    device_ts_ms BIGINT,
    ssid TEXT,
    bssid TEXT,
    rssi INT,
    channel INT,
    enc TEXT
);
""")

# Add a uniqueness rule to avoid duplicate entries
cur.execute(f"""
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wifi_key
ON {TABLE} (device_ts_ms, bssid);
""")


# Connect to the ESP32 serial port 
try:
    ser = serial.Serial(PORT, BAUD, timeout=2)
    print(f"Reading from {PORT} at {BAUD} baud... (Ctrl+C to stop)\n")
except Exception as e:
    print("Serial connection error:", e)
    cur.close()
    conn.close()
    exit()


# Keep reading and saving data 
try:
    while True:
        raw = ser.readline()
        if not raw:
            continue

        try:
            data = json.loads(raw.decode("utf-8", errors="replace").strip())
        except json.JSONDecodeError:
            continue  

        print("", data) 

        # Writing each scan into Postgres
        try:
            cur.execute(f"""
                INSERT INTO {TABLE}
                (received_at, node, device_ts_ms, ssid, bssid, rssi, channel, enc)
                VALUES (NOW(), %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (device_ts_ms, bssid) DO NOTHING
                RETURNING id;
            """, (
                data.get("node"),
                data.get("ts"),        # ESP32 key is 'ts'
                data.get("ssid"),
                data.get("bssid"),
                data.get("rssi"),
                data.get("channel"),
                data.get("enc"),
            ))

            row = cur.fetchone()
            if row:
                print("Inserted row id:", row[0])
            else:
                print("Duplicate entry skipped")

        except Exception as e:
            print("Problem inserting data:", e)

except KeyboardInterrupt:
    print("\nStopped manually.")
finally:
    ser.close()
    cur.close()
    conn.close()
    print("All connections closed.")
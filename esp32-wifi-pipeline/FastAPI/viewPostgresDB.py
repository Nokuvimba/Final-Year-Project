# viewPostgresDB.py
import psycopg2, pandas as pd

conn = psycopg2.connect(
    host="localhost", dbname="wifi_db",
    user="wifiuser", password="Password"
)

sql = """
SELECT
    w.id,
    w.received_at,
    w.node,
    w.ssid,
    w.bssid,
    w.rssi,
    w.channel,
    w.enc,
    w.room_id,
    r.name AS room_name,
    b.name AS building_name
FROM wifi_scan w
LEFT JOIN room r ON w.room_id = r.id
LEFT JOIN building b ON r.building_id = b.id
ORDER BY w.id DESC
LIMIT 25;
"""

df = pd.read_sql(sql, conn)

# Optional: make empty room/building show as '-' instead of NaN
df = df.fillna("-")

print(df.to_string(index=False))
conn.close()
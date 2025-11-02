# viewPostgresDB.py
import psycopg2, pandas as pd

conn = psycopg2.connect(
    host="localhost", dbname="wifi_db",
    user="wifiuser", password="Password"
)
sql = """
SELECT id, received_at, node, ssid, bssid, rssi, channel, enc
FROM wifi_scan
ORDER BY id DESC
LIMIT 25;
"""
df = pd.read_sql(sql, conn)
print(df.to_string(index=False))
conn.close()
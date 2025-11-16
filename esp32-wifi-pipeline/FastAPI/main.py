import os
from typing import List, Dict, Any
from fastapi import FastAPI, Body, HTTPException, Query
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv() # Load .env file if present
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://wifiuser:Password@localhost/wifi_db")
engine = create_engine(DATABASE_URL, future=True)

app = FastAPI(title="Wi-Fi Scan API", version="0.2.0")

@app.post("/ingest")
def ingest(scans: List[Dict[str, Any]] = Body(...)):
    # Expect: [{node, ts, ssid, bssid, rssi, channel, enc}, ...]
    if not isinstance(scans, list) or not scans:
        raise HTTPException(status_code=400, detail="Payload must be a non-empty array")
    sql = text("""
        INSERT INTO wifi_scan (received_at, node, device_ts_ms, ssid, bssid, rssi, channel, enc)
        VALUES (NOW(), :node, :ts, :ssid, :bssid, :rssi, :channel, :enc)
        ON CONFLICT (device_ts_ms, bssid) DO NOTHING
    """)
    with engine.begin() as conn:
        for s in scans:
            conn.execute(sql, {
                "node": s.get("node"),
                "ts": s.get("ts"),
                "ssid": s.get("ssid"),
                "bssid": s.get("bssid"),
                "rssi": s.get("rssi"),
                "channel": s.get("channel"),
                "enc": s.get("enc"),
            })
    return {"accepted": len(scans)}

@app.get("/wifi/recent")
def recent(limit: int = Query(25, ge=1, le=500)):
    sql = text("""
        SELECT id, received_at, node, ssid, bssid, rssi, channel, enc
        FROM wifi_scan
        ORDER BY id DESC
        LIMIT :limit
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"limit": limit}).mappings().all()
    return {"rows": [dict(r) for r in rows]}

@app.get("/health")
def health():
    return {"status": "ok"}
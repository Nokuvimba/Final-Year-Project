# main.py
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional
import asyncio, json, math, os, uuid
from datetime import datetime, timezone

from fastapi import FastAPI, Body, HTTPException, Query, Depends, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import Base, engine, get_db, SessionLocal
from models import (
    WifiScanDB, BuildingDB, RoomDB,
    FloorPlanDB, ScanPointDB, Dht22ReadingDB, Mq135ReadingDB,
)
from schemas import (
    BuildingCreate, BuildingUpdate,
    RoomCreate, RoomUpdate,
    FloorPlanUrlCreate, FloorPlanUpdate, HeatmapPoint,
)


# ── JWT Auth config ──────────────────────────────────────────────────────────
# Credentials and secret are loaded from .env — never hardcoded.
# pip install python-jose[cryptography]
from jose import JWTError, jwt
from datetime import timedelta

JWT_SECRET       = os.getenv("JWT_SECRET",       "change-me-before-deploy")
JWT_ALGORITHM    = "HS256"
JWT_EXPIRY_HOURS = 8   # token valid for 8 hours — suitable for a demo day
ADMIN_EMAIL      = os.getenv("ADMIN_EMAIL",      "admin@mssia.ie")
ADMIN_PASSWORD   = os.getenv("ADMIN_PASSWORD",   "admin123")


# ── Startup ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="Wi-Fi Scan API", version="2.0.0", lifespan=lifespan)

os.makedirs("uploads/floorplans", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://final-year-project-alpha-azure.vercel.app",
        "https://final-year-project-git-master-nokuvimbas-projects.vercel.app",
    ],
    allow_origin_regex=r"https://final-year-project-.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Auth ─────────────────────────────────────────────────────────────────────
#
# POST /auth/login  — validate credentials, return a signed JWT access token
# GET  /auth/verify — validate a token (called by the frontend on page load)
#
# Token is stored in the browser's localStorage and sent as:
#   Authorization: Bearer <token>

@app.post("/auth/login")
def auth_login(payload: Dict[str, Any] = Body(...)):
    email    = payload.get("email", "").strip().lower()
    password = payload.get("password", "")

    if email != ADMIN_EMAIL.lower() or password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token_data = {
        "sub": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    token = jwt.encode(token_data, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}


@app.get("/auth/verify")
def auth_verify(authorization: str = Header(default=None)):
    """Validates the JWT token sent in the Authorization header.
    Called by the admin studio on page load to check if the session is still valid.
    Returns 401 if the token is missing, malformed, or expired.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"valid": True, "email": payload.get("sub")}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Ingest ────────────────────────────────────────────────────────────────────
#
# POST /ingest — receives sensor data from ESP32 (or any HTTP client).
#
# Expected payload:
#   { "node": "esp32-a", "scans": [ { "ssid": "...", "bssid": "...", "rssi": -65, "channel": 6, "enc": "WPA2" } ] }
#
# Security: the node name must match an assigned_node on a scan_point record.
#   Unknown nodes are rejected with 403. This prevents bots or unknown devices
#   from inserting fake data — only nodes the admin has assigned are accepted.
#
# Timestamps: received_at is stamped by the server (datetime.now UTC).
#   The ESP32 does NOT need to send a timestamp — millis() is unreliable anyway.

@app.post("/ingest")
def ingest(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    node        = payload.get("node")
    scans       = payload.get("scans", [])
    temperature = payload.get("temperature")   # optional DHT22 block

    # ── Validation ────────────────────────────────────────────────────────────
    if not node:
        raise HTTPException(status_code=400, detail="Missing 'node' field in payload")

    if not isinstance(scans, list) or not scans:
        raise HTTPException(status_code=400, detail="Missing or empty 'scans' array in payload")

    # ── Node validation (security) ────────────────────────────────────────────
    known = db.query(ScanPointDB).filter(ScanPointDB.assigned_node == node).first()
    if not known:
        raise HTTPException(status_code=403, detail="Unassigned")

    # ── Stamp server-side timestamp once for this batch ───────────────────────
    server_now    = datetime.now(timezone.utc)
    scan_point_id = known.id

    # ── Store WiFi scans ──────────────────────────────────────────────────────
    accepted = 0
    for s in scans:
        row = WifiScanDB(
            node          = node,
            ssid          = s.get("ssid"),
            bssid         = s.get("bssid"),
            rssi          = s.get("rssi"),
            channel       = s.get("channel"),
            enc           = s.get("enc"),
            received_at   = server_now,
            scan_point_id = scan_point_id,
        )
        db.add(row)
        try:
            db.flush()
            accepted += 1
        except IntegrityError:
            db.rollback()
            continue

    # ── Store temperature + humidity (optional) ───────────────────────────────
    # Present only when DHT22 is wired and returns valid readings.
    temp_stored = False
    if temperature and isinstance(temperature, dict):
        temp_c  = temperature.get("temperature_c")
        hum_pct = temperature.get("humidity_pct")
        if temp_c is not None and hum_pct is not None:
            try:
                db.add(Dht22ReadingDB(
                    node          = node,
                    scan_point_id = scan_point_id,
                    temperature_c = float(temp_c),
                    humidity_pct  = float(hum_pct),
                    received_at   = server_now,
                ))
                db.flush()
                temp_stored = True
            except Exception:
                db.rollback()

    # ── Store air quality reading (optional) ─────────────────────────────────
    # Present only when MQ-135 is wired and analogRead returns a non-zero value.
    air_stored = False
    air_quality = payload.get("air_quality")
    if air_quality and isinstance(air_quality, dict):
        ppm       = air_quality.get("ppm")
        raw_value = air_quality.get("raw_value")
        if ppm is not None:
            try:
                db.add(Mq135ReadingDB(
                    node          = node,
                    scan_point_id = scan_point_id,
                    ppm           = float(ppm),
                    raw_value     = int(raw_value) if raw_value is not None else None,
                    received_at   = server_now,
                ))
                db.flush()
                air_stored = True
            except Exception:
                db.rollback()

    db.commit()
    return {
        "status":        "Assigned",
        "accepted":      accepted,
        "total":         len(scans),
        "temp_stored":   temp_stored,
        "air_stored":    air_stored,
        "node":          node,
        "scan_point_id": scan_point_id,
        "received_at":   server_now.isoformat(),
    }


# ── Scan Points ───────────────────────────────────────────────────────────────
#
# Admin clicks the floor plan image → POST creates a scan_point at (x, y).
# The snap-to-nearest logic lives in the frontend; backend just stores coords.

@app.get("/floorplans/{floorplan_id}/scan-points")
def list_scan_points(
    floorplan_id: int,
    db: Session = Depends(get_db),
):
    floorplan = db.get(FloorPlanDB, floorplan_id)
    if not floorplan:
        raise HTTPException(status_code=404, detail="Floor plan not found")

    points = (
        db.query(ScanPointDB)
        .filter(ScanPointDB.floorplan_id == floorplan_id)
        .order_by(ScanPointDB.id)
        .all()
    )

    return {
        "floorplan_id": floorplan_id,
        "scan_points": [_format_point(p, db) for p in points],
    }


@app.post("/floorplans/{floorplan_id}/scan-points")
def create_scan_point(
    floorplan_id: int,
    x: float = Body(...),
    y: float = Body(...),
    label: Optional[str] = Body(None),
    db: Session = Depends(get_db),
):
    floorplan = db.get(FloorPlanDB, floorplan_id)
    if not floorplan:
        raise HTTPException(status_code=404, detail="Floor plan not found")

    if not (0 <= x <= 1) or not (0 <= y <= 1):
        raise HTTPException(status_code=400, detail="Coordinates must be between 0 and 1")

    point = ScanPointDB(floorplan_id=floorplan_id, x=x, y=y, label=label)
    db.add(point)
    db.commit()
    db.refresh(point)

    return {"scan_point": _format_point(point, db)}


@app.put("/scan-points/{point_id}")
def update_scan_point(
    point_id: int,
    label: Optional[str] = Body(None),
    x: Optional[float] = Body(None),
    y: Optional[float] = Body(None),
    db: Session = Depends(get_db),
):
    point = db.get(ScanPointDB, point_id)
    if not point:
        raise HTTPException(status_code=404, detail="Scan point not found")

    if label is not None:
        point.label = label
    if x is not None:
        if not (0 <= x <= 1):
            raise HTTPException(status_code=400, detail="x must be between 0 and 1")
        point.x = x
    if y is not None:
        if not (0 <= y <= 1):
            raise HTTPException(status_code=400, detail="y must be between 0 and 1")
        point.y = y

    db.commit()
    db.refresh(point)
    return {"scan_point": _format_point(point, db)}


@app.delete("/scan-points/{point_id}")
def delete_scan_point(point_id: int, db: Session = Depends(get_db)):
    point = db.get(ScanPointDB, point_id)
    if not point:
        raise HTTPException(status_code=404, detail="Scan point not found")

    # Explicitly delete child rows first to avoid FK constraint violations.
    # This is needed regardless of ON DELETE SET NULL — the DB may have been
    # created before the constraint was added.
    db.query(WifiScanDB).filter(WifiScanDB.scan_point_id == point_id).delete()
    db.query(Dht22ReadingDB).filter(Dht22ReadingDB.scan_point_id == point_id).delete()
    db.query(Mq135ReadingDB).filter(Mq135ReadingDB.scan_point_id == point_id).delete()
    db.delete(point)
    db.commit()
    return {"message": "Scan point deleted"}

@app.get("/scan-points/{point_id}/wifi-history")
def get_scan_point_wifi_history(
    point_id: int,
    time_range: str = Query(default="20m", pattern="^(20m|1h|6h|24h|7d)$"),
    db: Session = Depends(get_db),
):
    """
    Returns WiFi scan history bucketed by time period for a specific scan point.

    range param controls both the lookback window and bucket size:
      20m  → last 20 minutes,  1-minute  buckets (20 buckets)
      1h   → last 1 hour,      1-minute  buckets (60 buckets)
      6h   → last 6 hours,     10-minute buckets (36 buckets)
      24h  → last 24 hours,    1-hour    buckets (24 buckets)
      7d   → last 7 days,      6-hour    buckets (28 buckets)

    Each bucket:
      label    : human-readable period label, e.g. "19m", "5h", "3d"
      count    : scan rows received in that period (busyness)
      avg_rssi : average signal strength, null if no scans
      level    : strong / medium / low / weak / null
    """
    point = db.get(ScanPointDB, point_id)
    if not point:
        raise HTTPException(status_code=404, detail="Scan point not found")

    from datetime import datetime, timedelta, timezone

    # ── Range config ────────────────────────────────────────────────────────
    RANGE_CONFIG = {
        "20m": {"total_minutes": 20,        "bucket_minutes": 1,   "n_buckets": 20},
        "1h":  {"total_minutes": 60,        "bucket_minutes": 1,   "n_buckets": 60},
        "6h":  {"total_minutes": 360,       "bucket_minutes": 10,  "n_buckets": 36},
        "24h": {"total_minutes": 1440,      "bucket_minutes": 60,  "n_buckets": 24},
        "7d":  {"total_minutes": 7 * 1440,  "bucket_minutes": 360, "n_buckets": 28},
    }
    cfg            = RANGE_CONFIG[time_range]
    total_minutes  = cfg["total_minutes"]
    bucket_minutes = cfg["bucket_minutes"]
    n_buckets      = cfg["n_buckets"]

    def _bucket_label(bucket_index: int) -> str:
        """Human-readable label for the oldest end of this bucket."""
        periods_ago = n_buckets - 1 - bucket_index
        minutes_ago = periods_ago * bucket_minutes
        if bucket_minutes < 60:
            return f"{minutes_ago}m"
        elif bucket_minutes < 1440:
            return f"{minutes_ago // 60}h"
        else:
            return f"{minutes_ago // 1440}d"

    def _bucket_start_iso(bucket_index: int) -> str:
        """ISO timestamp for the start of this bucket (UTC)."""
        periods_ago = n_buckets - 1 - bucket_index
        bucket_start = now - timedelta(minutes=(periods_ago + 1) * bucket_minutes)
        return bucket_start.isoformat()

    now    = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=total_minutes)

    rows = (
        db.query(WifiScanDB)
        .filter(
            WifiScanDB.scan_point_id == point_id,
            WifiScanDB.received_at >= cutoff,
        )
        .order_by(WifiScanDB.received_at)
        .all()
    )

    # Build buckets: index 0 = oldest, index (n_buckets-1) = most recent
    buckets: dict[int, dict] = {
        i: {"label": _bucket_label(i), "count": 0, "rssi_sum": 0.0, "rssi_n": 0}
        for i in range(n_buckets)
    }

    for row in rows:
        ts = row.received_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        delta_minutes = (now - ts).total_seconds() / 60
        # Which bucket does this row fall into?
        # Bucket 0 = [total_minutes ago, total_minutes-bucket_minutes ago)
        bucket_index = int((total_minutes - delta_minutes) / bucket_minutes)
        if 0 <= bucket_index < n_buckets:
            buckets[bucket_index]["count"] += 1
            if row.rssi is not None:
                buckets[bucket_index]["rssi_sum"] += row.rssi
                buckets[bucket_index]["rssi_n"]   += 1

    result = []
    for i in range(n_buckets):
        b = buckets[i]
        avg_rssi = round(b["rssi_sum"] / b["rssi_n"], 1) if b["rssi_n"] > 0 else None
        result.append({
            "label":        b["label"],
            "bucket_start": _bucket_start_iso(i),   # ISO UTC timestamp for this bucket
            "count":        b["count"],
            "avg_rssi":     avg_rssi,
            "level":        _signal_level(avg_rssi),
        })

    return {
        "scan_point_id": point_id,
        "label":         point.label,
        "range":         time_range,
        "bucket_minutes": bucket_minutes,
        "n_buckets":     n_buckets,
        "total_scans":   sum(b["count"] for b in result),
        "buckets":       result,
    }



@app.get("/scan-points/{point_id}/dht22-history")
def get_dht22_history(
    point_id: int,
    time_range: str = Query(default="24h", pattern="^(1h|6h|24h|7d|30d)$"),
    db: Session = Depends(get_db),
):
    """
    Returns recent temperature and humidity readings for a scan point.

    time_range: 1h | 6h | 24h | 7d | 30d
    Each reading: received_at (ISO UTC), temperature_c (°C), humidity_pct (%)
    """
    point = db.get(ScanPointDB, point_id)
    if not point:
        raise HTTPException(status_code=404, detail="Scan point not found")

    from datetime import datetime, timedelta, timezone

    RANGE_MINUTES = {"1h": 60, "6h": 360, "24h": 1440, "7d": 10080, "30d": 43200}
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=RANGE_MINUTES[time_range])

    rows = (
        db.query(Dht22ReadingDB)
        .filter(
            Dht22ReadingDB.scan_point_id == point_id,
            Dht22ReadingDB.received_at   >= cutoff,
        )
        .order_by(Dht22ReadingDB.received_at.asc())
        .all()
    )

    return {
        "scan_point_id": point_id,
        "time_range":    time_range,
        "count":         len(rows),
        "readings": [
            {
                "received_at":   r.received_at.isoformat(),
                "temperature_c": r.temperature_c,
                "humidity_pct":  r.humidity_pct,
            }
            for r in rows
        ],
    }


def _format_point(point: ScanPointDB, db: Session) -> dict:
    """Helper — serialise a ScanPointDB row.
    assigned_node lives directly on scan_point now — no join needed.
    """
    scan_count = db.query(func.count(WifiScanDB.id)).filter(
        WifiScanDB.scan_point_id == point.id
    ).scalar() or 0

    return {
        "id": point.id,
        "floorplan_id": point.floorplan_id,
        "x": point.x,
        "y": point.y,
        "label": point.label,
        "created_at": point.created_at,
        "assigned_at": point.assigned_at,
        "scan_count": scan_count,
        "assigned_node": point.assigned_node,
        "is_active": point.assigned_node is not None,
    }


# ── Device Management ────────────────────────────────────────────────────────
# Devices are now tracked via scan_point.assigned_node directly.
# A "device" is simply a scan_point that has assigned_node set.

@app.get("/devices")
def list_devices(db: Session = Depends(get_db)):
    # Return all scan points that have a device assigned
    # plus any node names seen in wifi_scan but not yet assigned to a point
    assigned_points = (
        db.query(ScanPointDB)
        .filter(ScanPointDB.assigned_node.isnot(None))
        .order_by(ScanPointDB.assigned_node)
        .all()
    )

    return {
        "devices": [
            {
                "node": p.assigned_node,
                "scan_point_id": p.id,
                "label": p.label,
                "x": p.x,
                "y": p.y,
                "floorplan_id": p.floorplan_id,
                "assigned_at": p.assigned_at,
                "is_active": True,
            }
            for p in assigned_points
        ]
    }


@app.post("/devices/{node}/assign-point/{scan_point_id}")
def assign_point_to_device(
    node: str,
    scan_point_id: int,
    db: Session = Depends(get_db),
):
    point = db.get(ScanPointDB, scan_point_id)
    if not point:
        raise HTTPException(status_code=404, detail="Scan point not found")

    # If this node is already assigned somewhere else, clear it first
    old_point = db.query(ScanPointDB).filter(ScanPointDB.assigned_node == node).first()
    if old_point and old_point.id != scan_point_id:
        old_point.assigned_node = None
        old_point.assigned_at   = None

    # If target point already has a different device, clear that device first
    if point.assigned_node and point.assigned_node != node:
        point.assigned_node = None
        point.assigned_at   = None

    point.assigned_node = node
    point.assigned_at   = func.now()
    db.commit()
    db.refresh(point)

    return {
        "node": node,
        "scan_point_id": scan_point_id,
        "label": point.label,
        "x": point.x,
        "y": point.y,
        "assigned_at": point.assigned_at,
    }


@app.post("/devices/{node}/clear-point")
def clear_point_from_device(node: str, db: Session = Depends(get_db)):
    point = db.query(ScanPointDB).filter(ScanPointDB.assigned_node == node).first()
    if not point:
        raise HTTPException(status_code=404, detail="Device not found or not assigned")

    point.assigned_node = None
    point.assigned_at   = None
    db.commit()
    return {"node": node, "scan_point_id": None, "message": "Device unassigned"}

@app.get("/devices/known")
def list_known_nodes(db: Session = Depends(get_db)):
    """
    Returns all ESP32 node names ever seen — whether currently assigned or not.
    Used to populate the device assignment dropdown in the admin studio.
    Combines:
      - Nodes currently assigned to a scan_point (assigned_node column)
      - Distinct node names from wifi_scan (nodes that have sent data)
    """
    # Nodes currently assigned
    assigned = {
        row.assigned_node
        for row in db.query(ScanPointDB.assigned_node)
        .filter(ScanPointDB.assigned_node.isnot(None))
        .all()
    }
    # Nodes seen in wifi_scan
    scanned = {
        row.node
        for row in db.query(WifiScanDB.node)
        .filter(WifiScanDB.node.isnot(None))
        .distinct()
        .all()
    }
    all_nodes = sorted(assigned | scanned)
    return {"nodes": all_nodes}


# ── Buildings ─────────────────────────────────────────────────────────────────

@app.get("/buildings")
def list_buildings(db: Session = Depends(get_db)):
    buildings = db.query(BuildingDB).order_by(BuildingDB.name).all()
    return {"buildings": [{"id": b.id, "name": b.name, "description": b.description} for b in buildings]}


@app.post("/buildings")
def create_building(payload: BuildingCreate, db: Session = Depends(get_db)):
    if db.query(BuildingDB).filter(BuildingDB.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Building name already exists")
    b = BuildingDB(name=payload.name, description=payload.description)
    db.add(b)
    db.commit()
    db.refresh(b)
    return {"building": {"id": b.id, "name": b.name, "description": b.description}}


@app.get("/buildings/{building_id}")
def get_building(building_id: int, db: Session = Depends(get_db)):
    building = db.get(BuildingDB, building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")
    return {
        "building": {"id": building.id, "name": building.name, "description": building.description},
        "rooms": [{"id": r.id, "name": r.name, "floor": r.floor, "room_type": r.room_type} for r in building.rooms],
        "floorplans": [{"id": fp.id, "floor_name": fp.floor_name, "image_url": fp.image_url, "created_at": fp.created_at} for fp in building.floorplans],
    }


@app.put("/buildings/{building_id}")
def update_building(building_id: int, payload: BuildingUpdate, db: Session = Depends(get_db)):
    building = db.get(BuildingDB, building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")
    if payload.name is not None:
        if db.query(BuildingDB).filter(BuildingDB.name == payload.name, BuildingDB.id != building_id).first():
            raise HTTPException(status_code=400, detail="Building name already exists")
        building.name = payload.name
    if payload.description is not None:
        building.description = payload.description
    db.commit()
    db.refresh(building)
    return {"building": {"id": building.id, "name": building.name, "description": building.description}}


@app.delete("/buildings/{building_id}")
def delete_building(building_id: int, db: Session = Depends(get_db)):
    """
    Delete a building and everything underneath it (explicit cascade).
    Order: wifi_scan rows → scan_points → floor_plans → building
    Done explicitly so FK constraints are always satisfied regardless
    of whether the DB schema has CASCADE configured.
    """
    building = db.get(BuildingDB, building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    for fp in building.floorplans:
        for sp in fp.scan_points:
            db.query(WifiScanDB).filter(WifiScanDB.scan_point_id == sp.id).delete()
            db.delete(sp)
        db.delete(fp)

    db.delete(building)
    db.commit()
    return {"message": f"Building '{building.name}' and all associated data deleted"}


# ── Rooms (organisational only) ───────────────────────────────────────────────

@app.post("/rooms")
def create_room(payload: RoomCreate, db: Session = Depends(get_db)):
    if not db.get(BuildingDB, payload.building_id):
        raise HTTPException(status_code=404, detail="Building not found")
    r = RoomDB(name=payload.name, building_id=payload.building_id, floor=payload.floor, room_type=payload.room_type)
    db.add(r)
    db.commit()
    db.refresh(r)
    return {"room": {"id": r.id, "name": r.name, "building_id": r.building_id, "floor": r.floor, "room_type": r.room_type}}


@app.get("/rooms")
def list_rooms(building_id: Optional[int] = Query(default=None), db: Session = Depends(get_db)):
    q = db.query(RoomDB).join(BuildingDB)
    if building_id is not None:
        q = q.filter(RoomDB.building_id == building_id)
    rows = q.order_by(BuildingDB.name, RoomDB.name).all()
    return {"rooms": [{"id": r.id, "name": r.name, "building_id": r.building_id, "floor": r.floor, "room_type": r.room_type} for r in rows]}


@app.put("/rooms/{room_id}")
def update_room(room_id: int, payload: RoomUpdate, db: Session = Depends(get_db)):
    room = db.get(RoomDB, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if payload.building_id is not None:
        if not db.get(BuildingDB, payload.building_id):
            raise HTTPException(status_code=404, detail="Building not found")
        room.building_id = payload.building_id
    if payload.name is not None: room.name = payload.name
    if payload.floor is not None: room.floor = payload.floor
    if payload.room_type is not None: room.room_type = payload.room_type
    db.commit()
    db.refresh(room)
    return {"room": {"id": room.id, "name": room.name, "building_id": room.building_id, "floor": room.floor, "room_type": room.room_type}}


@app.delete("/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db)):
    room = db.get(RoomDB, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    db.delete(room)
    db.commit()
    return {"message": "Room deleted"}


# ── WiFi scans ────────────────────────────────────────────────────────────────

@app.get("/wifi/rawScans")
def list_raw_scans(limit: int = Query(25, ge=1, le=1000), db: Session = Depends(get_db)):
    rows = db.query(WifiScanDB).order_by(WifiScanDB.id.desc()).limit(limit).all()
    return {
        "rows": [
            {
                "id": r.id,
                "received_at": r.received_at,
                "node": r.node,
                "ssid": r.ssid,
                "bssid": r.bssid,
                "rssi": r.rssi,
                "channel": r.channel,
                "enc": r.enc,
                "scan_point_id": r.scan_point_id,
                "label": r.scan_point.label if r.scan_point else None,
                "x": r.scan_point.x if r.scan_point else None,
                "y": r.scan_point.y if r.scan_point else None,
            }
            for r in rows
        ]
    }


@app.get("/dht22/tempHumidityHistory")
def list_dht22_raw_scans(limit: int = Query(25, ge=1, le=1000), db: Session = Depends(get_db)):
    rows = db.query(Dht22ReadingDB).order_by(Dht22ReadingDB.id.desc()).limit(limit).all()
    return {
        "rows": [
            {
                "id": r.id,
                "received_at": r.received_at,
                "node": r.node,
                "temperature_c": r.temperature_c,
                "humidity_pct": r.humidity_pct,
                "scan_point_id": r.scan_point_id,
                "label": r.scan_point.label if r.scan_point else None,
                "x": r.scan_point.x if r.scan_point else None,
                "y": r.scan_point.y if r.scan_point else None,
            }
            for r in rows
        ]
    }


@app.get("/mq135/rawScans")
def list_mq135_raw_scans(limit: int = Query(25, ge=1, le=1000), db: Session = Depends(get_db)):
    """Returns most recent MQ-135 readings across all scan points.
    Mirrors /wifi/rawScans and /dht22/tempHumidityHistory — used in the admin raw data view.
    """
    rows = db.query(Mq135ReadingDB).order_by(Mq135ReadingDB.id.desc()).limit(limit).all()
    return {
        "rows": [
            {
                "id":            r.id,
                "received_at":   r.received_at,
                "node":          r.node,
                "ppm":           r.ppm,
                "raw_value":     r.raw_value,
                "scan_point_id": r.scan_point_id,
                "label":         r.scan_point.label if r.scan_point else None,
                "x":             r.scan_point.x    if r.scan_point else None,
                "y":             r.scan_point.y    if r.scan_point else None,
            }
            for r in rows
        ]
    }


@app.get("/scan-points/{point_id}/mq135-history")
def get_mq135_history(
    point_id: int,
    time_range: str = Query(default="24h", pattern="^(1h|6h|24h|7d|30d)$"),
    db: Session = Depends(get_db),
):
    """Returns recent MQ-135 air quality readings for a specific scan point.
    Same pattern as /scan-points/{id}/dht22-history.
    time_range: 1h | 6h | 24h | 7d | 30d
    """
    point = db.get(ScanPointDB, point_id)
    if not point:
        raise HTTPException(status_code=404, detail="Scan point not found")

    from datetime import timedelta
    RANGE_MINUTES = {"1h": 60, "6h": 360, "24h": 1440, "7d": 10080, "30d": 43200}
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=RANGE_MINUTES[time_range])

    rows = (
        db.query(Mq135ReadingDB)
        .filter(
            Mq135ReadingDB.scan_point_id == point_id,
            Mq135ReadingDB.received_at   >= cutoff,
        )
        .order_by(Mq135ReadingDB.received_at.asc())
        .all()
    )

    return {
        "scan_point_id": point_id,
        "time_range":    time_range,
        "count":         len(rows),
        "readings": [
            {
                "received_at": r.received_at.isoformat(),
                "ppm":         r.ppm,
                "raw_value":   r.raw_value,
            }
            for r in rows
        ],
    }


@app.get("/heatmap/floorplan/{floorplan_id}/mq135")
def get_mq135_heatmap(floorplan_id: int, db: Session = Depends(get_db)):
    """Returns latest MQ-135 reading per scan point for the air quality heatmap mode.
    Same pattern as /heatmap/floorplan/{id}/dht22.
    air_level: good | moderate | poor — thresholds adjusted for 3.3V operation.
    """
    if not db.get(FloorPlanDB, floorplan_id):
        raise HTTPException(status_code=404, detail="Floor plan not found")

    def _air_level(raw):
        # Thresholds adjusted for 3.3V power supply (sensor calibrated for 5V).
        # New sensor burn-in and 3.3V power shift values upward vs true PPM.
        if raw is None:       return None
        if raw < 2000:        return "good"
        if raw < 2800:        return "moderate"
        return "poor"

    points = (
        db.query(ScanPointDB)
        .filter(ScanPointDB.floorplan_id == floorplan_id)
        .all()
    )

    result = []
    for pt in points:
        # Get most recent MQ-135 reading for this scan point
        latest = (
            db.query(Mq135ReadingDB)
            .filter(Mq135ReadingDB.scan_point_id == pt.id)
            .order_by(Mq135ReadingDB.received_at.desc())
            .first()
        )
        result.append({
            "scan_point_id": pt.id,
            "label":         pt.label or f"Point {pt.id}",
            "x":             pt.x,
            "y":             pt.y,
            "assigned_node": pt.assigned_node,
            "ppm":           latest.ppm       if latest else None,
            "raw_value":     latest.raw_value if latest else None,
            "air_level":     _air_level(latest.raw_value if latest else None),
            "received_at":   latest.received_at.isoformat() if latest else None,
        })

    return result


# ── Floor Plans ───────────────────────────────────────────────────────────────

@app.post("/floorplans")
def create_floorplan(
    building_id: int = Form(...),
    floor_name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not db.get(BuildingDB, building_id):
        raise HTTPException(status_code=404, detail="Building not found")
    if not file.content_type or not file.content_type.startswith(("image/png", "image/jpeg")):
        raise HTTPException(status_code=400, detail="File must be PNG or JPEG")
    if db.query(FloorPlanDB).filter(FloorPlanDB.building_id == building_id, FloorPlanDB.floor_name == floor_name).first():
        raise HTTPException(status_code=400, detail="Floor plan already exists for this building and floor")

    file_ext = ".png" if file.content_type == "image/png" else ".jpg"
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = f"uploads/floorplans/{filename}"
    with open(file_path, "wb") as f:
        f.write(file.file.read())

    fp = FloorPlanDB(building_id=building_id, floor_name=floor_name, image_url=f"/uploads/floorplans/{filename}")
    db.add(fp)
    db.commit()
    db.refresh(fp)
    return {"floorplan": {"id": fp.id, "building_id": fp.building_id, "floor_name": fp.floor_name, "image_url": fp.image_url, "created_at": fp.created_at}}


@app.post("/floorplans/url")
def create_floorplan_from_url(payload: FloorPlanUrlCreate, db: Session = Depends(get_db)):
    if not db.get(BuildingDB, payload.building_id):
        raise HTTPException(status_code=404, detail="Building not found")
    fp = FloorPlanDB(building_id=payload.building_id, floor_name=payload.floor_name, image_url=payload.image_url)
    db.add(fp)
    db.commit()
    db.refresh(fp)
    return {"floorplan": {"id": fp.id, "building_id": fp.building_id, "floor_name": fp.floor_name, "image_url": fp.image_url, "created_at": fp.created_at}}


@app.put("/floorplans/{floorplan_id}")
def update_floorplan(floorplan_id: int, payload: FloorPlanUrlCreate, db: Session = Depends(get_db)):
    fp = db.get(FloorPlanDB, floorplan_id)
    if not fp:
        raise HTTPException(status_code=404, detail="Floor plan not found")
    fp.floor_name = payload.floor_name
    fp.image_url = payload.image_url
    db.commit()
    db.refresh(fp)
    return {"floorplan": {"id": fp.id, "building_id": fp.building_id, "floor_name": fp.floor_name, "image_url": fp.image_url, "created_at": fp.created_at}}


@app.patch("/floorplans/{floorplan_id}")
def rename_floorplan(floorplan_id: int, payload: FloorPlanUpdate, db: Session = Depends(get_db)):
    fp = db.get(FloorPlanDB, floorplan_id)
    if not fp:
        raise HTTPException(status_code=404, detail="Floor plan not found")
    if payload.floor_name is not None:
        fp.floor_name = payload.floor_name
    db.commit()
    db.refresh(fp)
    return {"floorplan": {"id": fp.id, "building_id": fp.building_id, "floor_name": fp.floor_name, "image_url": fp.image_url, "created_at": fp.created_at}}


@app.get("/buildings/{building_id}/floorplans")
def get_building_floorplans(building_id: int, db: Session = Depends(get_db)):
    building = db.get(BuildingDB, building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")
    fps = db.query(FloorPlanDB).filter(FloorPlanDB.building_id == building_id).order_by(FloorPlanDB.floor_name).all()
    return {
        "building": {"id": building.id, "name": building.name},
        "floorplans": [{"id": fp.id, "floor_name": fp.floor_name, "image_url": fp.image_url, "created_at": fp.created_at} for fp in fps],
    }


@app.delete("/floorplans/{floorplan_id}")
def delete_floorplan(floorplan_id: int, db: Session = Depends(get_db)):
    """
    Delete a floor plan and everything under it (explicit cascade).
    Order: wifi_scan rows → scan_points → floor_plan → uploaded image file
    """
    fp = db.get(FloorPlanDB, floorplan_id)
    if not fp:
        raise HTTPException(status_code=404, detail="Floor plan not found")

    for sp in fp.scan_points:
        db.query(WifiScanDB).filter(WifiScanDB.scan_point_id == sp.id).delete()
        db.delete(sp)

    if fp.image_url and fp.image_url.startswith("/uploads/"):
        path = fp.image_url[1:]
        if os.path.exists(path):
            os.remove(path)

    db.delete(fp)
    db.commit()
    return {"message": f"Floor plan '{fp.floor_name}' and all associated data deleted"}


@app.put("/floorplans/{floorplan_id}/image")
async def replace_floorplan_image(
    floorplan_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Replace the image for an existing floor plan.
    Scan points are preserved — their (x, y) coordinates stay attached.
    The old image file is deleted from disk if it was a local upload.
    """
    fp = db.get(FloorPlanDB, floorplan_id)
    if not fp:
        raise HTTPException(status_code=404, detail="Floor plan not found")

    # Remove old image from disk
    if fp.image_url and fp.image_url.startswith("/uploads/"):
        old_path = fp.image_url[1:]
        if os.path.exists(old_path):
            os.remove(old_path)

    # Save new image
    ext      = os.path.splitext(file.filename or "image.png")[1] or ".png"
    filename = f"{floorplan_id}_replace_{uuid.uuid4().hex[:8]}{ext}"
    file_path = f"uploads/floorplans/{filename}"
    with open(file_path, "wb") as f_out:
        f_out.write(await file.read())

    fp.image_url = f"/uploads/floorplans/{filename}"
    db.commit()
    db.refresh(fp)
    return {"floorplan": {"id": fp.id, "floor_name": fp.floor_name, "image_url": fp.image_url}}


# ── Heatmap ───────────────────────────────────────────────────────────────────

def _signal_level(avg_rssi: Optional[float]) -> Optional[str]:
    if avg_rssi is None: return None
    if avg_rssi >= -50: return "strong"
    if avg_rssi >= -60: return "medium"
    if avg_rssi >= -70: return "low"
    return "weak"


@app.get("/heatmap/floorplan/{floorplan_id}/dht22")
def get_floorplan_dht22_heatmap(floorplan_id: int, db: Session = Depends(get_db)):
    """
    Returns the latest DHT22 reading per scan point for a floor plan.
    Used to colour the heatmap blobs by temperature or humidity.

    For each scan_point on this floor plan that has at least one dht22_reading,
    returns the MOST RECENT temperature_c and humidity_pct value.

    Points with no DHT22 data are still returned so the frontend knows where
    they are — just with null temperature_c / humidity_pct.
    """
    if not db.get(FloorPlanDB, floorplan_id):
        raise HTTPException(status_code=404, detail="Floor plan not found")

    # Subquery: find the most recent received_at per scan_point_id
    from sqlalchemy import select as sa_select
    latest_subq = (
        db.query(
            Dht22ReadingDB.scan_point_id,
            func.max(Dht22ReadingDB.received_at).label("max_received_at"),
        )
        .group_by(Dht22ReadingDB.scan_point_id)
        .subquery()
    )

    # Join scan_points for this floor plan with their latest dht22 reading
    result = (
        db.query(
            ScanPointDB.id,
            ScanPointDB.label,
            ScanPointDB.x,
            ScanPointDB.y,
            ScanPointDB.assigned_node,
            Dht22ReadingDB.temperature_c,
            Dht22ReadingDB.humidity_pct,
            Dht22ReadingDB.received_at,
        )
        .outerjoin(latest_subq, latest_subq.c.scan_point_id == ScanPointDB.id)
        .outerjoin(
            Dht22ReadingDB,
            (Dht22ReadingDB.scan_point_id == ScanPointDB.id) &
            (Dht22ReadingDB.received_at == latest_subq.c.max_received_at),
        )
        .filter(ScanPointDB.floorplan_id == floorplan_id)
        .all()
    )

    def _temp_level(t):
        # Thresholds adjusted for Irish indoor environment
        # Cool: below 16°C (cold room, poor heating)
        # Comfortable: 16–21°C (typical Irish indoor range)
        # Warm: above 21°C (well heated or warm day)
        if t is None: return None
        if t < 16:    return "cool"
        if t < 21:    return "warm"
        return "hot"

    def _humidity_level(h):
        if h is None: return None
        if h < 30:    return "low"
        if h < 60:    return "medium"
        return "high"

    return [
        {
            "scan_point_id": row.id,
            "label":         row.label or f"Point {row.id}",
            "x":             row.x,
            "y":             row.y,
            "assigned_node": row.assigned_node,
            "temperature_c": row.temperature_c,
            "humidity_pct":  row.humidity_pct,
            "temp_level":    _temp_level(row.temperature_c),
            "humidity_level":_humidity_level(row.humidity_pct),
            "received_at":   row.received_at.isoformat() if row.received_at else None,
        }
        for row in result
    ]


@app.get("/heatmap/floorplan/{floorplan_id}", response_model=List[HeatmapPoint])
def get_floorplan_heatmap(floorplan_id: int, db: Session = Depends(get_db)):
    """
    Returns one HeatmapPoint per scan_point on this floor plan.
    Each point has its (x, y) coordinate and aggregated signal data.
    No session_id needed — queries wifi_scan directly via scan_point_id.
    """
    if not db.get(FloorPlanDB, floorplan_id):
        raise HTTPException(status_code=404, detail="Floor plan not found")

    result = (
        db.query(
            ScanPointDB.id,
            ScanPointDB.label,
            ScanPointDB.x,
            ScanPointDB.y,
            ScanPointDB.assigned_node,
            func.avg(WifiScanDB.rssi).label("avg_rssi"),
            func.count(WifiScanDB.id).label("samples"),
            func.max(WifiScanDB.received_at).label("last_scan_at"),
        )
        .outerjoin(WifiScanDB, WifiScanDB.scan_point_id == ScanPointDB.id)
        .filter(ScanPointDB.floorplan_id == floorplan_id)
        .group_by(ScanPointDB.id, ScanPointDB.label, ScanPointDB.x, ScanPointDB.y, ScanPointDB.assigned_node)
        .all()
    )

    return [
        HeatmapPoint(
            room_id=row.id,
            room_name=row.label or f"Point {row.id}",
            x=row.x,
            y=row.y,
            avg_rssi=float(row.avg_rssi) if row.avg_rssi else None,
            level=_signal_level(float(row.avg_rssi) if row.avg_rssi else None),
            samples=row.samples or 0,
            assigned_node=row.assigned_node,
            last_scan_at=row.last_scan_at.isoformat() if row.last_scan_at else None,
        )
        for row in result
    ]

# ── Server-Sent Events — real-time heatmap updates ───────────────────────────
#
# GET /events/floorplan/{id}/heatmap
#
# Clients subscribe once per floor plan.  Every 3 seconds the server checks
# whether any new wifi_scan, dht22_reading, or mq135_reading rows have arrived
# for scan points on that floor plan.  If the latest timestamp has advanced it
# emits a "data" event; otherwise it emits a keep-alive comment so the
# connection stays open through proxies that would otherwise time it out.
#
# The frontend simply re-fetches the existing heatmap endpoint on each event —
# no data is duplicated inside the event stream itself.

def _latest_ingest_ts(floorplan_id: int):
    """
    Return the most recent received_at across all three sensor tables for
    scan points that belong to floorplan_id.  Called in a threadpool so it
    is safe to use a plain sync SQLAlchemy session inside an async context.
    """
    db = SessionLocal()
    try:
        wifi_ts = (
            db.query(func.max(WifiScanDB.received_at))
            .join(ScanPointDB, WifiScanDB.scan_point_id == ScanPointDB.id)
            .filter(ScanPointDB.floorplan_id == floorplan_id)
            .scalar()
        )
        dht_ts = (
            db.query(func.max(Dht22ReadingDB.received_at))
            .join(ScanPointDB, Dht22ReadingDB.scan_point_id == ScanPointDB.id)
            .filter(ScanPointDB.floorplan_id == floorplan_id)
            .scalar()
        )
        mq_ts = (
            db.query(func.max(Mq135ReadingDB.received_at))
            .join(ScanPointDB, Mq135ReadingDB.scan_point_id == ScanPointDB.id)
            .filter(ScanPointDB.floorplan_id == floorplan_id)
            .scalar()
        )
        candidates = [t for t in [wifi_ts, dht_ts, mq_ts] if t is not None]
        return max(candidates) if candidates else None
    finally:
        db.close()


@app.get("/alerts")
def get_alerts(db: Session = Depends(get_db)):
    """
    Returns floor-level environmental alerts.  Three types, all computed from
    the latest sensor reading per scan point aggregated across each floor:
      - poor_air_quality : >50% of scan points with data report "poor" air
      - high_humidity    : floor average humidity above 70%
      - low_humidity     : floor average humidity below 30%
      - poor_signal      : >50% of scan points have "weak" or "low" WiFi signal
    Severity escalates to "critical" when >75% of points are affected.
    """
    HUMIDITY_HIGH        = 70.0
    HUMIDITY_LOW         = 30.0
    POOR_AIR_FRAC_WARN   = 0.5
    POOR_AIR_FRAC_CRIT   = 0.75
    POOR_SIG_FRAC_WARN   = 0.5
    POOR_SIG_FRAC_CRIT   = 0.75

    # All floors with their building names
    floor_rows = (
        db.query(
            FloorPlanDB.id,
            FloorPlanDB.floor_name,
            BuildingDB.id.label("building_id"),
            BuildingDB.name.label("building_name"),
        )
        .join(BuildingDB, BuildingDB.id == FloorPlanDB.building_id)
        .all()
    )

    # All scan point IDs grouped by floorplan_id
    sp_rows = db.query(ScanPointDB.id, ScanPointDB.floorplan_id).all()
    fp_to_sp: dict[int, list[int]] = {}
    for sp in sp_rows:
        fp_to_sp.setdefault(sp.floorplan_id, []).append(sp.id)

    all_sp_ids = [sp.id for sp in sp_rows]
    if not all_sp_ids:
        return {"alerts": []}

    # ── Latest MQ-135 air_level per scan point ────────────────────────────────
    mq_ts_subq = (
        db.query(
            Mq135ReadingDB.scan_point_id,
            func.max(Mq135ReadingDB.received_at).label("max_ts"),
        )
        .filter(Mq135ReadingDB.scan_point_id.in_(all_sp_ids))
        .group_by(Mq135ReadingDB.scan_point_id)
        .subquery()
    )
    mq_rows = (
        db.query(Mq135ReadingDB.scan_point_id, Mq135ReadingDB.air_level)
        .join(mq_ts_subq,
              (Mq135ReadingDB.scan_point_id == mq_ts_subq.c.scan_point_id) &
              (Mq135ReadingDB.received_at   == mq_ts_subq.c.max_ts))
        .all()
    )
    sp_air: dict[int, str] = {r.scan_point_id: r.air_level for r in mq_rows if r.air_level}

    # ── Latest DHT22 humidity per scan point ──────────────────────────────────
    dht_ts_subq = (
        db.query(
            Dht22ReadingDB.scan_point_id,
            func.max(Dht22ReadingDB.received_at).label("max_ts"),
        )
        .filter(Dht22ReadingDB.scan_point_id.in_(all_sp_ids))
        .group_by(Dht22ReadingDB.scan_point_id)
        .subquery()
    )
    dht_rows = (
        db.query(Dht22ReadingDB.scan_point_id, Dht22ReadingDB.humidity_pct)
        .join(dht_ts_subq,
              (Dht22ReadingDB.scan_point_id == dht_ts_subq.c.scan_point_id) &
              (Dht22ReadingDB.received_at   == dht_ts_subq.c.max_ts))
        .all()
    )
    sp_hum: dict[int, float] = {
        r.scan_point_id: r.humidity_pct
        for r in dht_rows if r.humidity_pct is not None
    }

    # ── Average RSSI → signal level per scan point ────────────────────────────
    wifi_agg = (
        db.query(
            WifiScanDB.scan_point_id,
            func.avg(WifiScanDB.rssi).label("avg_rssi"),
        )
        .filter(WifiScanDB.scan_point_id.in_(all_sp_ids))
        .group_by(WifiScanDB.scan_point_id)
        .all()
    )
    def _rssi_level(rssi: float) -> str:
        if rssi >= -60: return "strong"
        if rssi >= -70: return "medium"
        if rssi >= -80: return "low"
        return "weak"
    sp_signal: dict[int, str] = {
        r.scan_point_id: _rssi_level(float(r.avg_rssi))
        for r in wifi_agg if r.avg_rssi is not None
    }

    # ── Compute per-floor alerts ───────────────────────────────────────────────
    alerts = []
    for fp in floor_rows:
        sp_ids     = fp_to_sp.get(fp.id, [])
        loc        = f"{fp.floor_name} ({fp.building_name})"
        base       = {"building_id": fp.building_id, "building_name": fp.building_name,
                      "floorplan_id": fp.id, "floor_name": fp.floor_name}

        # Air quality
        air_levels = [sp_air[sid] for sid in sp_ids if sid in sp_air]
        if air_levels:
            total      = len(air_levels)
            poor_count = sum(1 for lvl in air_levels if lvl == "poor")
            frac       = poor_count / total
            if frac >= POOR_AIR_FRAC_WARN:
                severity = "critical" if frac >= POOR_AIR_FRAC_CRIT else "warning"
                alerts.append({**base, "severity": severity, "type": "poor_air_quality",
                    "message": f"{loc}: poor air quality at {poor_count}/{total} scan point{'s' if total>1 else ''}"})

        # Humidity
        hum_values = [sp_hum[sid] for sid in sp_ids if sid in sp_hum]
        if hum_values:
            avg_h = sum(hum_values) / len(hum_values)
            if avg_h > HUMIDITY_HIGH:
                alerts.append({**base, "severity": "warning", "type": "high_humidity",
                    "message": f"{loc}: high average humidity ({avg_h:.0f}%)"})
            elif avg_h < HUMIDITY_LOW:
                alerts.append({**base, "severity": "warning", "type": "low_humidity",
                    "message": f"{loc}: low average humidity ({avg_h:.0f}%)"})

        # Signal
        sig_levels = [sp_signal[sid] for sid in sp_ids if sid in sp_signal]
        if sig_levels:
            total      = len(sig_levels)
            poor_count = sum(1 for lvl in sig_levels if lvl in ("weak", "low"))
            frac       = poor_count / total
            if frac >= POOR_SIG_FRAC_WARN:
                severity = "critical" if frac >= POOR_SIG_FRAC_CRIT else "warning"
                alerts.append({**base, "severity": severity, "type": "poor_signal",
                    "message": f"{loc}: poor signal at {poor_count}/{total} scan point{'s' if total>1 else ''}"})

    return {"alerts": alerts}


@app.get("/events/floorplan/{floorplan_id}/heatmap")
async def sse_heatmap_updates(floorplan_id: int):
    """
    SSE stream for a single floor plan.  Emits ``data: {"ts": "<ISO>"}`` when
    new sensor data arrives; emits ``: keep-alive`` comments otherwise.

    Clients should close and re-open the connection if they navigate away.
    """
    async def generate():
        last_ts = None
        while True:
            await asyncio.sleep(3)
            try:
                latest = await asyncio.get_event_loop().run_in_executor(
                    None, _latest_ingest_ts, floorplan_id
                )
                if latest is not None and latest != last_ts:
                    last_ts = latest
                    payload = json.dumps({"ts": latest.isoformat()})
                    yield f"data: {payload}\n\n"
                else:
                    # Keep-alive comment — not delivered to onmessage
                    yield ": keep-alive\n\n"
            except Exception:
                yield ": keep-alive\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx proxy buffering
        },
    )

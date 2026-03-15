# main.py
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional
import math, os, uuid

from fastapi import FastAPI, Body, HTTPException, Query, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import (
    WifiScanDB, BuildingDB, RoomDB,
    FloorPlanDB, ScanPointDB,
)
from schemas import (
    BuildingCreate, BuildingUpdate,
    RoomCreate, RoomUpdate,
    FloorPlanUrlCreate, HeatmapPoint,
)


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
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Ingest ────────────────────────────────────────────────────────────────────
#
# ESP32 sends batches of scan objects here.
# We look up scan_point directly by assigned_node and stamp scan_point_id.
# No sessions, no room_id written here.

@app.post("/ingest", include_in_schema=False)
def ingest(
    scans: List[Dict[str, Any]] = Body(...),
    db: Session = Depends(get_db),
):
    if not isinstance(scans, list) or not scans:
        raise HTTPException(status_code=400, detail="Payload must be a non-empty array")

    # Cache scan_point lookups within this batch.
    # Query scan_point directly by assigned_node — no separate active_point table.
    point_cache: Dict[str, Optional[int]] = {}
    accepted = 0

    for s in scans:
        node = s.get("node")

        if node not in point_cache:
            point = db.query(ScanPointDB).filter(ScanPointDB.assigned_node == node).first()
            point_cache[node] = point.id if point else None

        row = WifiScanDB(
            node=node,
            device_ts_ms=s.get("ts"),
            ssid=s.get("ssid"),
            bssid=s.get("bssid"),
            rssi=s.get("rssi"),
            channel=s.get("channel"),
            enc=s.get("enc"),
            scan_point_id=point_cache.get(node),   # coordinate stamped here
        )
        db.add(row)
        try:
            db.flush()
            accepted += 1
        except IntegrityError:
            db.rollback()
            continue

    db.commit()
    return {"accepted": accepted, "total": len(scans)}


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
    x: float = Body(..., embed=True),
    y: float = Body(..., embed=True),
    label: Optional[str] = Body(None, embed=True),
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
    label: Optional[str] = Body(None, embed=True),
    x: Optional[float] = Body(None, embed=True),
    y: Optional[float] = Body(None, embed=True),
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

    db.delete(point)
    db.commit()
    return {"message": "Scan point deleted"}


def _format_point(point: ScanPointDB, db: Session) -> dict:
    """Helper — serialise a ScanPointDB row.
    assigned_node lives directly on scan_point now — no join needed anymore.
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
    building = db.get(BuildingDB, building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")
    db.delete(building)
    db.commit()
    return {"message": "Building deleted"}


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
    fp = db.get(FloorPlanDB, floorplan_id)
    if not fp:
        raise HTTPException(status_code=404, detail="Floor plan not found")
    if fp.image_url.startswith("/uploads/"):
        path = fp.image_url[1:]
        if os.path.exists(path):
            os.remove(path)
    db.delete(fp)
    db.commit()
    return {"message": "Floor plan deleted"}


# ── Heatmap ───────────────────────────────────────────────────────────────────

def _signal_level(avg_rssi: Optional[float]) -> Optional[str]:
    if avg_rssi is None: return None
    if avg_rssi >= -50: return "strong"
    if avg_rssi >= -60: return "medium"
    if avg_rssi >= -70: return "low"
    return "weak"


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
            func.avg(WifiScanDB.rssi).label("avg_rssi"),
            func.count(WifiScanDB.id).label("samples"),
        )
        .outerjoin(WifiScanDB, WifiScanDB.scan_point_id == ScanPointDB.id)
        .filter(ScanPointDB.floorplan_id == floorplan_id)
        .group_by(ScanPointDB.id, ScanPointDB.label, ScanPointDB.x, ScanPointDB.y)
        .all()
    )

    return [
        HeatmapPoint(
            room_id=row.id,           # reusing room_id field for scan_point id
            room_name=row.label or f"Point {row.id}",
            x=row.x,
            y=row.y,
            avg_rssi=float(row.avg_rssi) if row.avg_rssi else None,
            level=_signal_level(float(row.avg_rssi) if row.avg_rssi else None),
            samples=row.samples or 0,
        )
        for row in result
    ]
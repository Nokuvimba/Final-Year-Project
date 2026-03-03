# main.py
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, Body, HTTPException, Query, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import (
    WifiScanDB,
    BuildingDB,
    RoomDB,
    ActiveRoomDB,
    FloorPlanDB,
)
from schemas import (
    BuildingCreate,
    BuildingUpdate,
    RoomCreate,
    RoomUpdate,
    FloorPlanUrlCreate,
    HeatmapPoint,
)
import os
import uuid


# ── Startup ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="Wi-Fi Scan API", version="1.0.0", lifespan=lifespan)

os.makedirs("uploads/floorplans", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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
# The ESP32 posts an array of scan objects here continuously.
# We look up active_room for the sending node and stamp room_id directly
# onto each wifi_scan row. No sessions, no join tables.

@app.post("/ingest", include_in_schema=False)
def ingest(
    scans: List[Dict[str, Any]] = Body(...),
    db: Session = Depends(get_db),
):
    if not isinstance(scans, list) or not scans:
        raise HTTPException(status_code=400, detail="Payload must be a non-empty array")

    accepted = 0

    # Cache active_room lookups within this batch (all scans share the same node)
    room_cache: Dict[str, Optional[int]] = {}

    for s in scans:
        node = s.get("node")

        # Look up (and cache) the assigned room for this node
        if node not in room_cache:
            assignment = db.query(ActiveRoomDB).filter(ActiveRoomDB.node == node).first()

            # Auto-register the node as unassigned if it's new
            if assignment is None:
                assignment = ActiveRoomDB(node=node, room_id=None)
                db.add(assignment)
                try:
                    db.commit()
                except IntegrityError:
                    db.rollback()
                    assignment = db.query(ActiveRoomDB).filter(ActiveRoomDB.node == node).first()

            room_cache[node] = assignment.room_id if assignment else None

        row = WifiScanDB(
            node=node,
            device_ts_ms=s.get("ts"),
            ssid=s.get("ssid"),
            bssid=s.get("bssid"),
            rssi=s.get("rssi"),
            channel=s.get("channel"),
            enc=s.get("enc"),
            room_id=room_cache.get(node),   # stamped directly — no join table needed
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


# ── Device Management (active_room) ──────────────────────────────────────────
#
# These three endpoints replace the old start-scan / stop-scan / sessions flow.

@app.get("/devices")
def list_devices(db: Session = Depends(get_db)):
    """
    Returns all known ESP32 nodes with their current room assignment.
    A node appears here the moment it sends its first /ingest payload.
    """
    devices = db.query(ActiveRoomDB).order_by(ActiveRoomDB.node).all()

    return {
        "devices": [
            {
                "node": d.node,
                "room_id": d.room_id,
                "room_name": d.room.name if d.room else None,
                "building_id": d.room.building_id if d.room else None,
                "building_name": d.room.building.name if d.room else None,
                "assigned_at": d.assigned_at,
                "is_active": d.room_id is not None,
            }
            for d in devices
        ]
    }


@app.post("/devices/{node}/assign-room/{room_id}")
def assign_room_to_device(
    node: str,
    room_id: int,
    db: Session = Depends(get_db),
):
    """
    Assign an ESP32 node to a room.
    All scans from this node will be tagged with room_id until changed.
    Creates the device record if it doesn't exist yet.
    """
    room = db.get(RoomDB, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    assignment = db.query(ActiveRoomDB).filter(ActiveRoomDB.node == node).first()
    if assignment:
        assignment.room_id = room_id
    else:
        assignment = ActiveRoomDB(node=node, room_id=room_id)
        db.add(assignment)

    db.commit()
    db.refresh(assignment)

    return {
        "node": assignment.node,
        "room_id": assignment.room_id,
        "room_name": room.name,
        "building_name": room.building.name,
        "assigned_at": assignment.assigned_at,
    }


@app.post("/devices/{node}/clear-room")
def clear_room_from_device(
    node: str,
    db: Session = Depends(get_db),
):
    """
    Unassign a device from its current room.
    Subsequent scans from this node will have room_id = NULL.
    """
    assignment = db.query(ActiveRoomDB).filter(ActiveRoomDB.node == node).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Device not found")

    assignment.room_id = None
    db.commit()

    return {"node": node, "room_id": None, "message": "Device unassigned"}


# ── Buildings ─────────────────────────────────────────────────────────────────

@app.get("/buildings")
def list_buildings(db: Session = Depends(get_db)):
    buildings = db.query(BuildingDB).order_by(BuildingDB.name).all()
    return {
        "buildings": [
            {"id": b.id, "name": b.name, "description": b.description}
            for b in buildings
        ]
    }


@app.post("/buildings")
def create_building(payload: BuildingCreate, db: Session = Depends(get_db)):
    existing = db.query(BuildingDB).filter(BuildingDB.name == payload.name).first()
    if existing:
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
        "rooms": [
            {
                "id": r.id,
                "name": r.name,
                "floor": r.floor,
                "room_type": r.room_type,
                "x": r.x,
                "y": r.y,
                "floorplan_id": r.floorplan_id,
            }
            for r in building.rooms
        ],
        "floorplans": [
            {
                "id": fp.id,
                "floor_name": fp.floor_name,
                "image_url": fp.image_url,
                "created_at": fp.created_at,
            }
            for fp in building.floorplans
        ],
    }


@app.put("/buildings/{building_id}")
def update_building(building_id: int, payload: BuildingUpdate, db: Session = Depends(get_db)):
    building = db.get(BuildingDB, building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    if payload.name is not None:
        existing = db.query(BuildingDB).filter(
            BuildingDB.name == payload.name, BuildingDB.id != building_id
        ).first()
        if existing:
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
    return {"message": "Building deleted successfully"}


@app.get("/buildings/{building_id}/wifi")
def recent_scans_for_building(
    building_id: int,
    limit: int = Query(500, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    building = db.get(BuildingDB, building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    rows = (
        db.query(WifiScanDB, RoomDB)
        .join(RoomDB, WifiScanDB.room_id == RoomDB.id)
        .filter(RoomDB.building_id == building_id)
        .order_by(WifiScanDB.id.desc())
        .limit(limit)
        .all()
    )

    return {
        "building": {"id": building.id, "name": building.name, "description": building.description},
        "rows": [
            {
                "id": scan.id,
                "received_at": scan.received_at,
                "node": scan.node,
                "ssid": scan.ssid,
                "bssid": scan.bssid,
                "rssi": scan.rssi,
                "channel": scan.channel,
                "enc": scan.enc,
                "room_id": room.id,
                "room_name": room.name,
            }
            for (scan, room) in rows
        ],
    }


# ── Rooms ─────────────────────────────────────────────────────────────────────

@app.post("/rooms")
def create_room(payload: RoomCreate, db: Session = Depends(get_db)):
    if not payload.name or payload.building_id is None:
        raise HTTPException(status_code=400, detail="Fields 'name' and 'building_id' are required")

    building = db.get(BuildingDB, payload.building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    r = RoomDB(
        name=payload.name,
        building_id=payload.building_id,
        floor=payload.floor,
        room_type=payload.room_type,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return {"room": {"id": r.id, "name": r.name, "building_id": r.building_id, "floor": r.floor, "room_type": r.room_type}}


@app.get("/rooms")
def list_rooms(
    building_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(RoomDB).join(BuildingDB)
    if building_id is not None:
        q = q.filter(RoomDB.building_id == building_id)

    rows = q.order_by(BuildingDB.name, RoomDB.name).all()
    return {
        "rooms": [
            {
                "id": r.id,
                "name": r.name,
                "building_id": r.building_id,
                "building_name": r.building.name,
                "floor": r.floor,
                "room_type": r.room_type,
                "x": r.x,
                "y": r.y,
                "floorplan_id": r.floorplan_id,
            }
            for r in rows
        ]
    }


@app.put("/rooms/{room_id}")
def update_room(room_id: int, payload: RoomUpdate, db: Session = Depends(get_db)):
    room = db.get(RoomDB, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if payload.building_id is not None:
        if not db.get(BuildingDB, payload.building_id):
            raise HTTPException(status_code=404, detail="Building not found")
        room.building_id = payload.building_id

    if payload.name is not None:
        room.name = payload.name
    if payload.floor is not None:
        room.floor = payload.floor
    if payload.room_type is not None:
        room.room_type = payload.room_type

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
    return {"message": "Room deleted successfully"}


@app.get("/rooms/{room_id}/wifi")
def recent_scans_for_room(
    room_id: int,
    limit: int = Query(100, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    room = db.get(RoomDB, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    rows = (
        db.query(WifiScanDB)
        .filter(WifiScanDB.room_id == room_id)
        .order_by(WifiScanDB.id.desc())
        .limit(limit)
        .all()
    )

    return {
        "room": {
            "id": room.id,
            "name": room.name,
            "floor": room.floor,
            "room_type": room.room_type,
            "building_id": room.building_id,
            "building_name": room.building.name,
        },
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
                "room_id": room_id,
            }
            for r in rows
        ],
    }


@app.put("/rooms/{room_id}/position")
def update_room_position(
    room_id: int,
    floorplan_id: int = Body(...),
    x: float = Body(...),
    y: float = Body(...),
    db: Session = Depends(get_db),
):
    room = db.get(RoomDB, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    floorplan = db.get(FloorPlanDB, floorplan_id)
    if not floorplan:
        raise HTTPException(status_code=404, detail="Floor plan not found")

    if floorplan.building_id != room.building_id:
        raise HTTPException(status_code=400, detail="Floor plan must belong to the same building as the room")

    if not (0 <= x <= 1) or not (0 <= y <= 1):
        raise HTTPException(status_code=400, detail="Coordinates must be between 0 and 1")

    room.floorplan_id = floorplan_id
    room.x = x
    room.y = y
    db.commit()
    db.refresh(room)

    return {"room": {"id": room.id, "name": room.name, "floorplan_id": room.floorplan_id, "x": room.x, "y": room.y}}


# ── Raw WiFi scans ─────────────────────────────────────────────────────────────

@app.get("/wifi/rawScans")
def list_raw_scans(
    limit: int = Query(25, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(WifiScanDB)
        .order_by(WifiScanDB.id.desc())
        .limit(limit)
        .all()
    )
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
                "room_id": r.room_id,
                "room_name": r.room.name if r.room else None,
                "building_name": r.room.building.name if r.room else None,
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
    building = db.get(BuildingDB, building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    if not file.content_type or not file.content_type.startswith(("image/png", "image/jpeg")):
        raise HTTPException(status_code=400, detail="File must be PNG or JPEG")

    existing = db.query(FloorPlanDB).filter(
        FloorPlanDB.building_id == building_id,
        FloorPlanDB.floor_name == floor_name,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Floor plan already exists for this building and floor")

    file_ext = ".png" if file.content_type == "image/png" else ".jpg"
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = f"uploads/floorplans/{filename}"

    with open(file_path, "wb") as f:
        f.write(file.file.read())

    floorplan = FloorPlanDB(
        building_id=building_id,
        floor_name=floor_name,
        image_url=f"/uploads/floorplans/{filename}",
    )
    db.add(floorplan)
    db.commit()
    db.refresh(floorplan)

    return {
        "floorplan": {
            "id": floorplan.id,
            "building_id": floorplan.building_id,
            "floor_name": floorplan.floor_name,
            "image_url": floorplan.image_url,
            "created_at": floorplan.created_at,
        }
    }


@app.post("/floorplans/url")
def create_floorplan_from_url(payload: FloorPlanUrlCreate, db: Session = Depends(get_db)):
    building = db.get(BuildingDB, payload.building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    floorplan = FloorPlanDB(
        building_id=payload.building_id,
        floor_name=payload.floor_name,
        image_url=payload.image_url,
    )
    db.add(floorplan)
    db.commit()
    db.refresh(floorplan)

    return {
        "floorplan": {
            "id": floorplan.id,
            "building_id": floorplan.building_id,
            "floor_name": floorplan.floor_name,
            "image_url": floorplan.image_url,
            "created_at": floorplan.created_at,
        }
    }


@app.get("/buildings/{building_id}/floorplans")
def get_building_floorplans(building_id: int, db: Session = Depends(get_db)):
    building = db.get(BuildingDB, building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    floorplans = (
        db.query(FloorPlanDB)
        .filter(FloorPlanDB.building_id == building_id)
        .order_by(FloorPlanDB.floor_name)
        .all()
    )

    return {
        "building": {"id": building.id, "name": building.name},
        "floorplans": [
            {"id": fp.id, "floor_name": fp.floor_name, "image_url": fp.image_url, "created_at": fp.created_at}
            for fp in floorplans
        ],
    }


@app.put("/floorplans/{floorplan_id}")
def update_floorplan(
    floorplan_id: int,
    payload: FloorPlanUrlCreate,
    db: Session = Depends(get_db),
):
    floorplan = db.get(FloorPlanDB, floorplan_id)
    if not floorplan:
        raise HTTPException(status_code=404, detail="Floor plan not found")

    floorplan.floor_name = payload.floor_name
    floorplan.image_url = payload.image_url
    db.commit()
    db.refresh(floorplan)

    return {
        "floorplan": {
            "id": floorplan.id,
            "building_id": floorplan.building_id,
            "floor_name": floorplan.floor_name,
            "image_url": floorplan.image_url,
            "created_at": floorplan.created_at,
        }
    }


@app.delete("/floorplans/{floorplan_id}")
def delete_floorplan(floorplan_id: int, db: Session = Depends(get_db)):
    floorplan = db.get(FloorPlanDB, floorplan_id)
    if not floorplan:
        raise HTTPException(status_code=404, detail="Floor plan not found")

    if floorplan.image_url.startswith("/uploads/"):
        file_path = floorplan.image_url[1:]
        if os.path.exists(file_path):
            os.remove(file_path)

    db.delete(floorplan)
    db.commit()
    return {"message": "Floor plan deleted successfully"}


# ── Heatmap ───────────────────────────────────────────────────────────────────

def compute_signal_level(avg_rssi: Optional[float]) -> Optional[str]:
    if avg_rssi is None:
        return None
    if avg_rssi >= -50:
        return "strong"
    elif avg_rssi >= -60:
        return "medium"
    elif avg_rssi >= -70:
        return "low"
    else:
        return "weak"


@app.get("/heatmap/floorplan/{floorplan_id}", response_model=List[HeatmapPoint])
def get_floorplan_heatmap(
    floorplan_id: int,
    db: Session = Depends(get_db),
):
    """
    Returns average RSSI per room for all rooms on this floor plan.
    No session_id needed — just query wifi_scan directly via room_id.
    """
    floorplan = db.get(FloorPlanDB, floorplan_id)
    if not floorplan:
        raise HTTPException(status_code=404, detail="Floor plan not found")

    result = (
        db.query(
            RoomDB.id,
            RoomDB.name,
            RoomDB.x,
            RoomDB.y,
            func.avg(WifiScanDB.rssi).label("avg_rssi"),
            func.count(WifiScanDB.id).label("samples"),
        )
        .join(WifiScanDB, WifiScanDB.room_id == RoomDB.id)
        .filter(RoomDB.floorplan_id == floorplan_id)
        .group_by(RoomDB.id, RoomDB.name, RoomDB.x, RoomDB.y)
        .all()
    )

    return [
        HeatmapPoint(
            room_id=row.id,
            room_name=row.name,
            x=row.x,
            y=row.y,
            avg_rssi=float(row.avg_rssi) if row.avg_rssi is not None else None,
            level=compute_signal_level(float(row.avg_rssi) if row.avg_rssi else None),
            samples=row.samples,
        )
        for row in result
    ]
# main.py
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, Body, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import asynccontextmanager
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import (
    WifiScanDB,
    BuildingDB,
    RoomDB,
    ScanSessionDB,
    RoomScanDB,
)
from .schemas import BuildingCreate, BuildingUpdate, RoomCreate, RoomUpdate

NODE_TAG = "ESP32-LAB-01"

# Lifespan – make sure tables exist
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="Wi-Fi Scan API", version="0.3.0", lifespan=lifespan)

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

# Health + ingest
@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ingest", include_in_schema=False)
def ingest(
    scans: List[Dict[str, Any]] = Body(...),
    db: Session = Depends(get_db),
):
   #  1. Store raw Wi-Fi scans in wifi_scan.
   # 2. If there is an active scan session, also create a row in room_scan to link this scan to the current room/session. 
         
    if not isinstance(scans, list) or not scans:
        raise HTTPException(
            status_code=400,
            detail="Payload must be a non-empty array",
        )

    accepted = 0

    # single-device setup → one active session max
    active_session = (
        db.query(ScanSessionDB)
        .filter(ScanSessionDB.is_active.is_(True))
        .order_by(ScanSessionDB.started_at.desc())
        .first()
    )

    for s in scans:
        # 1. raw scan
        row = WifiScanDB(
            node=s.get("node"),
            device_ts_ms=s.get("ts"),
            ssid=s.get("ssid"),
            bssid=s.get("bssid"),
            rssi=s.get("rssi"),
            channel=s.get("channel"),
            enc=s.get("enc"),
            room_id=None,  # raw
        )
        db.add(row)
        try:
            db.commit()
            db.refresh(row)
            accepted += 1
        except IntegrityError:
            db.rollback()
            # skip room_scan if the raw scan failed
            continue

        # 2. link to current room/session if there is one
        if active_session:
            link = RoomScanDB(
                wifi_scan_id=row.id,
                session_id=active_session.id,
                room_id=active_session.room_id,
            )
            db.add(link)
            try:
                db.commit()
            except IntegrityError:
                db.rollback()

    return {"accepted": accepted, "total": len(scans)}


# Scan sessions (start / stop for a room)

@app.post("/rooms/{room_id}/start-scan")
def start_scan_in_room(
    room_id: int,
    db: Session = Depends(get_db),
):
    room = db.get(RoomDB, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # single-device setup → close any existing active sessions
    db.query(ScanSessionDB).filter(
        ScanSessionDB.is_active.is_(True)
    ).update(
        {"is_active": False, "ended_at": func.now()}
    )

    session = ScanSessionDB(node=NODE_TAG, room_id=room_id)
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "message": "Scan session started",
        "session_id": session.id,
        "room_id": room_id,
    }


@app.post("/rooms/{room_id}/stop-scan")
def stop_scan_in_room(
    room_id: int,
    db: Session = Depends(get_db),
):
    session = (
        db.query(ScanSessionDB)
        .filter(
            ScanSessionDB.room_id == room_id,
            ScanSessionDB.is_active.is_(True),
        )
        .order_by(ScanSessionDB.started_at.desc())
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")

    session.is_active = False
    session.ended_at = func.now()
    db.commit()

    return {
        "message": "Scan session stopped",
        "session_id": session.id,
        "room_id": room_id,
    }



# Raw recent scans (global)

@app.get("/wifi/rawScans")
def rawScans(
    limit: int = Query(25, ge=1, le=500),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(WifiScanDB)
        .order_by(WifiScanDB.id.desc())
        .limit(limit)
        .all()
    )

    result = []
    for r in rows:
        room = r.room  # may be None (older manually-tagged data)
        building = room.building if room else None

        result.append(
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
                "room_name": room.name if room else None,
                "building_id": building.id if building else None,
                "building_name": building.name if building else None,
            }
        )

    return {"rows": result}


# Buildings

@app.post("/buildings")
def create_building(payload: BuildingCreate, db: Session = Depends(get_db)):
    name = payload.name
    if not name:
        raise HTTPException(status_code=400, detail="Field 'name' is required")

    description = payload.description

    existing = db.query(BuildingDB).filter(BuildingDB.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Building name already exists")

    b = BuildingDB(name=name, description=description)
    db.add(b)
    db.commit()
    db.refresh(b)

    return {
        "building": {
            "id": b.id,
            "name": b.name,
            "description": b.description,
        }
    }


@app.get("/buildings")
def list_buildings(db: Session = Depends(get_db)):
    rows = db.query(BuildingDB).order_by(BuildingDB.name).all()
    return {
        "buildings": [
            {"id": b.id, "name": b.name, "description": b.description}
            for b in rows
        ]
    }


@app.put("/buildings/{building_id}")
def update_building(
    building_id: int,
    payload: BuildingUpdate,
    db: Session = Depends(get_db),
):
    building = db.get(BuildingDB, building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    if payload.name is not None:
        existing = db.query(BuildingDB).filter(
            BuildingDB.name == payload.name,
            BuildingDB.id != building_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Building name already exists")
        building.name = payload.name

    if payload.description is not None:
        building.description = payload.description

    db.commit()
    db.refresh(building)

    return {
        "building": {
            "id": building.id,
            "name": building.name,
            "description": building.description,
        }
    }


@app.delete("/buildings/{building_id}")
def delete_building(
    building_id: int,
    db: Session = Depends(get_db),
):
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

    # wifi_scan -> room_scan -> room, filter by building
    rows = (
        db.query(WifiScanDB, RoomDB)
        .join(RoomScanDB, RoomScanDB.wifi_scan_id == WifiScanDB.id)
        .join(RoomDB, RoomScanDB.room_id == RoomDB.id)
        .filter(RoomDB.building_id == building_id)
        .order_by(WifiScanDB.id.desc())
        .limit(limit)
        .all()
    )

    return {
        "building": {
            "id": building.id,
            "name": building.name,
            "description": building.description,
        },
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


# Rooms

@app.post("/rooms")
def create_room(payload: RoomCreate, db: Session = Depends(get_db)):
    name = payload.name
    building_id = payload.building_id

    if not name or building_id is None:
        raise HTTPException(
            status_code=400,
            detail="Fields 'name' and 'building_id' are required",
        )

    floor = payload.floor
    room_type = payload.room_type

    building = db.query(BuildingDB).filter(BuildingDB.id == building_id).first()
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    r = RoomDB(
        name=name,
        building_id=building_id,
        floor=floor,
        room_type=room_type,
    )
    db.add(r)
    db.commit()
    db.refresh(r)

    return {
        "room": {
            "id": r.id,
            "name": r.name,
            "building_id": r.building_id,
            "floor": r.floor,
            "room_type": r.room_type,
        }
    }


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
            }
            for r in rows
        ]
    }


@app.put("/rooms/{room_id}")
def update_room(
    room_id: int,
    payload: RoomUpdate,
    db: Session = Depends(get_db),
):
    room = db.get(RoomDB, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if payload.building_id is not None:
        building = db.get(BuildingDB, payload.building_id)
        if not building:
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

    return {
        "room": {
            "id": room.id,
            "name": room.name,
            "building_id": room.building_id,
            "floor": room.floor,
            "room_type": room.room_type,
        }
    }


@app.delete("/rooms/{room_id}")
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
):
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

    # use the physical mapping table room_scan
    rows = (
        db.query(WifiScanDB)
        .join(RoomScanDB, RoomScanDB.wifi_scan_id == WifiScanDB.id)
        .filter(RoomScanDB.room_id == room_id)
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


# Sessions listing (admin)

@app.get("/sessions")
def list_sessions(
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(ScanSessionDB)
        .join(RoomDB, ScanSessionDB.room_id == RoomDB.id)
        .join(BuildingDB, RoomDB.building_id == BuildingDB.id)
        .order_by(ScanSessionDB.id.desc())
        .all()
    )

    return {
        "sessions": [
            {
                "id": s.id,
                "node": s.node,
                "room_id": s.room_id,
                "room_name": s.room.name,
                "building_id": s.room.building_id,
                "building_name": s.room.building.name,
                "started_at": s.started_at,
                "ended_at": s.ended_at,
                "is_active": s.is_active,
            }
            for s in sessions
        ]
    }
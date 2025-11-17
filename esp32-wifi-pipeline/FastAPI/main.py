# main.py
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, Body, HTTPException, Query, Depends
from fastapi.concurrency import asynccontextmanager
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from .schemas import BuildingCreate, RoomCreate

from .database import Base, engine, get_db
from .models import WifiScanDB, BuildingDB, RoomDB


#  creating tables on startup 
@asynccontextmanager
async def lifespan(app: FastAPI):
   
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Wi-Fi Scan API", version="0.3.0", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/ingest")
def ingest(
    scans: List[Dict[str, Any]] = Body(...),
    room_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Expect: [{node, ts, ssid, bssid, rssi, channel, enc}, ...]
    Optional: room_id query param to tag all scans with a room.
    """
    if not isinstance(scans, list) or not scans:
        raise HTTPException(status_code=400, detail="Payload must be a non-empty array")

    accepted = 0

    for s in scans:
        row = WifiScanDB(
            node=s.get("node"),
            device_ts_ms=s.get("ts"),
            ssid=s.get("ssid"),
            bssid=s.get("bssid"),
            rssi=s.get("rssi"),
            channel=s.get("channel"),
            enc=s.get("enc"),
            room_id=room_id,
        )
        db.add(row)
        try:
            db.commit()
            db.refresh(row)
            accepted += 1
        except IntegrityError:
            db.rollback()

    return {"accepted": accepted, "total": len(scans), "room_id": room_id}

@app.get("/wifi/recent")
def recent(
    limit: int = Query(25, ge=1, le=500),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(WifiScanDB)
        .order_by(WifiScanDB.id.desc())
        .limit(limit)
        .all()
    )

    return {"rows": [
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
        }
        for r in rows
    ]}


@app.post("/buildings")
def create_building(payload: BuildingCreate, db: Session = Depends(get_db)):
    name = payload.name
    if not name:
        raise HTTPException(status_code=400, detail="Field 'name' is required")

    description = payload.description

    # check for duplicate
    existing = db.query(BuildingDB).filter(BuildingDB.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Building name already exists")

    b = BuildingDB(name=name, description=description)
    db.add(b)
    db.commit()
    db.refresh(b)

    return {"building": {
        "id": b.id,
        "name": b.name,
        "description": b.description,
    }}


@app.get("/buildings")
def list_buildings(db: Session = Depends(get_db)):
    rows = db.query(BuildingDB).order_by(BuildingDB.name).all()
    return {"buildings": [
        {"id": b.id, "name": b.name, "description": b.description}
        for b in rows
    ]}



# ROOMS 
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

    # check building exists
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

    return {"room": {
        "id": r.id,
        "name": r.name,
        "building_id": r.building_id,
        "floor": r.floor,
        "room_type": r.room_type,
    }}


@app.get("/rooms")
def list_rooms(
    building_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(RoomDB).join(BuildingDB)

    if building_id is not None:
        q = q.filter(RoomDB.building_id == building_id)

    rows = q.order_by(BuildingDB.name, RoomDB.name).all()

    return {"rooms": [
        {
            "id": r.id,
            "name": r.name,
            "building_id": r.building_id,
            "building_name": r.building.name,
            "floor": r.floor,
            "room_type": r.room_type,
        }
        for r in rows
    ]}
    
@app.get("/rooms/{room_id}/wifi")
def recent_scans_for_room(
    room_id: int,
    limit: int = Query(100, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    # making sure the room exists
    room = db.get(RoomDB, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # fetching scans for this room
    rows = (
        db.query(WifiScanDB)
        .filter(WifiScanDB.room_id == room_id)
        .order_by(WifiScanDB.id.desc())
        .limit(limit)
        .all()
    )

    # return scans + some metadata about room/building
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
                "room_id": r.room_id,
            }
            for r in rows
        ],
    }
    
@app.get("/buildings/{building_id}/wifi")
def recent_scans_for_building(
    building_id: int,
    limit: int = Query(500, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    # ensure the building exists
    building = db.get(BuildingDB, building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    # join wifi_scan -> room and filter by building
    rows = (
        db.query(WifiScanDB)
        .join(RoomDB, WifiScanDB.room_id == RoomDB.id)
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
                "id": r.id,
                "received_at": r.received_at,
                "node": r.node,
                "ssid": r.ssid,
                "bssid": r.bssid,
                "rssi": r.rssi,
                "channel": r.channel,
                "enc": r.enc,
                "room_id": r.room_id,
            }
            for r in rows
        ],
    }
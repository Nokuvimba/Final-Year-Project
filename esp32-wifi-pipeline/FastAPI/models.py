# models.py
from sqlalchemy import (
    Column, Integer, BigInteger, Text, DateTime, ForeignKey, Float, CheckConstraint
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class BuildingDB(Base):
    __tablename__ = "building"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(Text, nullable=False, unique=True)
    description = Column(Text, nullable=True)

    rooms      = relationship("RoomDB",      back_populates="building", cascade="all, delete-orphan")
    floorplans = relationship("FloorPlanDB", back_populates="building", cascade="all, delete-orphan")


class RoomDB(Base):
    """
    Kept for admin organisational purposes only.
    Rooms group and label areas of a building in the UI.
    NOT connected to scan data — scans are tagged via scan_point.
    """
    __tablename__ = "room"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(Text, nullable=False)
    floor       = Column(Text, nullable=True)
    room_type   = Column(Text, nullable=True)
    building_id = Column(Integer, ForeignKey("building.id", ondelete="CASCADE"), nullable=False)

    building = relationship("BuildingDB", back_populates="rooms")


class FloorPlanDB(Base):
    __tablename__ = "floor_plan"

    id          = Column(Integer, primary_key=True, index=True)
    building_id = Column(Integer, ForeignKey("building.id", ondelete="CASCADE"), nullable=False)
    floor_name  = Column(Text, nullable=False)
    image_url   = Column(Text, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    building    = relationship("BuildingDB", back_populates="floorplans")
    scan_points = relationship("ScanPointDB", back_populates="floorplan", cascade="all, delete-orphan")


class ScanPointDB(Base):
    """
    A physical coordinate on a floor plan image where an ESP32 sits.

    The admin clicks the floor plan image → a pin drops at (x, y).
    All wifi_scan rows from a device assigned here carry scan_point_id.

    label is optional display text — NO FK to room table.
    Room table stays for organisational grouping only.

    Future sensors just add a FK to this same table:
        dht22_reading.scan_point_id  →  scan_point.id
        air_reading.scan_point_id    →  scan_point.id
    """
    __tablename__ = "scan_point"

    id           = Column(Integer, primary_key=True, index=True)
    floorplan_id = Column(Integer, ForeignKey("floor_plan.id", ondelete="CASCADE"), nullable=False, index=True)
    x            = Column(Float, nullable=False)   # 0.0 – 1.0 fraction of image width
    y            = Column(Float, nullable=False)   # 0.0 – 1.0 fraction of image height
    label        = Column(Text, nullable=True)     # optional display name e.g. "Near window"
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("x >= 0 AND x <= 1", name="ck_scan_point_x"),
        CheckConstraint("y >= 0 AND y <= 1", name="ck_scan_point_y"),
    )

    floorplan          = relationship("FloorPlanDB",   back_populates="scan_points")
    scans              = relationship("WifiScanDB",    back_populates="scan_point")
    active_assignment  = relationship("ActivePointDB", back_populates="scan_point", uselist=False)


class ActivePointDB(Base):
    """
    Device → scan_point registry (replaces active_room).
    One row per ESP32 node. Ingest reads this to stamp scan_point_id.

    Assign:  POST /devices/{node}/assign-point/{scan_point_id}
    Clear:   POST /devices/{node}/clear-point
    """
    __tablename__ = "active_point"

    node          = Column(Text, primary_key=True)
    scan_point_id = Column(Integer, ForeignKey("scan_point.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    scan_point = relationship("ScanPointDB", back_populates="active_assignment")


class WifiScanDB(Base):
    __tablename__ = "wifi_scan"

    id           = Column(BigInteger, primary_key=True, index=True)
    received_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    node         = Column(Text, index=True)
    device_ts_ms = Column(BigInteger, index=True)
    ssid         = Column(Text)
    bssid        = Column(Text, index=True)
    rssi         = Column(Integer)
    channel      = Column(Integer)
    enc          = Column(Text)

    # Primary FK — coordinate stamped at ingest via active_point lookup
    scan_point_id = Column(Integer, ForeignKey("scan_point.id", ondelete="SET NULL"), nullable=True, index=True)

    # Organisational only — NOT written at ingest, kept for admin display
    room_id = Column(Integer, ForeignKey("room.id", ondelete="SET NULL"), nullable=True, index=True)

    scan_point = relationship("ScanPointDB", back_populates="scans")
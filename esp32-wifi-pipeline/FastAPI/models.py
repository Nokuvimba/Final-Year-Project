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
    A physical coordinate on a floor plan image where an ESP32 device is placed.

    The admin clicks the floor plan image → a pin drops at (x, y).
    All sensor readings from the assigned device carry this scan_point_id.

    assigned_node  — which ESP32 is currently at this location (nullable).
                     UNIQUE constraint: one device can only be at one point at a time.
    assigned_at    — when the device was last assigned here.

    Future sensors (DHT22, air quality) just add:
        dht22_reading.scan_point_id  → scan_point.id
        air_quality_reading.scan_point_id  → scan_point.id
    Zero further schema changes needed.
    """
    __tablename__ = "scan_point"

    id            = Column(Integer, primary_key=True, index=True)
    floorplan_id  = Column(Integer, ForeignKey("floor_plan.id", ondelete="CASCADE"), nullable=False, index=True)
    x             = Column(Float, nullable=False)   # 0.0–1.0 fraction of image width
    y             = Column(Float, nullable=False)   # 0.0–1.0 fraction of image height
    label         = Column(Text, nullable=True)     # optional display name e.g. "Near window"
    assigned_node = Column(Text, nullable=True, unique=True)   # ESP32 node id currently here
    assigned_at   = Column(DateTime(timezone=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("x >= 0 AND x <= 1", name="ck_scan_point_x"),
        CheckConstraint("y >= 0 AND y <= 1", name="ck_scan_point_y"),
    )

    floorplan            = relationship("FloorPlanDB",           back_populates="scan_points")
    scans                = relationship("WifiScanDB",             back_populates="scan_point")
    dht22_readings = relationship("Dht22ReadingDB",   back_populates="scan_point")


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

    # Coordinate stamped at ingest — look up scan_point by assigned_node
    scan_point_id = Column(Integer, ForeignKey("scan_point.id", ondelete="SET NULL"), nullable=True, index=True)

    # Organisational only — NOT written at ingest
    room_id = Column(Integer, ForeignKey("room.id", ondelete="SET NULL"), nullable=True, index=True)

    scan_point = relationship("ScanPointDB", back_populates="scans")


class Dht22ReadingDB(Base):
    """
    One row per DHT22 reading from an ESP32.
    Temperature and humidity come from the same sensor so they share a row.

    received_at is stamped by the server (datetime.now UTC) — the ESP32 does not send timestamps.
    scan_point_id is looked up by assigned_node at ingest time — same pattern as wifi_scan.
    """
    __tablename__ = "dht22_reading"

    id            = Column(BigInteger, primary_key=True, index=True)
    scan_point_id = Column(Integer, ForeignKey("scan_point.id", ondelete="SET NULL"), nullable=True, index=True)
    node          = Column(Text, index=True)
    temperature_c = Column(Float, nullable=False)   # °C — DHT22 range: -40 to +80
    humidity_pct  = Column(Float, nullable=False)   # % — DHT22 range: 0 to 100
    received_at   = Column(DateTime(timezone=True), nullable=False, index=True)

    scan_point = relationship("ScanPointDB", back_populates="dht22_readings")
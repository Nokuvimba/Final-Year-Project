# models.py
from sqlalchemy import (
    Boolean,
    Column,
    Integer,
    BigInteger,
    Text,
    DateTime,
    ForeignKey,
    Float,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from database import Base


class BuildingDB(Base):
    __tablename__ = "building"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text, nullable=False, unique=True)
    description = Column(Text, nullable=True)

    rooms = relationship(
        "RoomDB",
        back_populates="building",
        cascade="all, delete-orphan",
    )
    floorplans = relationship(
        "FloorPlanDB",
        back_populates="building",
        cascade="all, delete-orphan",
    )


class RoomDB(Base):
    __tablename__ = "room"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text, nullable=False)
    floor = Column(Text, nullable=True)
    room_type = Column(Text, nullable=True)
    x = Column(Float, nullable=True)
    y = Column(Float, nullable=True)

    building_id = Column(
        Integer,
        ForeignKey("building.id", ondelete="CASCADE"),
        nullable=False,
    )
    floorplan_id = Column(
        Integer,
        ForeignKey("floor_plan.id", ondelete="SET NULL"),
        nullable=True,
    )

    building = relationship("BuildingDB", back_populates="rooms")
    floorplan = relationship("FloorPlanDB", back_populates="rooms")
    scans = relationship("WifiScanDB", back_populates="room")

    # One room can have many active_room assignments (one per node)
    active_assignments = relationship(
        "ActiveRoomDB",
        back_populates="room",
        cascade="all, delete-orphan",
    )


class ActiveRoomDB(Base):
    """
    Lightweight device→room registry.

    One row per ESP32 node. The ingest endpoint reads this table to
    know which room to stamp on incoming scans. Assigning a device to
    a new room simply UPSERTs this table — no sessions, no start/stop.

    Example rows:
      node="ESP32-LAB-01"  room_id=101   (scanning Room 101)
      node="ESP32-LAB-02"  room_id=205   (scanning Room 205)
      node="ESP32-LAB-03"  room_id=None  (unassigned)
    """
    __tablename__ = "active_room"

    # The ESP32 node tag is the primary key — one row per device
    node = Column(Text, primary_key=True)

    room_id = Column(
        Integer,
        ForeignKey("room.id", ondelete="SET NULL"),
        nullable=True,
    )

    # When was this assignment last changed (useful for the dashboard)
    assigned_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    room = relationship("RoomDB", back_populates="active_assignments")


class WifiScanDB(Base):
    __tablename__ = "wifi_scan"

    id = Column(BigInteger, primary_key=True, index=True)
    received_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    node = Column(Text, index=True)        # which ESP32 sent this
    device_ts_ms = Column(BigInteger, index=True)
    ssid = Column(Text)
    bssid = Column(Text, index=True)
    rssi = Column(Integer)
    channel = Column(Integer)
    enc = Column(Text)

    # Direct FK to room — stamped at ingest time from active_room lookup
    room_id = Column(
        Integer,
        ForeignKey("room.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    room = relationship("RoomDB", back_populates="scans")


class FloorPlanDB(Base):
    __tablename__ = "floor_plan"

    id = Column(Integer, primary_key=True, index=True)
    building_id = Column(
        Integer,
        ForeignKey("building.id", ondelete="CASCADE"),
        nullable=False,
    )
    floor_name = Column(Text, nullable=False)
    image_url = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    building = relationship("BuildingDB", back_populates="floorplans")
    rooms = relationship(
        "RoomDB",
        back_populates="floorplan",
        cascade="all, delete-orphan",
    )
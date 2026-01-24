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

    # raw scans that might have room_id set (we’re not really using this now,
    # but keep it for backwards compatibility)
    scans = relationship("WifiScanDB", back_populates="room")

    # one room → many scan sessions
    scan_sessions = relationship(
        "ScanSessionDB",
        back_populates="room",
        cascade="all, delete-orphan",
    )

    # one room → many room_scan links
    room_scans = relationship(
        "RoomScanDB",
        back_populates="room",
        cascade="all, delete-orphan",
    )


class WifiScanDB(Base):
    __tablename__ = "wifi_scan"

    id = Column(BigInteger, primary_key=True, index=True)
    received_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    node = Column(Text)
    device_ts_ms = Column(BigInteger, index=True)
    ssid = Column(Text)
    bssid = Column(Text, index=True)
    rssi = Column(Integer)
    channel = Column(Integer)
    enc = Column(Text)

    # mostly NULL for your new flow; kept for old/manual tagging
    room_id = Column(
        Integer,
        ForeignKey("room.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    room = relationship("RoomDB", back_populates="scans")

    # NEW: link wifi_scan → room_scan rows
    room_scans = relationship(
        "RoomScanDB",
        back_populates="wifi_scan",
        cascade="all, delete-orphan",
    )


class ScanSessionDB(Base):
    __tablename__ = "scan_session"

    id = Column(Integer, primary_key=True, index=True)
    node = Column(Text, nullable=False)  # e.g. "ESP32-LAB-01"
    room_id = Column(
        Integer,
        ForeignKey("room.id", ondelete="CASCADE"),
        nullable=False,
    )
    started_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    ended_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    room = relationship("RoomDB", back_populates="scan_sessions")

    # one session → many room_scan links
    room_scans = relationship(
        "RoomScanDB",
        back_populates="session",
        cascade="all, delete-orphan",
    )


class RoomScanDB(Base):
    """
    Physical table linking a wifi_scan row to a room + session.

    One row here = "this scan was taken while scanning room X in session Y".
    """

    __tablename__ = "room_scan"

    id = Column(Integer, primary_key=True, index=True)

    wifi_scan_id = Column(
        BigInteger,
        ForeignKey("wifi_scan.id", ondelete="CASCADE"),
        nullable=False,
    )

    session_id = Column(
        Integer,
        ForeignKey("scan_session.id", ondelete="CASCADE"),
        nullable=False,
    )

    room_id = Column(
        Integer,
        ForeignKey("room.id", ondelete="CASCADE"),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # all these back_populates names MATCH the attributes above
    wifi_scan = relationship("WifiScanDB", back_populates="room_scans")
    session = relationship("ScanSessionDB", back_populates="room_scans")
    room = relationship("RoomDB", back_populates="room_scans")


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
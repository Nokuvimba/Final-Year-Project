# models.py
from sqlalchemy import (
    Column, Integer, BigInteger, String, Text,
    DateTime, ForeignKey
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from .database import Base


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


class RoomDB(Base):
    __tablename__ = "room"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text, nullable=False)
    floor = Column(Text, nullable=True)
    room_type = Column(Text, nullable=True)

    building_id = Column(
        Integer,
        ForeignKey("building.id", ondelete="CASCADE"),
        nullable=False,
    )

    building = relationship("BuildingDB", back_populates="rooms")
    scans = relationship("WifiScanDB", back_populates="room")


class WifiScanDB(Base):
    __tablename__ = "wifi_scan"   # matches your existing table

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

    room_id = Column(
        Integer,
        ForeignKey("room.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    room = relationship("RoomDB", back_populates="scans")
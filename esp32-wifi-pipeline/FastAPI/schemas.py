# schemas.py
from typing import Optional

from pydantic import BaseModel


class BuildingCreate(BaseModel):
    name: str
    description: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Engineering Block",
                "description": "Main labs and lecture rooms",
            }
        }


class BuildingUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class RoomCreate(BaseModel):
    name: str
    building_id: int
    floor: Optional[str] = None
    room_type: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Lab 1.12",
                "building_id": 1,
                "floor": "1st floor",
                "room_type": "laboratory",
            }
        }


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    building_id: Optional[int] = None
    floor: Optional[str] = None
    room_type: Optional[str] = None


class FloorPlanUrlCreate(BaseModel):
    building_id: int
    floor_name: str
    image_url: str

    class Config:
        json_schema_extra = {
            "example": {
                "building_id": 1,
                "floor_name": "Ground Floor",
                "image_url": "https://example.com/floorplan.png",
            }
        }
    
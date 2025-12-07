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
    
    
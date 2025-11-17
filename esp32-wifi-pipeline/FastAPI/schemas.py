from pydantic import BaseModel
from typing import Optional

class BuildingCreate(BaseModel):
    name: str
    description: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "name of building",
                "description": "add small description here"
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
                "name": "room name",
                "building_id": 1,
                "floor": "floor name/number",
                "room_type": "example laboratory"
            }
        }
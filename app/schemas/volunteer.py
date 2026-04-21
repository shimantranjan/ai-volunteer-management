from pydantic import BaseModel, Field
from typing import List


class Location(BaseModel):
    lat: float
    lon: float


class VolunteerCreate(BaseModel):
    name: str = Field(..., description="Volunteer Full Name")
    skills: List[str] = Field(..., description="List of skills")
    location: Location
    availability: bool = True


class VolunteerResponse(BaseModel):
    id: str
    name: str
    skills: List[str]
    location: Location
    availability: bool
from pydantic import BaseModel, ConfigDict, Field
from typing import List
from pydantic.functional_validators import BeforeValidator
from typing_extensions import Annotated

PyObjectId = Annotated[str, BeforeValidator(str)]

class Location(BaseModel):
    lat: float
    lon: float

class VolunteerCreate(BaseModel):
    name: str = Field(..., description="Volunteer Full Name")
    skills: List[str] = Field(..., description="List of skills the volunteer possesses")
    location: Location
    availability: bool = True

class VolunteerResponse(BaseModel):
    id: PyObjectId = Field(alias="_id")
    name: str
    skills: List[str]
    location: Location
    availability: bool

    model_config = ConfigDict(populate_by_name=True)

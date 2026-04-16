from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from app.schemas.volunteer import Location, PyObjectId

class TaskCreate(BaseModel):
    title: str
    required_skills: List[str]
    location: Location
    urgency: int = Field(ge=1, le=5, description="1 to 5 scale, 5 being most urgent")

class TaskResponse(BaseModel):
    id: PyObjectId = Field(alias="_id")
    title: str
    required_skills: List[str]
    location: Location
    urgency: int
    assigned_volunteer_id: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

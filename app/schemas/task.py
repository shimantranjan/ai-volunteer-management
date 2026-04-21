from pydantic import BaseModel, Field
from typing import List, Optional
from app.schemas.volunteer import Location


# ✅ Create Task Schema (Input)
class TaskCreate(BaseModel):
    title: str = Field(..., description="Task title")
    required_skills: List[str] = Field(..., description="Skills required for the task")
    location: Location
    urgency: int = Field(..., description="Urgency level (1-3)")


# ✅ Response Schema (Output)
class TaskResponse(BaseModel):
    id: str
    title: str
    required_skills: List[str]
    location: Location
    urgency: int
    assigned_volunteer_id: Optional[str] = None
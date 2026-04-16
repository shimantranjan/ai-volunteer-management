from fastapi import APIRouter, HTTPException
from typing import List
from app.schemas.volunteer import VolunteerCreate, VolunteerResponse
from app.database.database import volunteers_collection

router = APIRouter(tags=["Volunteers"])

@router.post("/volunteer", response_model=VolunteerResponse, status_code=201)
async def create_volunteer(volunteer: VolunteerCreate):
    try:
        new_volunteer = await volunteers_collection.insert_one(volunteer.model_dump())
        created_volunteer = await volunteers_collection.find_one({"_id": new_volunteer.inserted_id})
        return created_volunteer
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

@router.get("/volunteers", response_model=List[VolunteerResponse])
async def get_volunteers():
    try:
        volunteers = await volunteers_collection.find().to_list(1000)
        return volunteers
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

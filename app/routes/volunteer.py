from fastapi import APIRouter
from app.database.database import volunteers_collection
from app.core.response import success_response
from app.schemas.volunteer import VolunteerCreate
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# 🔹 Create volunteer
@router.post("/volunteer")
async def create_volunteer(volunteer: VolunteerCreate):
    logger.info(f"Adding new volunteer: {volunteer.name}")
    vol_dict = volunteer.model_dump()
    
    result = await volunteers_collection.insert_one(vol_dict)
    vol_dict["_id"] = str(result.inserted_id)

    return success_response(vol_dict, "Volunteer created successfully")


# 🔹 Get all volunteers
@router.get("/volunteers")
async def get_volunteers():
    logger.info("Fetching all volunteers")
    volunteers = await volunteers_collection.find().to_list(length=100)

    # Convert ObjectId to string
    for v in volunteers:
        v["_id"] = str(v["_id"])

    return success_response(volunteers, "Volunteers fetched successfully")
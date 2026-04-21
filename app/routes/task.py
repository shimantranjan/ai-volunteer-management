from fastapi import APIRouter, HTTPException
from bson import ObjectId
from bson.errors import InvalidId
import logging

from app.database.database import tasks_collection, volunteers_collection
from app.schemas.task import TaskCreate
from app.core.response import success_response
from app.services.matching import match_volunteers

logger = logging.getLogger(__name__)
router = APIRouter()


# ------------------------------
# 🔹 CREATE TASK
# ------------------------------
@router.post("/task")
async def create_task(task: TaskCreate):
    logger.info(f"Creating task: {task.title}")

    task_dict = task.model_dump()
    task_dict["assigned_volunteer_id"] = None

    result = await tasks_collection.insert_one(task_dict)

    task_dict["_id"] = str(result.inserted_id)

    return success_response(task_dict, "Task created successfully")


# ------------------------------
# 🔹 GET ALL TASKS
# ------------------------------
@router.get("/tasks")
async def get_tasks():
    tasks = await tasks_collection.find().to_list(length=100)

    for t in tasks:
        t["_id"] = str(t["_id"])

    return success_response(tasks, "Tasks fetched successfully")


# ------------------------------
# 🔹 MATCH PREVIEW (FIXED)
# ------------------------------
@router.get("/match-preview/{task_id}")
async def match_preview(task_id: str):
    logger.info(f"Match preview for task: {task_id}")

    task = None

    # 🔥 Try ObjectId first
    try:
        obj_id = ObjectId(task_id)
        task = await tasks_collection.find_one({"_id": obj_id})
    except InvalidId:
        pass

    # 🔥 Fallback: string ID
    if not task:
        task = await tasks_collection.find_one({"_id": task_id})

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task["_id"] = str(task["_id"])

    matches = await match_volunteers(task)

    if not matches or (isinstance(matches, dict) and "error" in matches):
        return success_response(
            {"task": task, "matches": []},
            "No suitable volunteers found"
        )

    return success_response(
        {"task": task, "matches": matches},
        "Match preview generated successfully"
    )


# ------------------------------
# 🔹 ASSIGN TASK (FINAL AI STEP)
# ------------------------------
@router.post("/assign-task/{task_id}")
async def assign_task(task_id: str):
    logger.info(f"Assigning task: {task_id}")

    task = None

    # 🔥 Try ObjectId
    try:
        obj_id = ObjectId(task_id)
        task = await tasks_collection.find_one({"_id": obj_id})
    except InvalidId:
        pass

    # 🔥 Fallback string ID
    if not task:
        task = await tasks_collection.find_one({"_id": task_id})

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # ❌ Already assigned
    if task.get("assigned_volunteer_id"):
        raise HTTPException(status_code=400, detail="Task already assigned")

    # 🔥 Run AI matching
    matches = await match_volunteers(task)

    if not matches or (isinstance(matches, dict) and "error" in matches):
        return success_response(
            {"matches": []},
            "No suitable volunteers found"
        )

    # ✅ Pick best match
    best = matches[0]
    best_id = best.get("id")

    # 🔥 Update task
    try:
        await tasks_collection.update_one(
            {"_id": task["_id"]},
            {"$set": {"assigned_volunteer_id": best_id}}
        )
    except Exception as e:
        logger.error(f"Task update error: {e}")

    # 🔥 Mark volunteer unavailable
    try:
        await volunteers_collection.update_one(
            {"_id": ObjectId(best_id)},
            {"$set": {"availability": False}}
        )
    except:
        # fallback if stored as string
        await volunteers_collection.update_one(
            {"_id": best_id},
            {"$set": {"availability": False}}
        )

    task["_id"] = str(task["_id"])
    task["assigned_volunteer_id"] = best_id

    return success_response(
        {
            "task": task,
            "assigned_volunteer": best,
            "all_matches": matches
        },
        "Task assigned successfully"
    )
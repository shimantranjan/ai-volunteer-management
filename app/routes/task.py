from fastapi import APIRouter, HTTPException
from typing import List
from app.schemas.task import TaskCreate, TaskResponse
from app.database.database import tasks_collection
from app.services.matching import assign_best_volunteer

router = APIRouter(tags=["Tasks"])

@router.post("/task", response_model=TaskResponse, status_code=201)
async def create_task(task: TaskCreate):
    try:
        task_dict = task.model_dump()
        task_dict["assigned_volunteer_id"] = None
        new_task = await tasks_collection.insert_one(task_dict)
        created_task = await tasks_collection.find_one({"_id": new_task.inserted_id})
        return created_task
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

@router.get("/tasks", response_model=List[TaskResponse])
async def get_tasks():
    try:
        tasks = await tasks_collection.find().to_list(1000)
        return tasks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

@router.post("/assign-task/{task_id}")
async def assign_task(task_id: str):
    try:
        assigned_volunteer = await assign_best_volunteer(task_id)
        if not assigned_volunteer:
            raise HTTPException(status_code=404, detail="No suitable volunteer found, or task not found/already assigned.")
        return {"message": "Task assigned successfully", "volunteer": assigned_volunteer}
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

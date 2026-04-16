import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")

client = AsyncIOMotorClient(MONGO_URL)
database = client.volunteer_db

volunteers_collection = database.get_collection("volunteers")
tasks_collection = database.get_collection("tasks")

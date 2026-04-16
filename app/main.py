from fastapi import FastAPI
from app.routes import volunteer, task

app = FastAPI(
    title="AI Volunteer Coordination System",
    description="API for registering volunteers and assigning them to tasks based on AI matching logic.",
    version="1.0.0"
)

app.include_router(volunteer.router)
app.include_router(task.router)

@app.get("/")
async def root():
    return {"message": "Welcome to the AI Volunteer Coordination System API. Visit /docs for Swagger UI."}

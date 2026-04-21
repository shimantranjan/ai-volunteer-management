from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.routes import volunteer, task
from app.core.response import error_response, success_response
import logging

# Set up logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Volunteer Coordination System",
    description="API for registering volunteers and assigning them to tasks based on AI matching logic.",
    version="1.0.0"
)

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.warning(f"HTTPException: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(message=str(exc.detail))
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation Exception: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content=error_response(message="Data validation error", data=exc.errors())
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content=error_response(message="Internal server error")
    )

app.include_router(volunteer.router)
app.include_router(task.router)

@app.get("/")
async def root():
    return success_response(data=None, message="Welcome to the AI Volunteer Coordination System API. Visit /docs for Swagger UI.")

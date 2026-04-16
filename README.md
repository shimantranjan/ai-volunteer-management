# AI-Powered Volunteer Coordination System

A complete FastAPI backend capable of registering volunteers, handling assignments, and employing a basic AI-like heuristic to match the best-suited volunteer to an available task based on location, skills, and availability.

## Prerequisites
- **Python 3.9+**
- **MongoDB** running locally (`localhost:27017`) or configure via `MONGO_URL` env variable.

## Setup Instructions

1. Install requirements
```bash
pip install -r requirements.txt
```

2. Run the server
```bash
uvicorn app.main:app --reload
```

## Features

- RESTful interface supporting comprehensive validations scaling via **Pydantic**.
- MongoDB asynchronous operations handled uniformly via **Motor**.

## API Endpoints

- `POST /volunteer` : Register a new volunteer.
- `GET /volunteers` : Retrieve a list of all registered volunteers.
- `POST /task` : Post a new task requiring volunteer help.
- `GET /tasks` : Retrieve all tasks.
- `POST /assign-task/{task_id}` : Matches and assigns the best possible volunteer to a task utilizing:
    - **Skill Set overlap (Highest Variable)**
    - **Physical Geographic Proximity (Haversine Logic)**
    - **Available status verification**

Swagger Interactive UI automatically exposed at: [http://localhost:8000/docs](http://localhost:8000/docs)

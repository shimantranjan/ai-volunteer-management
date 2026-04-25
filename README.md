# AI Volunteer Management System

[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Netlify](https://img.shields.io/badge/Netlify-Deploy-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://www.netlify.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-Frontend-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

AI Volunteer Management System is a full-stack coordination platform for registering volunteers, creating urgent community tasks, previewing AI-ranked volunteer matches, and assigning the best available person based on skills, location, availability, and task urgency.

The project includes a polished responsive frontend, a FastAPI backend for local development, and a Netlify Functions API for production deployment.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [Netlify Deployment](#netlify-deployment)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [AI Matching Logic](#ai-matching-logic)
- [Demo Flow](#demo-flow)
- [Author](#author)

## Overview

During emergencies, volunteer coordinators often need to answer one question quickly: who is the best person to send?

This system helps solve that problem by combining:

- Volunteer skill profiles
- Live availability
- Task urgency
- Geographic proximity
- Explainable match scoring

The frontend is designed as a command center dashboard, with animated metrics, volunteer and task intake forms, AI match previews, and one-click assignment.

## Key Features

- Register volunteers with skills, location, and availability.
- Create tasks with required skills, coordinates, and urgency.
- Preview top AI-ranked volunteer matches before assigning.
- Assign the best volunteer and automatically update availability.
- View transparent score breakdowns for skill, distance, availability, and urgency.
- Use an animated responsive dashboard for hackathon demos.
- Switch between light and dark themes.
- Fall back to demo data when the API is unavailable.
- Deploy the frontend and API together on Netlify.
- Run the original FastAPI backend locally for Swagger documentation and development.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, JavaScript |
| Local Backend | FastAPI, Pydantic, Motor |
| Production API | Netlify Functions, Node.js |
| Database | MongoDB or MongoDB Atlas |
| Deployment | Netlify |
| Matching Logic | Weighted heuristic scoring with Haversine distance |

## Architecture

```text
Frontend Dashboard
       |
       | Local development
       v
FastAPI Backend -------------- MongoDB

Frontend Dashboard
       |
       | Production on Netlify
       v
Netlify Functions API -------- MongoDB Atlas
```

The same user experience works in both modes:

- Locally, the frontend can call `http://localhost:8000`.
- On Netlify, the frontend automatically calls `/api`.

## Project Structure

```text
ai-volunteer-management/
|-- app/
|   |-- core/
|   |-- database/
|   |-- integrations/
|   |-- routes/
|   |-- schemas/
|   |-- services/
|   |-- utils/
|   `-- main.py
|-- frontend/
|   |-- index.html
|   |-- styles.css
|   `-- app.js
|-- netlify/
|   `-- functions/
|       `-- api.js
|-- .env.example
|-- netlify.toml
|-- package.json
|-- requirements.txt
`-- README.md
```

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/shimantranjan/ai-volunteer-management.git
cd ai-volunteer-management
```

### 2. Create environment file

```bash
cp .env.example .env
```

Update the MongoDB connection string in `.env` if you are not using local MongoDB.

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 4. Start MongoDB

Use either local MongoDB:

```text
mongodb://localhost:27017
```

Or MongoDB Atlas with `MONGO_URL`.

### 5. Run the FastAPI backend

```bash
uvicorn app.main:app --reload
```

### 6. Open the app

```text
http://localhost:8000/app
```

Swagger API documentation is available at:

```text
http://localhost:8000/docs
```

## Netlify Deployment

This repository is configured for Netlify deployment.

### Netlify settings

```text
Build command: leave empty
Publish directory: frontend
Functions directory: netlify/functions
```

The `netlify.toml` file already includes:

- Static frontend publishing from `frontend/`
- Serverless API routing from `/api/*`
- Single-page app fallback to `index.html`

### Required Netlify environment variables

```text
MONGO_URL=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/volunteer_db
MONGO_DB_NAME=volunteer_db
```

After deployment, the frontend will call the production API through `/api`.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGO_URL` | Yes | MongoDB connection string. Use MongoDB Atlas for Netlify deployment. |
| `MONGO_DB_NAME` | No | Database name. Defaults to `volunteer_db` in Netlify Functions. |
| `MONGO_TIMEOUT_MS` | No | FastAPI MongoDB timeout in milliseconds. Defaults to `2500`. |

## API Reference

### Health check

```http
GET /
```

Netlify:

```http
GET /api
```

### Create volunteer

```http
POST /volunteer
```

Netlify:

```http
POST /api/volunteer
```

Example body:

```json
{
  "name": "Aarav Sharma",
  "skills": ["medical", "first aid", "driving"],
  "location": {
    "lat": 28.6139,
    "lon": 77.209
  },
  "availability": true
}
```

### Get volunteers

```http
GET /volunteers
```

Netlify:

```http
GET /api/volunteers
```

### Create task

```http
POST /task
```

Netlify:

```http
POST /api/task
```

Example body:

```json
{
  "title": "Deliver medical supplies",
  "required_skills": ["medical", "driving"],
  "location": {
    "lat": 28.5355,
    "lon": 77.391
  },
  "urgency": 3
}
```

### Get tasks

```http
GET /tasks
```

Netlify:

```http
GET /api/tasks
```

### Preview matches

```http
GET /match-preview/{task_id}
```

Netlify:

```http
GET /api/match-preview/{task_id}
```

### Assign best volunteer

```http
POST /assign-task/{task_id}
```

Netlify:

```http
POST /api/assign-task/{task_id}
```

## AI Matching Logic

The matching engine ranks volunteers using weighted scoring:

| Factor | Weight | Description |
| --- | ---: | --- |
| Skill match | 50% | Compares volunteer skills with required task skills. |
| Distance | 20% | Uses Haversine distance between volunteer and task coordinates. |
| Availability | 10% | Prioritizes volunteers currently marked available. |
| Urgency | 20% | Gives higher priority to urgent tasks. |

Each match response includes:

- Overall score
- Confidence percentage
- Distance in kilometers
- Human-readable reasons
- Google Maps route link
- Score breakdown by factor

## Demo Flow

Use this flow for a hackathon presentation:

1. Open the dashboard.
2. Register two or three volunteers with different skills.
3. Create an urgent task with required skills.
4. Click `Preview matches`.
5. Explain the confidence score and score breakdown.
6. Click `Assign best`.
7. Show that the task is assigned and the volunteer availability changes.

If MongoDB or the API is unavailable, click `Demo data` in the frontend to present the interface with sample data.

## Author

Built by [Shimantranjan](https://github.com/shimantranjan).

## License

This project is intended for learning, hackathon demonstrations, and community-impact prototypes.

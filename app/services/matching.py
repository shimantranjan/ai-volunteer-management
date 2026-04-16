from app.database.database import volunteers_collection
import math


# 🔹 CONFIG (Dynamic weights — easy to tweak)
WEIGHTS = {
    "skill": 0.5,
    "distance": 0.2,
    "availability": 0.1,
    "urgency": 0.2
}


# 🔹 1. Distance Calculation (Haversine)
def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371.0

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# 🔹 2. Normalize score (0 → 1)
def normalize(value, max_value):
    if max_value == 0:
        return 0
    return value / max_value


# 🔹 3. Skill Score
def skill_score(volunteer, task):
    skills_v = set(volunteer.get("skills", []))
    skills_t = set(task.get("required_skills", []))

    match = len(skills_v & skills_t)
    return normalize(match, len(skills_t) if skills_t else 1)


# 🔹 4. Distance Score (closer = better)
def distance_score(distance):
    if distance == 0:
        return 1

    if distance < 2:
        return 1
    elif distance < 5:
        return 0.8
    elif distance < 10:
        return 0.5
    else:
        return 0.2


# 🔹 5. Availability Score
def availability_score(volunteer):
    return 1 if volunteer.get("availability", False) else 0


# 🔹 6. Urgency Score (Disaster Mode)
def urgency_score(task):
    urgency = task.get("urgency", 1)

    if urgency >= 3:
        return 1
    elif urgency == 2:
        return 0.6
    return 0.3


# 🔹 7. Final Score Aggregation
def calculate_final_score(volunteer, task):
    v_loc = volunteer.get("location", {})
    t_loc = task.get("location", {})

    distance = calculate_distance(
        v_loc.get("lat", 0),
        v_loc.get("lon", 0),
        t_loc.get("lat", 0),
        t_loc.get("lon", 0)
    )

    s_score = skill_score(volunteer, task)
    d_score = distance_score(distance)
    a_score = availability_score(volunteer)
    u_score = urgency_score(task)

    final_score = (
        s_score * WEIGHTS["skill"]
        + d_score * WEIGHTS["distance"]
        + a_score * WEIGHTS["availability"]
        + u_score * WEIGHTS["urgency"]
    )

    confidence = round(final_score * 100, 2)

    return {
        "score": round(final_score, 3),
        "confidence": confidence,
        "distance": round(distance, 2),
        "breakdown": {
            "skill": round(s_score, 2),
            "distance": round(d_score, 2),
            "availability": a_score,
            "urgency": u_score
        }
    }


# 🔹 8. Explainable AI (Detailed)
def generate_reason(breakdown):
    reasons = []

    if breakdown["skill"] > 0:
        reasons.append("Skills matched")

    if breakdown["distance"] >= 0.8:
        reasons.append("Very close to task")

    if breakdown["availability"] == 1:
        reasons.append("Currently available")

    if breakdown["urgency"] == 1:
        reasons.append("High priority task")

    return reasons


# 🔹 9. Ranking Engine
def get_top_volunteers(volunteers, task):
    scored = []

    for v in volunteers:
        result = calculate_final_score(v, task)

        reasons = generate_reason(result["breakdown"])

        scored.append({
            "id": str(v["_id"]),
            "name": v.get("name"),
            "skills": v.get("skills"),
            "score": result["score"],
            "confidence": result["confidence"],
            "distance_km": result["distance"],
            "reasons": reasons,
            "breakdown": result["breakdown"]
        })

    # Sort by score
    scored.sort(key=lambda x: x["score"], reverse=True)

    return scored[:3]


# 🔹 10. Main Matching Function
def match_volunteers(task):
    volunteers = list(volunteers_collection.find({"availability": True}))

    if not volunteers:
        return {"error": "No available volunteers"}

    top_matches = get_top_volunteers(volunteers, task)

    return top_matches
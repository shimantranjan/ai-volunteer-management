import logging
from app.database.database import volunteers_collection
from app.utils.geo import haversine
from app.core.config import WEIGHTS, MAX_DISTANCE_KM, TOP_K
from app.integrations.maps import generate_map_link

logger = logging.getLogger(__name__)

# 🔹 Normalize helper
def normalize(value, max_value):
    if not max_value or max_value <= 0:
        return 0
    return value / max_value


# 🔹 Skill Score
def skill_score(volunteer, task):
    skills_v = set((volunteer.get("skills") or []))
    skills_t = set((task.get("required_skills") or []))

    if not skills_t:
        return 1.0  # If no skills required, it's a perfect match for skills

    match = len(skills_v & skills_t)
    return normalize(match, len(skills_t))


# 🔹 Distance Score
def distance_score(distance):
    if distance <= 2:
        return 1.0
    elif distance <= 5:
        return 0.8
    elif distance <= 10:
        return 0.5
    elif distance <= 25:
        return 0.2
    return 0.1


# 🔹 Availability Score
def availability_score(volunteer):
    return 1.0 if volunteer.get("availability", False) else 0.0


# 🔹 Urgency Score
def urgency_score(task):
    urgency = task.get("urgency", 1)
    if urgency >= 4:
        return 1.0
    elif urgency == 3:
        return 0.8
    elif urgency == 2:
        return 0.5
    return 0.3


# 🔹 Final Scoring Engine
def calculate_final_score(volunteer, task):
    v_loc = volunteer.get("location") or {}
    t_loc = task.get("location") or {}

    lat1 = v_loc.get("lat")
    lon1 = v_loc.get("lon")
    lat2 = t_loc.get("lat")
    lon2 = t_loc.get("lon")

    if lat1 is not None and lon1 is not None and lat2 is not None and lon2 is not None:
        distance = haversine(lat1, lon1, lat2, lon2)
    else:
        # Default high distance if coordinates are missing to penalize
        distance = MAX_DISTANCE_KM + 1

    # 🔥 Filter far volunteers unless task has no location
    if distance > MAX_DISTANCE_KM and (lat2 is not None and lon2 is not None):
        return None

    s_score = skill_score(volunteer, task)
    d_score = distance_score(distance) if (lat1 is not None and lat2 is not None) else 0.0
    a_score = availability_score(volunteer)
    u_score = urgency_score(task)

    final_score = (
        s_score * WEIGHTS.get("skill", 0.5)
        + d_score * WEIGHTS.get("distance", 0.2)
        + a_score * WEIGHTS.get("availability", 0.1)
        + u_score * WEIGHTS.get("urgency", 0.2)
    )

    # Normalize final score strictly between 0 and 1 incase weights don't sum to 1 perfectly
    total_weights = sum(WEIGHTS.values())
    if total_weights > 0:
        final_score = final_score / total_weights

    # Dynamic confidence scoring
    confidence = min(round(final_score * 100, 2), 100.0)

    return {
        "score": round(final_score, 3),
        "confidence": confidence,
        "distance": round(distance, 2) if (lat1 is not None and lat2 is not None) else -1,
        "breakdown": {
            "skill": round(s_score, 3),
            "distance": round(d_score, 3),
            "availability": round(a_score, 3),
            "urgency": round(u_score, 3)
        }
    }


# 🔹 Explainable AI
def generate_reason(breakdown, distance):
    reasons = []

    if breakdown["skill"] == 1.0:
        reasons.append("Perfect skill match")
    elif breakdown["skill"] >= 0.5:
        reasons.append("Partial skill match")

    if distance != -1 and distance <= 5:
        reasons.append("Very close location")

    if breakdown["availability"] == 1.0:
        reasons.append("Currently available")

    if breakdown["urgency"] >= 0.8:
        reasons.append("Suited for high urgency")

    return reasons if reasons else ["General match"]


# 🔹 Ranking Engine (Top K)
def get_top_volunteers(volunteers, task):
    scored = []

    for v in volunteers:
        result = calculate_final_score(v, task)

        if result is None:
            continue

        reasons = generate_reason(result["breakdown"], result["distance"])

        v_loc = v.get("location") or {}
        t_loc = task.get("location") or {}
        
        map_link = None
        if v_loc.get("lat") and t_loc.get("lat"):
            map_link = generate_map_link(t_loc, v_loc)

        scored.append({
            "id": str(v["_id"]),
            "name": v.get("name", "Unknown"),
            "skills": v.get("skills", []),
            "score": result["score"],
            "confidence": result["confidence"],
            "distance_km": result["distance"],
            "reasons": reasons,
            "map_link": map_link,
            "breakdown": result["breakdown"]
        })

    # Sort best → worst
    scored.sort(key=lambda x: x["score"], reverse=True)

    return scored[:TOP_K]


# 🔹 Main Matching Function (ASYNC FIXED)
async def match_volunteers(task):
    logger.info("Executing match_volunteers engine")
    volunteers = await volunteers_collection.find(
        {"availability": True}
    ).to_list(length=200)  # slightly larger pool

    if not volunteers:
        logger.warning("No available volunteers found in DB.")
        return {"error": "No available volunteers"}

    top_matches = get_top_volunteers(volunteers, task)
    logger.info(f"Found {len(top_matches)} matches for task.")

    return top_matches
# app/core/config.py

# 🔹 AI Weight Configuration (tunable system)
WEIGHTS = {
    "skill": 0.5,
    "distance": 0.2,
    "availability": 0.1,
    "urgency": 0.2
}

# 🔹 Matching Constraints
MAX_DISTANCE_KM = 50   # ignore volunteers beyond this
TOP_K = 3              # number of recommendations

# 🔹 System Flags (future ready)
ENABLE_CACHE = True
ENABLE_DISASTER_MODE = True

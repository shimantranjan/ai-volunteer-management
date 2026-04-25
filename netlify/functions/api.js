const { MongoClient, ObjectId } = require("mongodb");

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.MONGO_DB_NAME || "volunteer_db";
const WEIGHTS = { skill: 0.5, distance: 0.2, availability: 0.1, urgency: 0.2 };
const MAX_DISTANCE_KM = 50;
const TOP_K = 3;

let cachedClient;

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const { method, pathParts } = normalizeRequest(event);

    if (method === "GET" && pathParts.length === 0) {
      return success(null, "AI Volunteer Netlify API is running");
    }

    if (!MONGO_URL) {
      return error(500, "MONGO_URL is not configured in Netlify environment variables");
    }

    if (method === "POST" && pathParts[0] === "volunteer" && pathParts.length === 1) {
      return createVolunteer(event);
    }

    if (method === "GET" && pathParts[0] === "volunteers" && pathParts.length === 1) {
      return getVolunteers();
    }

    if (method === "POST" && pathParts[0] === "task" && pathParts.length === 1) {
      return createTask(event);
    }

    if (method === "GET" && pathParts[0] === "tasks" && pathParts.length === 1) {
      return getTasks();
    }

    if (method === "GET" && pathParts[0] === "match-preview" && pathParts[1]) {
      return matchPreview(pathParts[1]);
    }

    if (method === "POST" && pathParts[0] === "assign-task" && pathParts[1]) {
      return assignTask(pathParts[1]);
    }

    return error(404, "Endpoint not found");
  } catch (err) {
    return error(err.statusCode || 500, err.message || "Internal server error");
  }
};

function normalizeRequest(event) {
  const rawPath = event.path || "";
  const cleanPath = rawPath
    .replace(/^\/\.netlify\/functions\/api/, "")
    .replace(/^\/api/, "")
    .replace(/^\/+|\/+$/g, "");

  return {
    method: event.httpMethod,
    pathParts: cleanPath ? cleanPath.split("/").map(decodeURIComponent) : [],
  };
}

async function getDb() {
  if (!cachedClient) {
    cachedClient = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 2500 });
    await cachedClient.connect();
  }
  return cachedClient.db(DB_NAME);
}

async function collections() {
  const db = await getDb();
  return {
    volunteers: db.collection("volunteers"),
    tasks: db.collection("tasks"),
  };
}

async function createVolunteer(event) {
  const payload = parseJson(event.body);
  const volunteer = {
    name: requireString(payload.name, "name"),
    skills: requireStringList(payload.skills, "skills"),
    location: requireLocation(payload.location),
    availability: payload.availability !== false,
  };

  const { volunteers } = await collections();
  const result = await volunteers.insertOne(volunteer);
  return success({ ...volunteer, _id: String(result.insertedId) }, "Volunteer created successfully");
}

async function getVolunteers() {
  const { volunteers } = await collections();
  const docs = await volunteers.find().limit(100).toArray();
  return success(docs.map(serializeDoc), "Volunteers fetched successfully");
}

async function createTask(event) {
  const payload = parseJson(event.body);
  const task = {
    title: requireString(payload.title, "title"),
    required_skills: requireStringList(payload.required_skills, "required_skills"),
    location: requireLocation(payload.location),
    urgency: requireUrgency(payload.urgency),
    assigned_volunteer_id: null,
  };

  const { tasks } = await collections();
  const result = await tasks.insertOne(task);
  return success({ ...task, _id: String(result.insertedId) }, "Task created successfully");
}

async function getTasks() {
  const { tasks } = await collections();
  const docs = await tasks.find().limit(100).toArray();
  return success(docs.map(serializeDoc), "Tasks fetched successfully");
}

async function matchPreview(taskId) {
  const { tasks, volunteers } = await collections();
  const task = await findByFlexibleId(tasks, taskId);

  if (!task) {
    return error(404, "Task not found");
  }

  const matches = await matchVolunteers(volunteers, task);
  return success(
    { task: serializeDoc(task), matches },
    matches.length ? "Match preview generated successfully" : "No suitable volunteers found",
  );
}

async function assignTask(taskId) {
  const { tasks, volunteers } = await collections();
  const task = await findByFlexibleId(tasks, taskId);

  if (!task) {
    return error(404, "Task not found");
  }

  if (task.assigned_volunteer_id) {
    return error(400, "Task already assigned");
  }

  const matches = await matchVolunteers(volunteers, task);
  if (!matches.length) {
    return success({ matches: [] }, "No suitable volunteers found");
  }

  const best = matches[0];
  await tasks.updateOne({ _id: task._id }, { $set: { assigned_volunteer_id: best.id } });
  await updateVolunteerAvailability(volunteers, best.id, false);

  const updatedTask = { ...task, assigned_volunteer_id: best.id };
  return success(
    {
      task: serializeDoc(updatedTask),
      assigned_volunteer: best,
      all_matches: matches,
    },
    "Task assigned successfully",
  );
}

async function matchVolunteers(volunteersCollection, task) {
  const volunteers = await volunteersCollection.find({ availability: true }).limit(200).toArray();
  return volunteers
    .map((volunteer) => scoreVolunteer(volunteer, task))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}

function scoreVolunteer(volunteer, task) {
  const distance = calculateDistance(volunteer.location, task.location);
  if (distance > MAX_DISTANCE_KM) return null;

  const skill = skillScore(volunteer.skills, task.required_skills);
  const distanceValue = distanceScore(distance);
  const availability = volunteer.availability ? 1 : 0;
  const urgency = urgencyScore(task.urgency);
  const score =
    skill * WEIGHTS.skill +
    distanceValue * WEIGHTS.distance +
    availability * WEIGHTS.availability +
    urgency * WEIGHTS.urgency;
  const confidence = Math.min(Number((score * 100).toFixed(2)), 100);

  return {
    id: String(volunteer._id),
    name: volunteer.name || "Unknown",
    skills: volunteer.skills || [],
    score: Number(score.toFixed(3)),
    confidence,
    distance_km: Number(distance.toFixed(2)),
    reasons: getReasons(skill, distance, availability, urgency),
    map_link: generateMapLink(task.location, volunteer.location),
    breakdown: {
      skill: Number(skill.toFixed(3)),
      distance: Number(distanceValue.toFixed(3)),
      availability,
      urgency,
    },
  };
}

function skillScore(volunteerSkills = [], taskSkills = []) {
  if (!taskSkills.length) return 1;
  const normalized = new Set(volunteerSkills.map((skill) => String(skill).toLowerCase()));
  const matches = taskSkills.filter((skill) => normalized.has(String(skill).toLowerCase()));
  return matches.length / taskSkills.length;
}

function distanceScore(distance) {
  if (distance <= 2) return 1;
  if (distance <= 5) return 0.8;
  if (distance <= 10) return 0.5;
  if (distance <= 25) return 0.2;
  return 0.1;
}

function urgencyScore(urgency = 1) {
  if (urgency >= 4) return 1;
  if (urgency === 3) return 0.8;
  if (urgency === 2) return 0.5;
  return 0.3;
}

function getReasons(skill, distance, availability, urgency) {
  const reasons = [];
  if (skill === 1) reasons.push("Perfect skill match");
  else if (skill >= 0.5) reasons.push("Partial skill match");
  if (distance <= 5) reasons.push("Very close location");
  if (availability) reasons.push("Currently available");
  if (urgency >= 0.8) reasons.push("Suited for high urgency");
  return reasons.length ? reasons : ["General match"];
}

function calculateDistance(a = {}, b = {}) {
  const lat1 = Number(a.lat);
  const lon1 = Number(a.lon);
  const lat2 = Number(b.lat);
  const lon2 = Number(b.lon);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
    return MAX_DISTANCE_KM + 1;
  }

  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function generateMapLink(taskLocation = {}, volunteerLocation = {}) {
  const tLat = taskLocation.lat;
  const tLon = taskLocation.lon;
  const vLat = volunteerLocation.lat;
  const vLon = volunteerLocation.lon;

  if (![tLat, tLon, vLat, vLon].every((value) => Number.isFinite(Number(value)))) {
    return null;
  }

  return `https://www.google.com/maps/dir/${vLat},${vLon}/${tLat},${tLon}`;
}

async function findByFlexibleId(collection, id) {
  if (ObjectId.isValid(id)) {
    const objectDoc = await collection.findOne({ _id: new ObjectId(id) });
    if (objectDoc) return objectDoc;
  }
  return collection.findOne({ _id: id });
}

async function updateVolunteerAvailability(collection, id, availability) {
  if (ObjectId.isValid(id)) {
    const objectResult = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { availability } },
    );
    if (objectResult.matchedCount) return;
  }
  await collection.updateOne({ _id: id }, { $set: { availability } });
}

function parseJson(body) {
  try {
    return body ? JSON.parse(body) : {};
  } catch (err) {
    const invalid = new Error("Invalid JSON body");
    invalid.statusCode = 400;
    throw invalid;
  }
}

function requireString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    const err = new Error(`${field} is required`);
    err.statusCode = 422;
    throw err;
  }
  return value.trim();
}

function requireStringList(value, field) {
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== "string")) {
    const err = new Error(`${field} must be a non-empty string array`);
    err.statusCode = 422;
    throw err;
  }
  const cleaned = value.map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!cleaned.length) {
    const err = new Error(`${field} must be a non-empty string array`);
    err.statusCode = 422;
    throw err;
  }
  return cleaned;
}

function requireLocation(value = {}) {
  const lat = Number(value.lat);
  const lon = Number(value.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const err = new Error("location.lat and location.lon are required numbers");
    err.statusCode = 422;
    throw err;
  }
  return { lat, lon };
}

function requireUrgency(value) {
  const urgency = Number(value);
  if (!Number.isInteger(urgency) || urgency < 1) {
    const err = new Error("urgency must be a positive integer");
    err.statusCode = 422;
    throw err;
  }
  return urgency;
}

function serializeDoc(doc) {
  if (!doc) return doc;
  return { ...doc, _id: String(doc._id) };
}

function success(data, message = "Success") {
  return json(200, { success: true, message, data });
}

function error(statusCode, message, data = null) {
  return json(statusCode, { success: false, message, data });
}

function json(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

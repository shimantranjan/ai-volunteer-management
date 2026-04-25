const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const defaultApiBase =
  window.location.port === "8000"
    ? window.location.origin
    : isLocalHost
      ? "http://localhost:8000"
      : "/api";

const demoVolunteers = [
  {
    _id: "demo-v-1",
    name: "Aarav Sharma",
    skills: ["medical", "first aid", "driving"],
    location: { lat: 28.6139, lon: 77.209 },
    availability: true,
  },
  {
    _id: "demo-v-2",
    name: "Meera Iyer",
    skills: ["logistics", "crowd control", "translation"],
    location: { lat: 28.4595, lon: 77.0266 },
    availability: true,
  },
  {
    _id: "demo-v-3",
    name: "Kabir Khan",
    skills: ["cooking", "shelter", "inventory"],
    location: { lat: 28.7041, lon: 77.1025 },
    availability: true,
  },
  {
    _id: "demo-v-4",
    name: "Nisha Rao",
    skills: ["medical", "counseling", "triage"],
    location: { lat: 28.5355, lon: 77.391 },
    availability: false,
  },
];

const demoTasks = [
  {
    _id: "demo-t-1",
    title: "Deliver medical supplies",
    required_skills: ["medical", "driving"],
    location: { lat: 28.5355, lon: 77.391 },
    urgency: 3,
    assigned_volunteer_id: null,
  },
  {
    _id: "demo-t-2",
    title: "Set up relief inventory desk",
    required_skills: ["logistics", "inventory"],
    location: { lat: 28.65, lon: 77.23 },
    urgency: 2,
    assigned_volunteer_id: null,
  },
  {
    _id: "demo-t-3",
    title: "Guide displaced families",
    required_skills: ["translation", "crowd control"],
    location: { lat: 28.4744, lon: 77.504 },
    urgency: 3,
    assigned_volunteer_id: null,
  },
];

const state = {
  apiBase: localStorage.getItem("avms-api-base") || defaultApiBase,
  apiOnline: false,
  demoMode: false,
  selectedTaskId: "",
  selectedMatches: [],
  filter: "all",
  volunteers: [],
  tasks: [],
};

const els = {
  apiBaseInput: document.querySelector("#apiBaseInput"),
  apiDot: document.querySelector("#apiDot"),
  apiStatus: document.querySelector("#apiStatus"),
  modePill: document.querySelector("#modePill"),
  availableCount: document.querySelector("#availableCount"),
  openTaskCount: document.querySelector("#openTaskCount"),
  assignedCount: document.querySelector("#assignedCount"),
  avgScore: document.querySelector("#avgScore"),
  volunteerTotal: document.querySelector("#volunteerTotal"),
  taskTotal: document.querySelector("#taskTotal"),
  volunteerList: document.querySelector("#volunteerList"),
  taskList: document.querySelector("#taskList"),
  taskSelect: document.querySelector("#taskSelect"),
  matchSummary: document.querySelector("#matchSummary"),
  selectedTaskLabel: document.querySelector("#selectedTaskLabel"),
  canvas: document.querySelector("#cityCanvas"),
  toastStack: document.querySelector("#toastStack"),
};

function cleanList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getId(item) {
  return item?._id || item?.id || "";
}

function getSelectedTask() {
  return state.tasks.find((task) => getId(task) === state.selectedTaskId);
}

function apiUrl(path) {
  return `${state.apiBase.replace(/\/$/, "")}${path}`;
}

async function request(path, options = {}) {
  const { timeout = 4500, headers = {}, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(apiUrl(path), {
      headers: { "Content-Type": "application/json", ...headers },
      signal: controller.signal,
      ...fetchOptions,
    }).catch((error) => {
      if (error.name === "AbortError") {
        throw new Error("API request timed out");
      }
      throw error;
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(payload.message || `Request failed: ${response.status}`);
    }
    return payload.data ?? payload;
  } finally {
    window.clearTimeout(timer);
  }
}

function setApiStatus(online, message) {
  state.apiOnline = online;
  els.apiDot.classList.toggle("online", online);
  els.apiDot.classList.toggle("offline", !online);
  els.apiStatus.textContent = message;
  els.modePill.textContent = state.demoMode ? "Demo mode" : online ? "Live API" : "Offline demo";
}

function useDemoData(showToast = true) {
  state.demoMode = true;
  state.volunteers = structuredClone(demoVolunteers);
  state.tasks = structuredClone(demoTasks);
  state.selectedTaskId = state.tasks[0]?._id || "";
  state.selectedMatches = getLocalMatches(getSelectedTask());
  setApiStatus(false, "Demo data active");
  renderAll();
  if (showToast) toast("Demo data loaded", "The interface is ready for a smooth offline presentation.");
}

async function loadData({ quiet = false } = {}) {
  state.demoMode = false;
  try {
    const [volunteers, tasks] = await Promise.all([request("/volunteers"), request("/tasks")]);
    state.volunteers = Array.isArray(volunteers) ? volunteers : [];
    state.tasks = Array.isArray(tasks) ? tasks : [];
    if (!state.selectedTaskId && state.tasks.length) state.selectedTaskId = getId(state.tasks[0]);
    setApiStatus(true, "API connected");
    await previewMatches({ quiet: true });
    renderAll();
    if (!quiet) toast("Live data refreshed", "Volunteers, tasks, and match scores are up to date.");
  } catch (error) {
    useDemoData(false);
    if (!quiet) toast("API unavailable", "Showing demo data. Start FastAPI and MongoDB for live mode.");
  }
}

function renderAll() {
  renderMetrics();
  renderTaskSelect();
  renderVolunteers();
  renderTasks();
  renderMatches();
  drawOnce();
}

function renderMetrics() {
  const available = state.volunteers.filter((volunteer) => volunteer.availability).length;
  const openTasks = state.tasks.filter((task) => !task.assigned_volunteer_id).length;
  const assigned = state.tasks.length - openTasks;
  const topScore = state.selectedMatches[0]?.confidence;

  els.availableCount.textContent = available;
  els.openTaskCount.textContent = openTasks;
  els.assignedCount.textContent = assigned;
  els.avgScore.textContent = Number.isFinite(topScore) ? `${Math.round(topScore)}%` : "--";
  els.volunteerTotal.textContent = `${state.volunteers.length} total`;
  els.taskTotal.textContent = `${state.tasks.length} total`;
}

function renderTaskSelect() {
  const options = ['<option value="">Select a task</option>']
    .concat(
      state.tasks.map((task) => {
        const selected = getId(task) === state.selectedTaskId ? "selected" : "";
        return `<option value="${escapeHtml(getId(task))}" ${selected}>${escapeHtml(task.title)}</option>`;
      }),
    )
    .join("");
  els.taskSelect.innerHTML = options;
  const selected = getSelectedTask();
  els.selectedTaskLabel.textContent = selected ? selected.title : "No task selected";
}

function renderVolunteers() {
  const volunteers = state.volunteers.filter((volunteer) => {
    if (state.filter !== "available") return true;
    return volunteer.availability;
  });

  els.volunteerList.innerHTML =
    volunteers
      .map(
        (volunteer) => `
        <article class="person-card">
          <h3>${escapeHtml(volunteer.name || "Unnamed volunteer")}</h3>
          <p>${volunteer.availability ? "Available for assignment" : "Already assigned"}</p>
          <div class="chip-row">
            ${(volunteer.skills || []).map((skill) => `<span class="chip">${escapeHtml(skill)}</span>`).join("")}
          </div>
          <div class="volunteer-meta">
            <span>${formatLocation(volunteer.location)}</span>
            <span>${volunteer.availability ? "Ready" : "Busy"}</span>
          </div>
        </article>`,
      )
      .join("") || emptyMarkup("No volunteers in this view");
}

function renderTasks() {
  const tasks = state.tasks.filter((task) => {
    if (state.filter !== "open") return true;
    return !task.assigned_volunteer_id;
  });

  els.taskList.innerHTML =
    tasks
      .map((task) => {
        const active = getId(task) === state.selectedTaskId ? "active" : "";
        const status = task.assigned_volunteer_id ? "Assigned" : "Open";
        return `
          <article class="task-card ${active}" data-task-id="${escapeHtml(getId(task))}" tabindex="0">
            <div class="task-meta">
              <span class="distance-tag">Urgency ${Number(task.urgency || 1)}</span>
              <span>${status}</span>
            </div>
            <h3>${escapeHtml(task.title || "Untitled task")}</h3>
            <p>${formatLocation(task.location)}</p>
            <div class="chip-row">
              ${(task.required_skills || []).map((skill) => `<span class="chip">${escapeHtml(skill)}</span>`).join("")}
            </div>
          </article>`;
      })
      .join("") || emptyMarkup("No tasks in this view");
}

function renderMatches() {
  if (!state.selectedTaskId) {
    els.matchSummary.innerHTML = emptyMarkup("Choose a task", "Top volunteers will appear here.");
    return;
  }

  if (!state.selectedMatches.length) {
    els.matchSummary.innerHTML = emptyMarkup("No suitable matches", "Try another task or add available volunteers.");
    return;
  }

  els.matchSummary.innerHTML = state.selectedMatches
    .map((match, index) => {
      const breakdown = match.breakdown || {};
      const mapLink = match.map_link
        ? `<a class="secondary-button small" href="${escapeHtml(match.map_link)}" target="_blank" rel="noreferrer">Route</a>`
        : "";
      return `
        <article class="match-card" style="animation-delay:${index * 80}ms">
          <div class="match-top">
            <div>
              <span class="pill">Rank ${index + 1}</span>
              <h3>${escapeHtml(match.name || "Volunteer")}</h3>
              <p>${Number(match.distance_km) >= 0 ? `${match.distance_km} km from task` : "Distance unavailable"}</p>
            </div>
            <div class="confidence-ring" style="--score:${Number(match.confidence || 0)}">
              ${Math.round(match.confidence || 0)}%
            </div>
          </div>
          <div class="reason-row">
            ${(match.reasons || ["General match"]).map((reason) => `<span class="reason">${escapeHtml(reason)}</span>`).join("")}
          </div>
          <div class="score-stack">
            ${["skill", "distance", "availability", "urgency"]
              .map(
                (key) => `
                <div class="score-line">
                  <span>${key}</span>
                  <i><b style="--score:${Number(breakdown[key] || 0)}"></b></i>
                </div>`,
              )
              .join("")}
          </div>
          <div class="chip-row">
            ${(match.skills || []).map((skill) => `<span class="chip">${escapeHtml(skill)}</span>`).join("")}
            ${mapLink}
          </div>
        </article>`;
    })
    .join("");
}

function emptyMarkup(title, subtitle = "") {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}
    </div>`;
}

async function previewMatches({ quiet = false } = {}) {
  const task = getSelectedTask();
  if (!task) {
    state.selectedMatches = [];
    renderAll();
    return;
  }

  if (state.demoMode) {
    state.selectedMatches = getLocalMatches(task);
    renderAll();
    if (!quiet) toast("Match preview ready", "Local scoring generated the top volunteer recommendations.");
    return;
  }

  try {
    const data = await request(`/match-preview/${encodeURIComponent(getId(task))}`);
    state.selectedMatches = Array.isArray(data.matches) ? data.matches : [];
    setApiStatus(true, "API connected");
    renderAll();
    if (!quiet) toast("Match preview ready", "Explainable AI scores are now visible.");
  } catch (error) {
    state.selectedMatches = [];
    setApiStatus(false, "Match preview failed");
    renderAll();
    if (!quiet) toast("Preview failed", error.message);
  }
}

async function assignBest() {
  const task = getSelectedTask();
  if (!task) {
    toast("Select a task", "Choose an open task before assigning.");
    return;
  }

  if (state.demoMode) {
    const best = getLocalMatches(task)[0];
    if (!best) {
      toast("No match found", "Add an available volunteer with closer skills.");
      return;
    }
    task.assigned_volunteer_id = best.id;
    const volunteer = state.volunteers.find((item) => getId(item) === best.id);
    if (volunteer) volunteer.availability = false;
    state.selectedMatches = getLocalMatches(task);
    renderAll();
    toast("Task assigned", `${best.name} is now linked to ${task.title}.`);
    return;
  }

  try {
    const data = await request(`/assign-task/${encodeURIComponent(getId(task))}`, { method: "POST" });
    if (data.task) {
      state.tasks = state.tasks.map((item) => (getId(item) === getId(data.task) ? data.task : item));
    }
    await loadData({ quiet: true });
    toast("Task assigned", `${data.assigned_volunteer?.name || "Best volunteer"} is now assigned.`);
  } catch (error) {
    toast("Assignment failed", error.message);
  }
}

function getLocalMatches(task) {
  if (!task || task.assigned_volunteer_id) return [];
  return state.volunteers
    .filter((volunteer) => volunteer.availability)
    .map((volunteer) => {
      const distance = haversine(volunteer.location, task.location);
      const skill = skillScore(volunteer.skills, task.required_skills);
      const distanceScore = scoreDistance(distance);
      const availability = volunteer.availability ? 1 : 0;
      const urgency = task.urgency >= 3 ? 0.8 : task.urgency === 2 ? 0.5 : 0.3;
      const score = skill * 0.5 + distanceScore * 0.2 + availability * 0.1 + urgency * 0.2;
      const confidence = Math.min(100, Math.round(score * 100));
      return {
        id: getId(volunteer),
        name: volunteer.name,
        skills: volunteer.skills,
        score: Number(score.toFixed(3)),
        confidence,
        distance_km: Number(distance.toFixed(2)),
        reasons: getReasons(skill, distance, availability, urgency),
        map_link: `https://www.google.com/maps/dir/${volunteer.location.lat},${volunteer.location.lon}/${task.location.lat},${task.location.lon}`,
        breakdown: {
          skill: Number(skill.toFixed(3)),
          distance: Number(distanceScore.toFixed(3)),
          availability,
          urgency,
        },
      };
    })
    .filter((match) => match.distance_km <= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function skillScore(volunteerSkills = [], taskSkills = []) {
  if (!taskSkills.length) return 1;
  const normalized = new Set(volunteerSkills.map((skill) => String(skill).toLowerCase()));
  const matches = taskSkills.filter((skill) => normalized.has(String(skill).toLowerCase()));
  return matches.length / taskSkills.length;
}

function scoreDistance(distance) {
  if (distance <= 2) return 1;
  if (distance <= 5) return 0.8;
  if (distance <= 10) return 0.5;
  if (distance <= 25) return 0.2;
  return 0.1;
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

function haversine(a = {}, b = {}) {
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const lat1 = Number(a.lat);
  const lon1 = Number(a.lon);
  const lat2 = Number(b.lat);
  const lon2 = Number(b.lon);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return 999;
  const earthRadius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatLocation(location = {}) {
  const lat = Number(location.lat);
  const lon = Number(location.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "No coordinates";
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

function toast(title, message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  els.toastStack.appendChild(node);
  window.setTimeout(() => {
    node.style.opacity = "0";
    node.style.transform = "translateY(8px)";
    window.setTimeout(() => node.remove(), 220);
  }, 3600);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resizeCanvas() {
  const rect = els.canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  els.canvas.width = Math.max(1, Math.floor(rect.width * scale));
  els.canvas.height = Math.max(1, Math.floor(rect.height * scale));
}

function getMapPoints() {
  const task = getSelectedTask();
  const volunteers = state.volunteers.filter((volunteer) => volunteer.availability);
  const points = [
    ...volunteers.map((volunteer) => ({ type: "volunteer", item: volunteer, location: volunteer.location })),
    ...state.tasks.map((taskItem) => ({ type: "task", item: taskItem, location: taskItem.location })),
  ].filter((point) => Number.isFinite(Number(point.location?.lat)) && Number.isFinite(Number(point.location?.lon)));
  return { points, selectedTask: task };
}

function project(location, bounds, width, height) {
  const pad = Math.min(width, height) * 0.13;
  const lonRange = bounds.maxLon - bounds.minLon || 1;
  const latRange = bounds.maxLat - bounds.minLat || 1;
  const x = pad + ((Number(location.lon) - bounds.minLon) / lonRange) * (width - pad * 2);
  const y = height - pad - ((Number(location.lat) - bounds.minLat) / latRange) * (height - pad * 2);
  return { x, y };
}

function drawOnce(time = performance.now()) {
  const ctx = els.canvas.getContext("2d");
  const scale = window.devicePixelRatio || 1;
  const width = els.canvas.width / scale;
  const height = els.canvas.height / scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const styles = getComputedStyle(document.documentElement);
  const ink = styles.getPropertyValue("--ink").trim();
  const muted = styles.getPropertyValue("--muted").trim();
  const primary = styles.getPropertyValue("--primary").trim();
  const blue = styles.getPropertyValue("--blue").trim();
  const amber = styles.getPropertyValue("--amber").trim();
  const line = styles.getPropertyValue("--line").trim();

  ctx.lineWidth = 1;
  ctx.strokeStyle = line;
  for (let x = 36; x < width; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.25, height);
    ctx.stroke();
  }
  for (let y = 48; y < height; y += 58) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y - width * 0.06);
    ctx.stroke();
  }

  const { points, selectedTask } = getMapPoints();
  if (!points.length) return;

  const lats = points.map((point) => Number(point.location.lat));
  const lons = points.map((point) => Number(point.location.lon));
  const bounds = {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  };
  const selectedPoint = selectedTask
    ? project(selectedTask.location, bounds, width, height)
    : null;

  if (selectedPoint) {
    state.selectedMatches.forEach((match, index) => {
      const volunteer = state.volunteers.find((item) => getId(item) === match.id);
      if (!volunteer) return;
      const projected = project(volunteer.location, bounds, width, height);
      ctx.beginPath();
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -((time / 60 + index * 8) % 16);
      ctx.strokeStyle = index === 0 ? primary : blue;
      ctx.lineWidth = index === 0 ? 2.4 : 1.5;
      ctx.moveTo(projected.x, projected.y);
      ctx.quadraticCurveTo(width / 2, Math.min(projected.y, selectedPoint.y) - 40, selectedPoint.x, selectedPoint.y);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  points.forEach((point) => {
    const projected = project(point.location, bounds, width, height);
    const isSelected = selectedTask && getId(point.item) === getId(selectedTask);
    const radius = point.type === "task" ? 9 : 7;
    const pulse = Math.sin(time / 520 + projected.x * 0.01) * 3 + 8;

    if (isSelected) {
      ctx.beginPath();
      ctx.fillStyle = `${amber}33`;
      ctx.arc(projected.x, projected.y, radius + pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.fillStyle = point.type === "task" ? amber : primary;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = muted;
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.fillText(point.type === "task" ? "Task" : "Volunteer", projected.x + 12, projected.y + 4);
  });
}

function animateMap(time) {
  drawOnce(time);
  requestAnimationFrame(animateMap);
}

function bindEvents() {
  document.querySelector("#refreshButton").addEventListener("click", () => loadData());
  document.querySelector("#demoButton").addEventListener("click", () => useDemoData());
  document.querySelector("#previewButton").addEventListener("click", () => previewMatches());
  document.querySelector("#assignButton").addEventListener("click", assignBest);

  document.querySelector("#saveApiButton").addEventListener("click", () => {
    const next = els.apiBaseInput.value.trim().replace(/\/$/, "");
    if (!next) return;
    state.apiBase = next;
    localStorage.setItem("avms-api-base", next);
    loadData();
  });

  document.querySelector("#themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("avms-theme", next);
    drawOnce();
  });

  els.taskSelect.addEventListener("change", (event) => {
    state.selectedTaskId = event.target.value;
    previewMatches();
  });

  els.taskList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-task-id]");
    if (!card) return;
    state.selectedTaskId = card.dataset.taskId;
    previewMatches();
  });

  els.taskList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-task-id]");
    if (!card) return;
    event.preventDefault();
    state.selectedTaskId = card.dataset.taskId;
    previewMatches();
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.filter = button.dataset.filter;
      renderVolunteers();
      renderTasks();
    });
  });

  document.querySelector("#volunteerForm").addEventListener("submit", submitVolunteer);
  document.querySelector("#taskForm").addEventListener("submit", submitTask);
  window.addEventListener("resize", () => {
    resizeCanvas();
    drawOnce();
  });
}

async function submitVolunteer(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {
    name: form.get("name"),
    skills: cleanList(form.get("skills")),
    location: { lat: Number(form.get("lat")), lon: Number(form.get("lon")) },
    availability: form.get("availability") === "on",
  };

  if (state.demoMode) {
    state.volunteers.unshift({ _id: `demo-v-${Date.now()}`, ...payload });
    event.currentTarget.reset();
    renderAll();
    toast("Volunteer added", `${payload.name} is in the demo registry.`);
    return;
  }

  try {
    const created = await request("/volunteer", { method: "POST", body: JSON.stringify(payload) });
    state.volunteers.unshift(created);
    event.currentTarget.reset();
    renderAll();
    toast("Volunteer added", `${created.name || payload.name} is ready for matching.`);
  } catch (error) {
    toast("Volunteer save failed", error.message);
  }
}

async function submitTask(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {
    title: form.get("title"),
    required_skills: cleanList(form.get("required_skills")),
    location: { lat: Number(form.get("lat")), lon: Number(form.get("lon")) },
    urgency: Number(form.get("urgency")),
  };

  if (state.demoMode) {
    const task = { _id: `demo-t-${Date.now()}`, ...payload, assigned_volunteer_id: null };
    state.tasks.unshift(task);
    state.selectedTaskId = task._id;
    state.selectedMatches = getLocalMatches(task);
    event.currentTarget.reset();
    renderAll();
    toast("Task created", `${task.title} is ready for AI matching.`);
    return;
  }

  try {
    const created = await request("/task", { method: "POST", body: JSON.stringify(payload) });
    state.tasks.unshift(created);
    state.selectedTaskId = getId(created);
    event.currentTarget.reset();
    await previewMatches({ quiet: true });
    renderAll();
    toast("Task created", `${created.title || payload.title} is ready for matching.`);
  } catch (error) {
    toast("Task save failed", error.message);
  }
}

function initReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll("[data-reveal]").forEach((node) => observer.observe(node));
}

function init() {
  const storedTheme = localStorage.getItem("avms-theme");
  if (storedTheme) document.documentElement.dataset.theme = storedTheme;
  els.apiBaseInput.value = state.apiBase;
  bindEvents();
  initReveal();
  resizeCanvas();
  requestAnimationFrame(animateMap);
  loadData({ quiet: true });
}

init();

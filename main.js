/**
 * Atlas AI Travel Assistant — Frontend Controller
 * IBM Watsonx.ai | IBM Granite Models
 * ============================================================
 */

/* ── Helpers ─────────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

/** POST JSON to a backend API route and return parsed response */
async function apiPost(endpoint, data) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Render a Markdown string into safe HTML via marked.js */
function renderMarkdown(md) {
  if (typeof marked === "undefined") return `<pre>${escapeHtml(md)}</pre>`;
  return marked.parse(md, { breaks: true, gfm: true });
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/** Inject HTML into a result container */
function setResult(containerId, html) {
  const el = $(containerId);
  if (!el) return;
  el.innerHTML = `<div class="result-content">${html}</div>`;
}

/** Show the loading overlay with a custom message */
function showLoading(msg = "Atlas is thinking…") {
  $("loadingMsg").textContent = msg;
  $("loadingOverlay").style.display = "flex";
}

function hideLoading() {
  $("loadingOverlay").style.display = "none";
}

/** Show a Bootstrap-style toast notification */
function toast(message, type = "info") {
  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  const id = "toast-" + Date.now();
  const html = `
    <div id="${id}" class="toast atlas-toast align-items-center show" role="alert">
      <div class="d-flex align-items-center gap-2 p-3">
        <span>${icons[type] || "ℹ️"}</span>
        <span class="flex-grow-1 small">${escapeHtml(message)}</span>
        <button type="button" class="btn-close btn-close-white ms-2" data-bs-dismiss="toast"></button>
      </div>
    </div>`;
  $("toastContainer").insertAdjacentHTML("beforeend", html);
  setTimeout(() => document.getElementById(id)?.remove(), 5000);
}

/** Copy text to clipboard */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard!", "success");
  } catch {
    toast("Could not copy — please copy manually.", "warning");
  }
}

/* ── Navigation ──────────────────────────────────────────── */

function activatePanel(panelId) {
  $$(".panel").forEach((p) => p.classList.remove("active"));
  const target = $(`panel-${panelId}`);
  if (target) target.classList.add("active");

  $$(".sidebar-link").forEach((l) => {
    l.classList.toggle("active", l.dataset.panel === panelId);
  });

  // Close offcanvas on mobile
  const oc = document.getElementById("sidebarOffcanvas");
  if (oc && window.innerWidth < 992) {
    bootstrap.Offcanvas.getInstance(oc)?.hide();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initNavigation() {
  $$(".sidebar-link, .quick-card, [data-panel]").forEach((el) => {
    const panel = el.dataset.panel;
    if (!panel) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      activatePanel(panel);
    });
  });
}

/* ── Theme toggle ────────────────────────────────────────── */

function initTheme() {
  const saved = localStorage.getItem("atlas-theme") || "dark";
  applyTheme(saved);

  $("themeToggle").addEventListener("click", () => {
    const current = document.documentElement.dataset.bsTheme;
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-bs-theme", theme);
  localStorage.setItem("atlas-theme", theme);
  const btn = $("themeToggle");
  if (btn) btn.innerHTML = theme === "dark"
    ? '<i class="bi bi-sun-fill"></i>'
    : '<i class="bi bi-moon-stars-fill"></i>';
}

/* ── Status check ────────────────────────────────────────── */

async function checkStatus() {
  try {
    const data = await fetch("/api/status").then((r) => r.json());
    const badge = $("statusBadge");
    if (data.connected) {
      badge.className = "status-badge status-live";
      badge.innerHTML = `<span class="status-dot"></span> Live · ${data.model.split("/").pop()}`;
    } else {
      badge.className = "status-badge status-demo";
      badge.innerHTML = `<span class="status-dot"></span> Demo mode`;
    }
  } catch {
    const badge = $("statusBadge");
    badge.className = "status-badge status-demo";
    badge.innerHTML = `<span class="status-dot"></span> Offline`;
  }
}

/* ── Recent Plans (localStorage) ────────────────────────── */

const RECENTS_KEY = "atlas-recent-plans";

function saveRecentPlan(destination, type, content) {
  const plans = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
  plans.unshift({
    id: Date.now(),
    destination,
    type,
    content,
    date: new Date().toLocaleDateString(),
  });
  localStorage.setItem(RECENTS_KEY, JSON.stringify(plans.slice(0, 10)));
  renderRecentPlans();
}

function renderRecentPlans() {
  const plans = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
  const container = $("recentPlans");
  if (!container) return;

  if (!plans.length) {
    container.innerHTML = `
      <div class="text-center text-muted py-4">
        <i class="bi bi-map" style="font-size:2rem;"></i>
        <p class="mt-2 mb-0">No plans yet — start planning above!</p>
      </div>`;
    return;
  }

  const icons = { trip_plan: "✈️", destinations: "🌍", budget: "💰", comparison: "📊",
                  itinerary: "📅", weather: "🌤️", transport: "🚗", accommodation: "🏨",
                  packing: "🎒", chat: "💬" };

  container.innerHTML = plans.map((p) => `
    <div class="recent-plan-item" data-content="${escapeHtml(p.content)}" data-panel="trip-planner">
      <div class="recent-plan-icon">${icons[p.type] || "📋"}</div>
      <div class="recent-plan-info">
        <div class="recent-plan-title">${escapeHtml(p.destination)}</div>
        <div class="recent-plan-meta">${p.type.replace("_"," ")} · ${p.date}</div>
      </div>
      <i class="bi bi-chevron-right text-muted"></i>
    </div>`).join("");

  container.querySelectorAll(".recent-plan-item").forEach((item) => {
    item.addEventListener("click", () => {
      activatePanel("trip-planner");
      setResult("tripPlanResult", renderMarkdown(item.dataset.content));
      $("copyTripPlan").style.display = "inline-flex";
      $("printTripPlan").style.display = "inline-flex";
    });
  });
}

/* ── Interest tag toggle ─────────────────────────────────── */

function initInterestTags() {
  $$(".interest-tag").forEach((tag) => {
    tag.addEventListener("click", () => tag.classList.toggle("selected"));
  });
}

function getSelectedInterests() {
  return [...$$(".interest-tag.selected")].map((t) => t.dataset.val);
}

/* ── Quick search (Dashboard) ────────────────────────────── */

function initQuickSearch() {
  const btn   = $("quickSearchBtn");
  const input = $("quickSearch");
  if (!btn || !input) return;

  const doSearch = async () => {
    const msg = input.value.trim();
    if (!msg) return;
    activatePanel("chat");
    await sendChatMessage(msg);
  };

  btn.addEventListener("click", doSearch);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
}

/* ── Trip Planner ────────────────────────────────────────── */

function initTripPlanner() {
  const form = $("tripForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const destination = $("tp-destination").value.trim();
    if (!destination) { toast("Please enter a destination.", "warning"); return; }

    const pace = document.querySelector('input[name="pace"]:checked')?.value || "moderate";
    const interests = getSelectedInterests();

    const payload = {
      destination,
      duration:      $("tp-duration").value,
      budget:        $("tp-budget").value || "1000",
      currency:      $("tp-currency").value,
      travelers:     $("tp-travelers").value,
      traveler_type: $("tp-traveler-type").value,
      transport:     $("tp-transport").value,
      accommodation: $("tp-accommodation").value,
      pace,
      interests:     interests.length ? interests : ["sightseeing"],
    };

    showLoading(`Planning your ${payload.duration}-day trip to ${destination}…`);
    try {
      const data = await apiPost("/api/plan", payload);
      hideLoading();
      setResult("tripPlanResult", renderMarkdown(data.response));
      $("copyTripPlan").style.display = "inline-flex";
      $("printTripPlan").style.display = "inline-flex";
      saveRecentPlan(destination, "trip_plan", data.response);
      toast("Trip plan generated!", "success");
    } catch (err) {
      hideLoading();
      setResult("tripPlanResult", `<div class="alert alert-danger">Error: ${escapeHtml(err.message)}</div>`);
      toast("Failed to generate plan: " + err.message, "error");
    }
  });

  // Copy / Print buttons
  $("copyTripPlan")?.addEventListener("click", () => {
    const content = document.querySelector("#tripPlanResult .result-content")?.innerText || "";
    copyToClipboard(content);
  });
  $("printTripPlan")?.addEventListener("click", () => window.print());
}

/* ── Itinerary Manager ───────────────────────────────────── */

function initItinerary() {
  $("generateItinerary")?.addEventListener("click", async () => {
    const destination = $("it-destination").value.trim();
    if (!destination) { toast("Please enter a destination.", "warning"); return; }

    const payload = {
      destination,
      day:       parseInt($("it-day").value),
      pace:      $("it-pace").value,
      dietary:   $("it-dietary").value || "no restrictions",
      interests: $("it-interests").value.split(",").map((s) => s.trim()).filter(Boolean),
    };

    showLoading(`Building Day ${payload.day} in ${destination}…`);
    try {
      const data = await apiPost("/api/itinerary", payload);
      hideLoading();
      setResult("itineraryResult", renderMarkdown(data.response));
      saveRecentPlan(`${destination} Day ${payload.day}`, "itinerary", data.response);
      toast("Itinerary ready!", "success");
    } catch (err) {
      hideLoading();
      setResult("itineraryResult", `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`);
      toast(err.message, "error");
    }
  });
}

/* ── Budget Calculator ───────────────────────────────────── */

function initBudget() {
  $("calculateBudget")?.addEventListener("click", async () => {
    const destination = $("bud-destination").value.trim();
    if (!destination) { toast("Please enter a destination.", "warning"); return; }

    const includes = [];
    if ($("inc-flights")?.checked)    includes.push("flights");
    if ($("inc-hotels")?.checked)     includes.push("hotels");
    if ($("inc-food")?.checked)       includes.push("food");
    if ($("inc-activities")?.checked) includes.push("activities");
    if ($("inc-transport")?.checked)  includes.push("local transport");
    if ($("inc-misc")?.checked)       includes.push("miscellaneous");

    const payload = {
      destination,
      duration:  $("bud-duration").value,
      travelers: $("bud-travelers").value,
      style:     $("bud-style").value,
      includes,
    };

    showLoading(`Calculating budget for ${destination}…`);
    try {
      const data = await apiPost("/api/budget", payload);
      hideLoading();
      setResult("budgetResult", renderMarkdown(data.response));
      saveRecentPlan(destination, "budget", data.response);
      toast("Budget calculated!", "success");
    } catch (err) {
      hideLoading();
      setResult("budgetResult", `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`);
      toast(err.message, "error");
    }
  });
}

/* ── Destination Discovery ───────────────────────────────── */

function initDestinations() {
  $("discoverDestinations")?.addEventListener("click", async () => {
    const interests = $("dest-interests").value.split(",").map((s) => s.trim()).filter(Boolean);

    const payload = {
      traveler_type: $("dest-traveler-type").value,
      budget:        $("dest-budget").value,
      duration:      $("dest-duration").value,
      month:         $("dest-month").value,
      interests:     interests.length ? interests : ["culture"],
      exclude:       $("dest-exclude").value || "none",
    };

    showLoading("Discovering perfect destinations for you…");
    try {
      const data = await apiPost("/api/destinations", payload);
      hideLoading();
      setResult("destinationsResult", renderMarkdown(data.response));
      saveRecentPlan("Top 5 Destinations", "destinations", data.response);
      toast("Destinations found!", "success");
    } catch (err) {
      hideLoading();
      setResult("destinationsResult", `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`);
      toast(err.message, "error");
    }
  });
}

/* ── Destination Comparison ──────────────────────────────── */

function initComparison() {
  $("compareDestinations")?.addEventListener("click", async () => {
    const destinations = [
      $("cmp-dest1").value.trim(),
      $("cmp-dest2").value.trim(),
      $("cmp-dest3").value.trim(),
      $("cmp-dest4").value.trim(),
    ].filter(Boolean);

    if (destinations.length < 2) {
      toast("Please enter at least 2 destinations to compare.", "warning");
      return;
    }

    const criteria = [];
    if ($("crit-cost")?.checked)        criteria.push("cost of travel");
    if ($("crit-weather")?.checked)     criteria.push("weather");
    if ($("crit-attractions")?.checked) criteria.push("attractions");
    if ($("crit-safety")?.checked)      criteria.push("safety");
    if ($("crit-food")?.checked)        criteria.push("food scene");

    const payload = {
      destinations,
      traveler_type: $("cmp-traveler").value,
      month:         $("cmp-month").value,
      budget:        $("cmp-budget").value,
      criteria:      criteria.length ? criteria : ["cost", "weather", "attractions"],
    };

    showLoading(`Comparing ${destinations.join(" vs ")}…`);
    try {
      const data = await apiPost("/api/compare", payload);
      hideLoading();
      setResult("compareResult", renderMarkdown(data.response));
      saveRecentPlan(destinations.join(" vs "), "comparison", data.response);
      toast("Comparison complete!", "success");
    } catch (err) {
      hideLoading();
      setResult("compareResult", `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`);
      toast(err.message, "error");
    }
  });
}

/* ── Weather Panel ───────────────────────────────────────── */

function initWeather() {
  $("getWeather")?.addEventListener("click", async () => {
    const destination = $("wx-destination").value.trim();
    if (!destination) { toast("Please enter a destination.", "warning"); return; }

    const activities = $("wx-activities").value.split(",").map((s) => s.trim()).filter(Boolean);
    const payload = {
      destination,
      month:      $("wx-month").value,
      activities: activities.length ? activities : ["general tourism"],
    };

    showLoading(`Getting weather guide for ${destination}…`);
    try {
      const data = await apiPost("/api/weather", payload);
      hideLoading();
      setResult("weatherResult", renderMarkdown(data.response));
      saveRecentPlan(`${destination} Weather`, "weather", data.response);
      toast("Weather guide ready!", "success");
    } catch (err) {
      hideLoading();
      setResult("weatherResult", `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`);
      toast(err.message, "error");
    }
  });
}

/* ── Transport Planner ───────────────────────────────────── */

function initTransport() {
  $("planTransport")?.addEventListener("click", async () => {
    const destination = $("tr-destination").value.trim();
    if (!destination) { toast("Please enter a destination.", "warning"); return; }

    const preferences = [];
    if ($("pref-cost")?.checked)    preferences.push("lowest cost");
    if ($("pref-speed")?.checked)   preferences.push("fastest route");
    if ($("pref-comfort")?.checked) preferences.push("comfort");
    if ($("pref-eco")?.checked)     preferences.push("eco-friendly");

    const payload = {
      origin:      $("tr-origin").value.trim() || "your city",
      destination,
      date:        $("tr-date").value || "flexible",
      travelers:   $("tr-travelers").value,
      preferences: preferences.length ? preferences : ["cost", "speed"],
    };

    showLoading(`Planning transport to ${destination}…`);
    try {
      const data = await apiPost("/api/transport", payload);
      hideLoading();
      setResult("transportResult", renderMarkdown(data.response));
      saveRecentPlan(destination, "transport", data.response);
      toast("Transport options ready!", "success");
    } catch (err) {
      hideLoading();
      setResult("transportResult", `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`);
      toast(err.message, "error");
    }
  });
}

/* ── Accommodation ───────────────────────────────────────── */

function initAccommodation() {
  $("findAccommodation")?.addEventListener("click", async () => {
    const destination = $("acc-destination").value.trim();
    if (!destination) { toast("Please enter a destination.", "warning"); return; }

    const amenities = [];
    if ($("am-wifi")?.checked)      amenities.push("free WiFi");
    if ($("am-breakfast")?.checked) amenities.push("breakfast included");
    if ($("am-pool")?.checked)      amenities.push("swimming pool");
    if ($("am-parking")?.checked)   amenities.push("free parking");
    if ($("am-gym")?.checked)       amenities.push("fitness centre");

    const payload = {
      destination,
      checkin:          $("acc-checkin").value || "flexible",
      checkout:         $("acc-checkout").value || "flexible",
      travelers:        $("acc-travelers").value,
      type:             $("acc-type").value,
      budget_per_night: $("acc-budget").value || "100",
      amenities:        amenities.length ? amenities : ["wifi"],
    };

    showLoading(`Finding accommodation in ${destination}…`);
    try {
      const data = await apiPost("/api/accommodation", payload);
      hideLoading();
      setResult("accommodationResult", renderMarkdown(data.response));
      saveRecentPlan(destination, "accommodation", data.response);
      toast("Accommodation options ready!", "success");
    } catch (err) {
      hideLoading();
      setResult("accommodationResult", `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`);
      toast(err.message, "error");
    }
  });
}

/* ── Packing List ────────────────────────────────────────── */

function initPacking() {
  $("generatePacking")?.addEventListener("click", async () => {
    const destination = $("pk-destination").value.trim();
    if (!destination) { toast("Please enter a destination.", "warning"); return; }

    const activities = $("pk-activities").value.split(",").map((s) => s.trim()).filter(Boolean);
    const payload = {
      destination,
      duration:   $("pk-duration").value,
      climate:    $("pk-climate").value,
      activities: activities.length ? activities : ["general tourism"],
      bag_type:   $("pk-bag").value,
    };

    showLoading(`Building packing list for ${destination}…`);
    try {
      const data = await apiPost("/api/packing", payload);
      hideLoading();
      setResult("packingResult", renderMarkdown(data.response));
      saveRecentPlan(destination, "packing", data.response);
      toast("Packing list ready!", "success");
    } catch (err) {
      hideLoading();
      setResult("packingResult", `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`);
      toast(err.message, "error");
    }
  });
}

/* ── Traveller Profile ───────────────────────────────────── */

const PROFILE_KEY = "atlas-profile";

function initProfile() {
  // Load saved profile
  const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
  const fields = ["name","nationality","home-city","languages","dietary","style",
                  "accommodation","transport","interests","visited"];
  fields.forEach((f) => {
    const el = $(`prof-${f}`);
    if (el && saved[f] !== undefined) el.value = saved[f];
  });

  $("saveProfile")?.addEventListener("click", () => {
    const profile = {};
    fields.forEach((f) => { profile[f] = $(`prof-${f}`)?.value || ""; });
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    toast("Profile saved!", "success");
  });

  $("clearProfile")?.addEventListener("click", () => {
    localStorage.removeItem(PROFILE_KEY);
    fields.forEach((f) => { const el = $(`prof-${f}`); if (el) el.value = ""; });
    toast("Profile cleared.", "info");
  });
}

/* ── Chat ────────────────────────────────────────────────── */

async function sendChatMessage(messageOverride) {
  const input   = $("chatInput");
  const message = messageOverride || input?.value.trim();
  if (!message) return;

  if (input && !messageOverride) input.value = "";
  $("chatSuggestions").style.display = "none";

  // Append user bubble
  appendChatBubble("user", message);

  // Typing indicator
  const typingId = appendTypingIndicator();

  try {
    const data = await apiPost("/api/chat", { message });
    removeTypingIndicator(typingId);
    appendChatBubble("assistant", data.response, true);
  } catch (err) {
    removeTypingIndicator(typingId);
    appendChatBubble("assistant", `⚠️ Error: ${err.message}`);
    toast(err.message, "error");
  }
}

function appendChatBubble(role, content, isMarkdown = false) {
  const messages = $("chatMessages");
  const avatar   = role === "user" ? "👤" : "🌍";
  const html = isMarkdown ? renderMarkdown(content) : `<p>${escapeHtml(content)}</p>`;

  const div = document.createElement("div");
  div.className = `chat-message ${role}`;
  div.innerHTML = `
    <div class="chat-avatar">${avatar}</div>
    <div class="chat-bubble">${html}</div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function appendTypingIndicator() {
  const id = "typing-" + Date.now();
  const messages = $("chatMessages");
  const div = document.createElement("div");
  div.id = id;
  div.className = "chat-message assistant";
  div.innerHTML = `
    <div class="chat-avatar">🌍</div>
    <div class="chat-bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  document.getElementById(id)?.remove();
}

function initChat() {
  const btn   = $("sendChat");
  const input = $("chatInput");
  if (!btn || !input) return;

  btn.addEventListener("click", () => sendChatMessage());

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  // Suggestion buttons
  $$(".sugg-btn").forEach((btn) => {
    btn.addEventListener("click", () => sendChatMessage(btn.textContent.trim()));
  });

  // Clear history
  $("clearChat")?.addEventListener("click", async () => {
    try {
      await fetch("/api/chat/clear", { method: "POST" });
      const messages = $("chatMessages");
      messages.innerHTML = `
        <div class="chat-message assistant">
          <div class="chat-avatar">🌍</div>
          <div class="chat-bubble">
            <p>Chat history cleared. How can I help with your travels?</p>
          </div>
        </div>`;
      $("chatSuggestions").style.display = "flex";
      toast("Chat history cleared.", "info");
    } catch {
      toast("Could not clear history.", "error");
    }
  });
}

/* ── Clear Recents ───────────────────────────────────────── */

function initClearRecents() {
  $("clearRecentsBtn")?.addEventListener("click", () => {
    localStorage.removeItem(RECENTS_KEY);
    renderRecentPlans();
    toast("Recent plans cleared.", "info");
  });
}

/* ── Keyboard Shortcuts ──────────────────────────────────── */

function initShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Alt+number to switch panels
    const panels = ["dashboard","trip-planner","itinerary","budget",
                    "destinations","compare","weather","transport",
                    "accommodation","packing","profile","chat"];
    if (e.altKey && !e.shiftKey && !e.ctrlKey) {
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < panels.length) {
        e.preventDefault();
        activatePanel(panels[idx]);
      }
    }
  });
}

/* ── Init ────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initNavigation();
  initInterestTags();
  initQuickSearch();
  initTripPlanner();
  initItinerary();
  initBudget();
  initDestinations();
  initComparison();
  initWeather();
  initTransport();
  initAccommodation();
  initPacking();
  initProfile();
  initChat();
  initClearRecents();
  initShortcuts();

  renderRecentPlans();
  checkStatus();

  // Refresh status every 60 seconds
  setInterval(checkStatus, 60_000);

  console.log("🌍 Atlas Travel Assistant initialised.");
});

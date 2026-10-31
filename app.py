"""
=============================================================================
  IBM Granite Travel Assistant — Flask Backend
  Powered by IBM Watsonx.ai | IBM Granite Models
=============================================================================
"""

import os
import json
import logging
from datetime import datetime
from typing import Any

from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv

# IBM Watsonx.ai SDK
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

from agent_instructions import SYSTEM_PROMPT, AGENT_NAME, BUDGET_TIERS

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-me")
CORS(app)

# ---------------------------------------------------------------------------
# Watsonx.ai client initialisation
# ---------------------------------------------------------------------------
def _init_watsonx_model() -> ModelInference | None:
    """Initialise and return an IBM Granite ModelInference client."""
    api_key    = os.getenv("IBM_API_KEY", "")
    project_id = os.getenv("WATSONX_PROJECT_ID", "")
    url        = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
    model_id   = os.getenv("GRANITE_MODEL_ID", "ibm/granite-3-3-8b-instruct")

    if not api_key or api_key == "your_ibm_cloud_api_key_here":
        logger.warning("IBM_API_KEY not configured — running in demo mode.")
        return None
    if not project_id or project_id == "your_watsonx_project_id_here":
        logger.warning("WATSONX_PROJECT_ID not configured — running in demo mode.")
        return None

    try:
        credentials = Credentials(url=url, api_key=api_key)
        client = APIClient(credentials)
        model = ModelInference(
            model_id=model_id,
            api_client=client,
            project_id=project_id,
            params={
                GenParams.MAX_NEW_TOKENS:     int(os.getenv("MAX_NEW_TOKENS", 2048)),
                GenParams.TEMPERATURE:        float(os.getenv("TEMPERATURE", 0.7)),
                GenParams.TOP_P:              float(os.getenv("TOP_P", 0.9)),
                GenParams.TOP_K:              int(os.getenv("TOP_K", 50)),
                GenParams.REPETITION_PENALTY: float(os.getenv("REPETITION_PENALTY", 1.1)),
            },
        )
        logger.info("Watsonx.ai ModelInference initialised with model: %s", model_id)
        return model
    except Exception as exc:
        logger.error("Failed to initialise Watsonx.ai: %s", exc)
        return None


granite_model = _init_watsonx_model()


# ---------------------------------------------------------------------------
# Core AI helper
# ---------------------------------------------------------------------------
def _call_granite(user_prompt: str, context: str = "") -> str:
    """
    Send a prompt to IBM Granite and return the generated text.
    Falls back to a structured demo response when the model is unavailable.
    """
    if granite_model is None:
        return _demo_response(user_prompt)

    full_prompt = (
        f"<|system|>\n{SYSTEM_PROMPT}\n"
        + (f"\n## Additional Context\n{context}\n" if context else "")
        + f"<|user|>\n{user_prompt}\n<|assistant|>\n"
    )

    try:
        result = granite_model.generate_text(prompt=full_prompt)
        return result.strip() if isinstance(result, str) else str(result)
    except Exception as exc:
        logger.error("Granite generation error: %s", exc)
        return f"⚠️ Generation error: {exc}\n\nPlease verify your API credentials in `.env`."


def _demo_response(prompt: str) -> str:
    """Return a structured placeholder when credentials are not configured."""
    return (
        f"## ✈️ Demo Mode — IBM Granite Not Connected\n\n"
        f"**Your request:** {prompt[:200]}{'…' if len(prompt) > 200 else ''}\n\n"
        "To activate AI-powered responses:\n"
        "1. Copy `env.template` → `.env`\n"
        "2. Set `IBM_API_KEY` and `WATSONX_PROJECT_ID` in `.env`\n"
        "3. Restart the Flask server\n\n"
        "**Sample plan structure Atlas would generate:**\n\n"
        "### 📅 Day 1 — Arrival & Orientation\n"
        "- Check in to recommended accommodation\n"
        "- Explore the neighbourhood on foot\n"
        "- Welcome dinner at a highly-rated local restaurant\n\n"
        "### 💰 Estimated Budget Breakdown\n"
        "| Category | Estimated Cost |\n"
        "|----------|---------------|\n"
        "| Flights  | $XXX           |\n"
        "| Hotels   | $XXX/night     |\n"
        "| Food     | $XX–$XX/day    |\n"
        "| Activities | $XX/day     |\n\n"
        "> 💡 **Pro Tip:** Configure your IBM Watsonx.ai credentials to unlock "
        "fully personalised AI-generated itineraries!"
    )


# ---------------------------------------------------------------------------
# Prompt builders for each feature
# ---------------------------------------------------------------------------
def _build_trip_prompt(data: dict) -> str:
    destination   = data.get("destination", "undecided")
    duration      = data.get("duration", "7")
    budget        = data.get("budget", "1000")
    currency      = data.get("currency", "USD")
    travelers     = data.get("travelers", "1")
    traveler_type = data.get("traveler_type", "solo")
    transport     = data.get("transport", "mixed")
    accommodation = data.get("accommodation", "hotel")
    interests     = ", ".join(data.get("interests", ["sightseeing"]))
    pace          = data.get("pace", "moderate")

    # Derive budget tier
    daily = int(budget) / max(int(duration), 1) / max(int(travelers), 1)
    tier = "budget" if daily < 75 else "luxury" if daily > 200 else "mid"
    tier_label = BUDGET_TIERS[tier]["label"]

    return (
        f"Create a complete {duration}-day travel plan for {travelers} {traveler_type} "
        f"traveller(s) visiting {destination}.\n\n"
        f"**Constraints:**\n"
        f"- Total budget: {budget} {currency} ({tier_label}, ~${daily:.0f}/person/day)\n"
        f"- Preferred transport: {transport}\n"
        f"- Accommodation type: {accommodation}\n"
        f"- Travel pace: {pace}\n"
        f"- Key interests: {interests}\n\n"
        f"Include: day-by-day itinerary, accommodation recommendations, "
        f"transportation tips, must-see attractions, local food guide, "
        f"weather tips, packing checklist, and budget breakdown table. "
        f"Add a Pro Tip section at the end."
    )


def _build_destination_prompt(data: dict) -> str:
    interests  = ", ".join(data.get("interests", ["culture"]))
    budget     = data.get("budget", "medium")
    duration   = data.get("duration", "7–10")
    month      = data.get("month", "any")
    travelers  = data.get("traveler_type", "solo")
    exclude    = data.get("exclude", "none")

    return (
        f"Recommend the top 5 travel destinations for a {travelers} traveller.\n\n"
        f"**Profile:**\n"
        f"- Interests: {interests}\n"
        f"- Budget level: {budget}\n"
        f"- Trip duration: {duration} days\n"
        f"- Travel month: {month}\n"
        f"- Destinations to exclude: {exclude}\n\n"
        f"For each destination provide: why it matches the profile, best time to visit, "
        f"average daily budget, top 3 attractions, must-try food, and a brief travel tip."
    )


def _build_budget_prompt(data: dict) -> str:
    destination = data.get("destination", "Paris")
    duration    = data.get("duration", "7")
    travelers   = data.get("travelers", "2")
    style       = data.get("style", "mid-range")
    includes    = ", ".join(data.get("includes", ["flights", "hotels", "food", "activities"]))

    return (
        f"Create a detailed budget breakdown for {travelers} traveller(s) spending "
        f"{duration} days in {destination} on a {style} budget.\n\n"
        f"Include cost estimates for: {includes}.\n\n"
        f"Format as a Markdown table with columns: Category | Budget Option | "
        f"Mid-Range Option | Luxury Option. "
        f"Add total estimates for each tier and money-saving tips."
    )


def _build_comparison_prompt(data: dict) -> str:
    destinations = data.get("destinations", [])
    criteria     = ", ".join(data.get("criteria", ["cost", "weather", "attractions"]))
    traveler     = data.get("traveler_type", "couple")
    month        = data.get("month", "any")
    budget       = data.get("budget", "medium")

    dest_list = " vs ".join(destinations) if destinations else "Paris vs Tokyo vs Bali"

    return (
        f"Compare these destinations for a {traveler} traveller in {month}: {dest_list}.\n\n"
        f"**Comparison criteria:** {criteria}\n"
        f"**Budget level:** {budget}\n\n"
        f"Present the comparison as a structured Markdown table covering all criteria. "
        f"Then give a final recommendation with reasoning based on the traveller profile. "
        f"Include a 'Verdict' section."
    )


def _build_itinerary_prompt(data: dict) -> str:
    destination = data.get("destination", "")
    day         = data.get("day", 1)
    interests   = ", ".join(data.get("interests", ["general sightseeing"]))
    pace        = data.get("pace", "moderate")
    dietary     = data.get("dietary", "no restrictions")

    return (
        f"Create a detailed single-day itinerary for Day {day} in {destination}.\n\n"
        f"- Travel pace: {pace}\n"
        f"- Interests: {interests}\n"
        f"- Dietary preferences: {dietary}\n\n"
        f"Break the day into Morning / Afternoon / Evening sections. "
        f"Include specific venue names, opening hours, estimated costs, "
        f"travel time between locations, and meal recommendations."
    )


def _build_weather_prompt(data: dict) -> str:
    destination = data.get("destination", "")
    month       = data.get("month", "")
    activities  = ", ".join(data.get("activities", []))

    return (
        f"Provide a detailed weather guide for {destination} in {month}.\n\n"
        f"Include: average temperature range, rainfall/humidity, "
        f"what to pack, best/worst times of day for outdoor activities, "
        f"weather-related travel warnings, and specific tips for these activities: {activities}.\n"
        f"Also mention any local events or festivals during this month."
    )


def _build_transport_prompt(data: dict) -> str:
    origin      = data.get("origin", "")
    destination = data.get("destination", "")
    date        = data.get("date", "flexible")
    travelers   = data.get("travelers", "1")
    preferences = ", ".join(data.get("preferences", ["comfort", "cost"]))

    return (
        f"Plan comprehensive transportation from {origin} to {destination} "
        f"for {travelers} traveller(s) on {date}.\n\n"
        f"Priorities: {preferences}\n\n"
        f"Cover: all transport modes (flight, train, bus, car), estimated costs, "
        f"travel duration, booking tips, local transport at destination, "
        f"and a recommended option with justification."
    )


def _build_accommodation_prompt(data: dict) -> str:
    destination = data.get("destination", "")
    checkin     = data.get("checkin", "flexible")
    checkout    = data.get("checkout", "flexible")
    travelers   = data.get("travelers", "2")
    acc_type    = data.get("type", "hotel")
    budget      = data.get("budget_per_night", "100")
    amenities   = ", ".join(data.get("amenities", ["wifi", "breakfast"]))

    return (
        f"Recommend accommodation in {destination} for {travelers} traveller(s) "
        f"checking in {checkin} and checking out {checkout}.\n\n"
        f"- Preferred type: {acc_type}\n"
        f"- Max budget per night: ${budget}\n"
        f"- Required amenities: {amenities}\n\n"
        f"Suggest 5 specific properties across budget / mid-range / luxury tiers. "
        f"For each include: name, location, price range, star rating, pros/cons, "
        f"and why it suits this traveller."
    )


def _build_packing_prompt(data: dict) -> str:
    destination = data.get("destination", "")
    duration    = data.get("duration", "7")
    activities  = ", ".join(data.get("activities", ["general tourism"]))
    climate     = data.get("climate", "temperate")
    bag_type    = data.get("bag_type", "carry-on")

    return (
        f"Create a comprehensive packing checklist for {duration} days in {destination}.\n\n"
        f"- Climate: {climate}\n"
        f"- Activities: {activities}\n"
        f"- Luggage type: {bag_type}\n\n"
        f"Organise by category: Documents & Money, Clothing, Toiletries, "
        f"Electronics, Health & Safety, Activity-Specific Gear. "
        f"Add packing tips and items to leave at home."
    )


def _build_chat_prompt(message: str, history: list) -> str:
    ctx = ""
    if history:
        recent = history[-6:]  # last 3 exchanges
        ctx = "\n".join(
            f"{'User' if m['role'] == 'user' else 'Atlas'}: {m['content']}"
            for m in recent
        )
    prompt = (f"Conversation history:\n{ctx}\n\nNew message: {message}"
              if ctx else message)
    return prompt


# ---------------------------------------------------------------------------
# Routes — Pages
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    """Main dashboard."""
    return render_template("index.html", agent_name=AGENT_NAME)


# ---------------------------------------------------------------------------
# Routes — API
# ---------------------------------------------------------------------------
@app.route("/api/status", methods=["GET"])
def api_status():
    """Health-check endpoint."""
    connected = granite_model is not None
    return jsonify({
        "status":    "ok",
        "agent":     AGENT_NAME,
        "model":     os.getenv("GRANITE_MODEL_ID", "ibm/granite-3-3-8b-instruct"),
        "connected": connected,
        "mode":      "live" if connected else "demo",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    })


@app.route("/api/plan", methods=["POST"])
def api_plan():
    """Generate a full trip plan."""
    data = request.get_json(force=True) or {}
    if not data.get("destination"):
        return jsonify({"error": "destination is required"}), 400
    prompt   = _build_trip_prompt(data)
    response = _call_granite(prompt)
    return jsonify({"response": response, "type": "trip_plan"})


@app.route("/api/destinations", methods=["POST"])
def api_destinations():
    """Recommend destinations based on traveller profile."""
    data     = request.get_json(force=True) or {}
    prompt   = _build_destination_prompt(data)
    response = _call_granite(prompt)
    return jsonify({"response": response, "type": "destinations"})


@app.route("/api/budget", methods=["POST"])
def api_budget():
    """Generate a detailed budget breakdown."""
    data = request.get_json(force=True) or {}
    if not data.get("destination"):
        return jsonify({"error": "destination is required"}), 400
    prompt   = _build_budget_prompt(data)
    response = _call_granite(prompt)
    return jsonify({"response": response, "type": "budget"})


@app.route("/api/compare", methods=["POST"])
def api_compare():
    """Compare multiple destinations."""
    data = request.get_json(force=True) or {}
    if len(data.get("destinations", [])) < 2:
        return jsonify({"error": "at least 2 destinations required"}), 400
    prompt   = _build_comparison_prompt(data)
    response = _call_granite(prompt)
    return jsonify({"response": response, "type": "comparison"})


@app.route("/api/itinerary", methods=["POST"])
def api_itinerary():
    """Generate a single-day detailed itinerary."""
    data = request.get_json(force=True) or {}
    if not data.get("destination"):
        return jsonify({"error": "destination is required"}), 400
    prompt   = _build_itinerary_prompt(data)
    response = _call_granite(prompt)
    return jsonify({"response": response, "type": "itinerary"})


@app.route("/api/weather", methods=["POST"])
def api_weather():
    """Provide weather-aware travel advice."""
    data = request.get_json(force=True) or {}
    if not data.get("destination"):
        return jsonify({"error": "destination is required"}), 400
    prompt   = _build_weather_prompt(data)
    response = _call_granite(prompt)
    return jsonify({"response": response, "type": "weather"})


@app.route("/api/transport", methods=["POST"])
def api_transport():
    """Plan transportation between locations."""
    data = request.get_json(force=True) or {}
    if not data.get("destination"):
        return jsonify({"error": "destination is required"}), 400
    prompt   = _build_transport_prompt(data)
    response = _call_granite(prompt)
    return jsonify({"response": response, "type": "transport"})


@app.route("/api/accommodation", methods=["POST"])
def api_accommodation():
    """Recommend accommodation options."""
    data = request.get_json(force=True) or {}
    if not data.get("destination"):
        return jsonify({"error": "destination is required"}), 400
    prompt   = _build_accommodation_prompt(data)
    response = _call_granite(prompt)
    return jsonify({"response": response, "type": "accommodation"})


@app.route("/api/packing", methods=["POST"])
def api_packing():
    """Generate a packing checklist."""
    data = request.get_json(force=True) or {}
    if not data.get("destination"):
        return jsonify({"error": "destination is required"}), 400
    prompt   = _build_packing_prompt(data)
    response = _call_granite(prompt)
    return jsonify({"response": response, "type": "packing"})


@app.route("/api/chat", methods=["POST"])
def api_chat():
    """Free-form conversational travel assistant."""
    data    = request.get_json(force=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400

    history = session.get("chat_history", [])
    prompt  = _build_chat_prompt(message, history)
    response = _call_granite(prompt)

    history.append({"role": "user",      "content": message})
    history.append({"role": "assistant", "content": response})
    session["chat_history"] = history[-20:]  # keep last 10 exchanges

    return jsonify({"response": response, "type": "chat"})


@app.route("/api/chat/clear", methods=["POST"])
def api_chat_clear():
    """Clear the conversation history."""
    session.pop("chat_history", None)
    return jsonify({"status": "cleared"})


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "endpoint not found"}), 404


@app.errorhandler(500)
def server_error(e):
    logger.error("Internal server error: %s", e)
    return jsonify({"error": "internal server error"}), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    host  = os.getenv("FLASK_HOST", "0.0.0.0")
    port  = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"

    logger.info("🌍 Atlas Travel Assistant starting on http://%s:%s", host, port)
    app.run(host=host, port=port, debug=debug)

# Atlas AI Travel Assistant

**Powered by IBM Watsonx.ai | IBM Granite Models**

A full-stack AI travel planning application built with Python Flask and IBM Granite. Atlas generates personalised travel plans, itineraries, budget breakdowns, destination recommendations, and more — all through a modern, responsive UI.

---

## Features

| Feature | Description |
|---------|-------------|
| 🗺️ **Trip Planner** | Full AI-generated trip plans with day-by-day itineraries |
| 📅 **Itinerary Manager** | Detailed single-day plans with venues, times, and costs |
| 💰 **Budget Calculator** | Tiered budget breakdowns (budget / mid-range / luxury) |
| 🌍 **Destination Discovery** | Personalised destination recommendations |
| 📊 **Destination Comparison** | Side-by-side comparison of up to 4 destinations |
| 🌤️ **Weather Planner** | Seasonal weather advice and packing guidance |
| ✈️ **Transport Planner** | Multi-modal transport recommendations |
| 🏨 **Accommodation Finder** | Property suggestions across all budget tiers |
| 🎒 **Packing Lists** | Climate- and activity-aware packing checklists |
| 💬 **AI Chat** | Free-form conversational travel assistant |
| 👤 **Traveller Profile** | Persistent preferences that personalise all recommendations |

---

## Project Structure

```
travel_assistant/
├── app.py                  # Flask backend — all API routes
├── agent_instructions.py   # AGENT_INSTRUCTIONS — customise AI behaviour here
├── requirements.txt        # Python dependencies
├── env.template            # Copy to .env and fill in credentials
├── templates/
│   └── index.html          # Single-page application shell
└── static/
    ├── css/
    │   └── style.css       # Dark-first custom styles
    └── js/
        └── main.js         # Frontend controller
```

---

## Quick Start

### 1. Clone / copy the project

```bash
cd travel_assistant
```

### 2. Create a virtual environment and install dependencies

```bash
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure credentials

```bash
# Copy the template
cp env.template .env   # macOS/Linux
copy env.template .env  # Windows
```

Open `.env` and fill in:

```env
IBM_API_KEY=your_ibm_cloud_api_key_here
WATSONX_PROJECT_ID=your_watsonx_project_id_here
FLASK_SECRET_KEY=a_random_32_char_string
```

**Where to get credentials:**
- **IBM API Key:** https://cloud.ibm.com/iam/apikeys → Create an API key
- **Watsonx Project ID:** https://dataplatform.cloud.ibm.com → Your project → Manage → Project ID

### 4. Run the application

```bash
python app.py
```

Open your browser at **http://localhost:5000**

---

## Demo Mode

If credentials are not set, the app runs in **Demo Mode** — all UI features work but responses contain placeholder content. Set credentials and restart to enable live IBM Granite AI responses.

---

## Customise the AI Agent

Edit [`agent_instructions.py`](agent_instructions.py) to change:

| Constant | What it controls |
|----------|-----------------|
| `AGENT_NAME` | The assistant's name (default: Atlas) |
| `AGENT_PERSONA` | Personality and tone |
| `RECOMMENDATION_STYLE` | How recommendations are structured |
| `PLANNING_STRATEGY` | Step-by-step planning approach |
| `SAFETY_RULES` | Hard constraints that can never be overridden |
| `PREFERRED_TRAVEL_STYLES` | Travel styles the agent specialises in |
| `DESTINATION_SPECIALIZATIONS` | Regions / countries with deep knowledge |
| `OUTPUT_FORMAT` | Markdown structure and emoji conventions |
| `LANGUAGE` | Response language (e.g. `"French"`) |

---

## Model Configuration

Edit `.env` to change the Granite model or generation parameters:

```env
GRANITE_MODEL_ID=ibm/granite-3-3-8b-instruct
MAX_NEW_TOKENS=2048
TEMPERATURE=0.7
TOP_P=0.9
TOP_K=50
REPETITION_PENALTY=1.1
```

Available IBM Granite models on Watsonx.ai:
- `ibm/granite-3-3-8b-instruct` — Fast, efficient (default)
- `ibm/granite-13b-chat-v2` — Larger model, richer responses

---

## Production Deployment

### Gunicorn (Linux / macOS)

```bash
gunicorn --workers 4 --bind 0.0.0.0:5000 app:app
```

### Docker

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "--workers", "2", "--bind", "0.0.0.0:5000", "app:app"]
```

```bash
docker build -t atlas-travel .
docker run -p 5000:5000 --env-file .env atlas-travel
```

### IBM Code Engine / Cloud Foundry

```bash
ibmcloud cf push atlas-travel \
  --buildpack python_buildpack \
  -e IBM_API_KEY=<key> \
  -e WATSONX_PROJECT_ID=<id>
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Health check + connection status |
| POST | `/api/plan` | Generate full trip plan |
| POST | `/api/itinerary` | Single-day itinerary |
| POST | `/api/budget` | Budget breakdown |
| POST | `/api/destinations` | Destination recommendations |
| POST | `/api/compare` | Destination comparison |
| POST | `/api/weather` | Weather travel guide |
| POST | `/api/transport` | Transport planning |
| POST | `/api/accommodation` | Accommodation recommendations |
| POST | `/api/packing` | Packing checklist |
| POST | `/api/chat` | Conversational AI chat |
| POST | `/api/chat/clear` | Clear chat session history |

---

## Requirements

- Python 3.10+
- IBM Cloud account with Watsonx.ai access
- Modern browser (Chrome, Firefox, Edge, Safari)

---

## License

MIT License — built with IBM Watsonx.ai and IBM Granite.

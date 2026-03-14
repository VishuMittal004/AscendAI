# AscendAI — AI-Powered Goal Architect

> **6th Semester Minor Project** | AI-driven adaptive learning plan generator with real-time task tracking, multi-goal support, and a premium dashboard UI.

---

## Overview

**AscendAI** is a full-stack web application that converts long-term personal and academic goals into structured, day-by-day learning roadmaps using a locally-running Large Language Model (LLM) via Ollama. The system adapts dynamically — users can add new goals mid-plan, and the AI intelligently merges them into the existing schedule. A persistent SQLite database stores all tasks, goals, and progress metrics, while a sleek React frontend delivers a real-time, animated dashboard experience.

---

## Features

### Core Functionality

| Feature | Description |
|---|---|
| **AI Plan Generation** | Enter a goal, timeline, and daily commitment hours — the AI generates a full day-by-day task plan |
| **Adaptive Mid-Plan Goal Addition** | Add a new goal mid-way through a plan; the AI merges it with the remaining days of the existing plan, keeping both running simultaneously |
| **Task Tracking** | Click to mark tasks as done; progress bars and stats update in real time |
| **Streak Tracking** | Daily streaks are tracked automatically based on task completion activity |
| **Persistent Storage** | All goals, tasks, and stats are saved to a local SQLite database — no data is lost on refresh |
| **Live Stats Panel** | A real-time dashboard banner shows current streak, tasks done, overall progress %, and time invested |
| **Reset / Start Fresh** | A guarded "Reset All" action with a confirmation modal clears all data for a clean restart |

### UI & UX

| Feature | Description |
|---|---|
| **Mock Authentication** | Login page with animated glassmorphism design; accepts any non-empty credentials |
| **Profile Dropdown Menu** | Profile button opens an animated dropdown with Profile, Stats & Reports, and Logout options |
| **Animated Dashboard** | Full Framer Motion animations across all components — cards, banners, task entries, and modals |
| **Stat Cards with Image Backgrounds** | Each stat card supports a blurred translucent background image with a per-card color glow effect |
| **Quick Preset Goals** | One-click goal presets (SSC CGL, Data Structures, Machine Learning, etc.) to populate the form instantly |
| **Progress Bars** | Per-day and per-goal progress bars with smooth animations |
| **Motivational Banner** | Rotating motivational messages displayed prominently above the stats panel |
| **Responsive Layout** | Two-column layout on large screens, single-column on mobile |

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18.x | UI framework with hooks-based state management |
| Vite | 5.x | Lightning-fast build tool and dev server |
| Framer Motion | 12.x | Animations and transitions throughout the UI |
| TailwindCSS | 3.x | Utility-first CSS framework for styling |
| Axios | 1.x | HTTP client for communicating with the backend API |
| Lucide React | 0.292 | Icon library |
| Vanilla CSS | — | Custom design tokens (CSS variables), glassmorphism, glow effects |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.10+ | Primary backend language |
| FastAPI | Latest | REST API framework with automatic OpenAPI docs |
| Uvicorn | Latest | ASGI server for running FastAPI |
| SQLAlchemy | Latest | ORM for database interaction |
| SQLite | Built-in | Local persistent storage (file: `goal_architect.db`) |
| Pydantic | Latest | Request/response schema validation |
| Ollama (local LLM) | — | Hosts local AI model (e.g. `phi3`) for plan generation |
| Requests | Latest | HTTP calls from backend to Ollama API |

### AI / LLM

| Component | Description |
|---|---|
| **Ollama** | Local LLM runtime, runs entirely offline on the user's machine |
| **Model** | `phi3` (Microsoft Phi-3) — configurable in `backend/.env` |
| **Prompt Engineering** | Custom prompts in `prompts.py` for initial plan generation and mid-plan merging |
| **JSON Parsing** | Robust extraction logic to parse structured JSON from LLM output |

---

## Project Structure

```
minor 6th sem/
├── backend/
│   ├── main.py           # FastAPI app, all routes, DB setup, CORS
│   ├── database.py       # SQLAlchemy models (DBGoal, DBTask, Stats)
│   ├── prompts.py        # LLM prompt templates
│   ├── ollama_client.py  # Ollama API wrapper
│   ├── api_client.py     # Internal HTTP utilities
│   ├── requirements.txt  # Python dependencies
│   └── .env              # Environment config (model name, port)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Root component, state management, auth
│   │   ├── index.css             # Global CSS, custom design tokens, animations
│   │   ├── components/
│   │   │   ├── Login.jsx         # Mock login page with glassmorphism UI
│   │   │   ├── Dashboard.jsx     # Main task dashboard, day-grouped view
│   │   │   ├── GoalForm.jsx      # Goal input, presets, plan controls
│   │   │   ├── StatsPanel.jsx    # Live stats cards with image backgrounds
│   │   │   ├── TaskCard.jsx      # Individual task card with toggle
│   │   │   └── DayGroup.jsx      # Groups tasks by day with progress bar
│   │   └── services/
│   │       └── api.js            # All Axios API calls to the backend
│   ├── public/
│   │   └── assets/images/        # Background images for stat cards
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/tasks` | Get all tasks with goal info |
| `GET` | `/stats` | Get user statistics (streak, progress, etc.) |
| `POST` | `/generate` | Generate a full plan for a new goal |
| `POST` | `/add-goal` | Add a new goal to an existing plan (mid-plan merge) |
| `POST` | `/tasks/{id}/toggle` | Mark a task as complete/incomplete |
| `DELETE` | `/reset` | Delete all data and reset stats |

### Example Request — Generate a Plan

```bash
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"goal": "Master Data Structures", "days": 30, "hours_per_day": 2}'
```

### Example Request — Add Goal Mid-Plan

```bash
curl -X POST http://localhost:8000/add-goal \
  -H "Content-Type: application/json" \
  -d '{"goal": "Learn Python Basics", "days": 14, "hours_per_day": 1}'
```

---

## Setup & Run

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com/) installed and running locally
- The `phi3` model pulled: `ollama pull phi3`

### 1. Backend

```bash
cd backend

# Create and activate virtual environment (optional but recommended)
python -m venv venv
venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Run the API server
python -m uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive docs (Swagger UI) at `http://localhost:8000/docs`.

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Configuration

### Backend `.env`

```env
MODEL_NAME=phi3
OLLAMA_BASE_URL=http://localhost:11434
PORT=8000
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (React + Vite)                 │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐  │
│  │  Login   │  │ GoalForm │  │ Dashboard  │  │StatsPanel│  │
│  └──────────┘  └──────────┘  └────────────┘  └──────────┘  │
│                      Axios (api.js)                         │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP REST
┌─────────────────────────▼───────────────────────────────────┐
│                  FastAPI Backend (Python)                    │
│  ┌───────────┐   ┌───────────┐   ┌────────────────────────┐ │
│  │  Routes   │   │  prompts  │   │   SQLAlchemy ORM       │ │
│  │ main.py   │──▶│ prompts.py│   │   database.py          │ │
│  └───────────┘   └─────┬─────┘   └───────────┬────────────┘ │
└────────────────────────┼────────────────────-─┼─────────────┘
                         │ HTTP                  │ SQL
              ┌──────────▼──────────┐  ┌────────▼────────────┐
              │  Ollama (Local LLM) │  │  SQLite Database    │
              │  Model: phi3        │  │  goal_architect.db  │
              └─────────────────────┘  └─────────────────────┘
```

### Data Flow

1. User enters a goal, timeline, and daily hours in the `GoalForm`
2. The frontend sends a `POST /generate` request to FastAPI
3. FastAPI builds a prompt using `prompts.py` and calls the Ollama API
4. The LLM returns a JSON-structured plan; the backend parses and saves tasks to SQLite via SQLAlchemy
5. The frontend polls `/stats` every 2 seconds to keep the stats panel live
6. When a task is toggled, `POST /tasks/{id}/toggle` updates the DB; streaks and progress recalculate server-side

---

## Key Design Decisions

- **Local LLM (Ollama)**: Chosen for privacy, zero API costs, and offline capability — ideal for an academic project environment
- **SQLite**: Simple, zero-configuration, file-based database suitable for single-user local deployment
- **Mock Auth**: Login page included for UI completeness; real authentication can be wired in later
- **Framer Motion**: Used extensively for a premium, polished feel with minimal boilerplate
- **CSS Variables**: All design tokens (colors, backgrounds) are centralized in `index.css` for easy theming
- **Polling**: Stats are polled every 2 seconds instead of WebSockets to keep the backend simple

---

## License

This project is developed for academic purposes as a **6th Semester Minor Project**.

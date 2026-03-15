from fastapi import FastAPI, HTTPException, Depends, status, Form, UploadFile, File, Query, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone, date, timedelta
from typing import List, Optional
import secrets
import re
import asyncio

from mongo import connect_db, close_db, get_db
from auth import hash_password, verify_password, create_access_token, get_current_user
from email_utils import send_verification_email
from models import (
    RegisterRequest, LoginRequest, TokenResponse,
    GoalRequest, AddGoalRequest,
    SessionResponse, TaskResponse, StatsResponse,
    RecalibrateRequest
)
from api_client import generate_completion, OPENROUTER_MODEL
from prompts import build_generation_prompt, build_midplan_addition_prompt, parse_llm_response, build_analysis_prompt, build_quote_prompt

import fitz  # PyMuPDF
import io

# ─── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AscendAI API",
    description="AI-powered learning plan generator with real authentication and session history."
)

import os as _os
_frontend_url = _os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", _frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await connect_db()

@app.on_event("shutdown")
async def shutdown():
    await close_db()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def str_id(doc: dict) -> dict:
    """Convert MongoDB _id to string 'id' field."""
    doc["id"] = str(doc.pop("_id"))
    return doc


async def get_active_session(user_id: str, db):
    """Get the user's current (most recent) active session."""
    session = await db.sessions.find_one(
        {"user_id": user_id, "is_active": True},
        sort=[("created_at", -1)]
    )
    return session


async def compute_stats(user_id: str, session_id: str, db) -> dict:
    """Compute stats for a given session."""
    tasks = await db.tasks.find({"session_id": session_id, "user_id": user_id}).to_list(None)
    total = len(tasks)
    completed = sum(1 for t in tasks if t.get("completed"))
    total_min = sum(t.get("minutes", 0) for t in tasks)
    completed_min = sum(t.get("minutes", 0) for t in tasks if t.get("completed"))
    progress = round((completed / total * 100), 1) if total > 0 else 0.0

    stats_doc = await db.stats.find_one({"user_id": user_id, "session_id": session_id})
    streak = stats_doc.get("current_streak", 0) if stats_doc else 0
    longest = stats_doc.get("longest_streak", 0) if stats_doc else 0

    return {
        "current_streak": streak,
        "longest_streak": longest,
        "total_tasks": total,
        "completed_tasks": completed,
        "progress_percent": progress,
        "total_minutes": total_min,
        "completed_minutes": completed_min,
    }


async def update_streak(user_id: str, session_id: str, task_completed: bool, db):
    """Update streak when a task is toggled."""
    today_str = date.today().isoformat()
    stats = await db["stats"].find_one({"user_id": user_id, "session_id": session_id})

    if not stats:
        stats = {
            "user_id": user_id,
            "session_id": session_id,
            "current_streak": 0,
            "longest_streak": 0,
            "last_activity_date": None,
        }
        await db["stats"].insert_one(stats)
        stats = await db["stats"].find_one({"user_id": user_id, "session_id": session_id})

    if task_completed:
        if stats.get("last_activity_date") == today_str:
            pass  # Already counted today
        else:
            yesterday = (date.today() - timedelta(days=1)).isoformat()
            new_streak = (stats["current_streak"] + 1) if stats.get("last_activity_date") == yesterday else 1
            new_longest = max(stats["longest_streak"], new_streak)
            await db["stats"].update_one(
                {"user_id": user_id, "session_id": session_id},
                {"$set": {
                    "current_streak": new_streak,
                    "longest_streak": new_longest,
                    "last_activity_date": today_str
                }}
            )
    else:
        # Check if we should break the streak (if no other tasks completed today)
        today_tasks = await db.tasks.count_documents({
            "session_id": session_id,
            "user_id": user_id,
            "completed": True
        })
        if today_tasks == 0 and stats.get("last_activity_date") == today_str:
            yesterday = (date.today() - timedelta(days=1)).isoformat()
            await db["stats"].update_one(
                {"user_id": user_id, "session_id": session_id},
                {"$set": {
                    "current_streak": max(0, stats["current_streak"] - 1),
                    "last_activity_date": yesterday # Reset so it can increment again if re-completed today
                }}
            )

async def extract_text_from_file(file: bytes, filename: str) -> str:
    """Extract text from uploaded syllabus files."""
    if not file:
        return ""
    
    text = ""
    filename_lower = filename.lower()
    
    try:
        if filename_lower.endswith('.pdf'):
            # Use PyMuPDF to extract text
            doc = fitz.open(stream=file, filetype="pdf")
            for page in doc:
                text += page.get_text() + "\n"
        elif filename_lower.endswith(('.png', '.jpg', '.jpeg')):
            # Images are handled via OpenAI vision (base64) in the generation routes
            # No server-side text extraction needed for images
            pass
        elif filename_lower.endswith('.txt'):
            text = file.decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"Error parsing file: {e}")
        
    return text.strip()

# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "ok", "app": "AscendAI", "version": "2.0"}


# ─── Auth Routes ──────────────────────────────────────────────────────────────

@app.post("/auth/register", status_code=201)
async def register(body: RegisterRequest, background_tasks: BackgroundTasks):
    db = get_db()

    # Validate username
    if not re.match(r'^[a-zA-Z0-9_]{3,20}$', body.username):
        raise HTTPException(400, "Username must be 3-20 characters, letters/numbers/underscores only")

    # Validate password length
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    # Check duplicates
    existing = await db.users.find_one({
        "$or": [{"email": body.email.lower()}, {"username": body.username}]
    })
    if existing:
        if existing.get("email") == body.email.lower():
            raise HTTPException(409, "An account with this email already exists")
        raise HTTPException(409, "This username is already taken")

    # Create verification token
    token = secrets.token_urlsafe(32)

    user_doc = {
        "username": body.username,
        "email": body.email.lower(),
        "hashed_password": hash_password(body.password),
        "is_verified": False,
        "verification_token": token,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(user_doc)

    # Send email in background so registration response is instant
    background_tasks.add_task(
        send_verification_email, body.email, body.username, token
    )

    return {
        "message": "Account created! Please check your email to verify your account.",
        "email": body.email,
        "username": body.username
    }


@app.get("/auth/verify/{token}")
async def verify_email(token: str):
    db = get_db()
    user = await db.users.find_one({"verification_token": token})
    if not user:
        raise HTTPException(400, "Invalid or expired verification token")

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_verified": True, "verification_token": None}}
    )
    return {"message": "Email verified successfully! You can now log in."}


@app.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    db = get_db()
    user = await db.users.find_one({"email": body.email.lower()})

    if not user:
        raise HTTPException(404, "Account not found. Please create an account first.")

    if not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(401, "Invalid email or password")

    if not user.get("is_verified"):
        raise HTTPException(403, "Please verify your email before logging in. Check your inbox.")

    token = create_access_token(
        str(user["_id"]), user["username"], user["email"]
    )
    return TokenResponse(
        access_token=token,
        username=user["username"],
        email=user["email"]
    )


@app.get("/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    return {
        "id": str(current_user["_id"]),
        "username": current_user["username"],
        "email": current_user["email"],
        "is_verified": current_user["is_verified"],
        "created_at": current_user["created_at"],
    }


# ─── Session Routes ───────────────────────────────────────────────────────────

@app.post("/sessions/new", status_code=201)
async def create_new_session(current_user=Depends(get_current_user)):
    """Create a new session (replaces 'Reset All'). Old session data is preserved."""
    db = get_db()
    user_id = str(current_user["_id"])

    # Deactivate any current active sessions
    await db.sessions.update_many(
        {"user_id": user_id, "is_active": True},
        {"$set": {"is_active": False}}
    )

    now = datetime.now(timezone.utc)
    session_doc = {
        "user_id": user_id,
        "name": f"Plan — {now.strftime('%d %b %Y, %I:%M %p')}",
        "created_at": now,
        "is_active": True,
    }
    result = await db.sessions.insert_one(session_doc)
    return {
        "message": "New session started. Your previous plan is saved in History.",
        "session_id": str(result.inserted_id),
        "name": session_doc["name"],
        "created_at": now
    }


@app.post("/sessions/{session_id}/restore")
async def restore_session(session_id: str, current_user=Depends(get_current_user)):
    """Re-activate a past session so it appears on the dashboard again."""
    db = get_db()
    user_id = str(current_user["_id"])

    try:
        obj_id = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID.")

    target = await db.sessions.find_one({"_id": obj_id, "user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Session not found.")

    # Deactivate all sessions for this user
    await db.sessions.update_many(
        {"user_id": user_id, "is_active": True},
        {"$set": {"is_active": False}}
    )

    # Activate the target session
    await db.sessions.update_one(
        {"_id": obj_id},
        {"$set": {"is_active": True}}
    )

    return {"message": "Session restored successfully.", "session_id": session_id}


@app.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(current_user=Depends(get_current_user)):
    """List all sessions for this user, newest first."""
    db = get_db()
    user_id = str(current_user["_id"])
    sessions = await db.sessions.find(
        {"user_id": user_id}
    ).sort("created_at", -1).to_list(None)

    result = []
    for s in sessions:
        sid = str(s["_id"])
        total = await db.tasks.count_documents({"session_id": sid})
        completed = await db.tasks.count_documents({"session_id": sid, "completed": True})
        goals_cursor = await db.goals.find({"session_id": sid}, {"title": 1}).to_list(None)
        goal_titles = [g.get("title", "Untitled Goal") for g in goals_cursor]
        goal_count = len(goal_titles)
        result.append(SessionResponse(
            id=sid,
            name=s["name"],
            created_at=s["created_at"],
            goals=goal_titles,
            goal_count=goal_count,
            task_count=total,
            completed_task_count=completed
        ))
    return result


@app.get("/sessions/{session_id}/tasks")
async def get_session_tasks(session_id: str, current_user=Depends(get_current_user)):
    """Get all tasks for a specific (past) session."""
    db = get_db()
    user_id = str(current_user["_id"])

    # Validate ObjectId
    try:
        obj_id = ObjectId(session_id)
    except InvalidId:
        raise HTTPException(400, "Invalid session ID format")

    # Verify this session belongs to the user
    session = await db.sessions.find_one({"_id": obj_id, "user_id": user_id})
    if not session:
        raise HTTPException(404, "Session not found")

    goals = await db.goals.find({"session_id": session_id}).to_list(None)
    goal_map = {str(g["_id"]): g["title"] for g in goals}

    tasks = await db.tasks.find({"session_id": session_id}).to_list(None)
    return [
        TaskResponse(
            id=str(t["_id"]),
            description=t["description"],
            day_number=t["day_number"],
            minutes=t.get("minutes", 30),
            difficulty=t.get("difficulty", "medium"),
            completed=t.get("completed", False),
            goal_title=goal_map.get(str(t.get("goal_id", "")), "Unknown"),
            goal_id=str(t.get("goal_id", "")),
            day_concept=t.get("day_concept"),
            resources=t.get("resources", [])
        ) for t in tasks
    ]


# ─── Task & Stats Routes (Active Session) ─────────────────────────────────────

@app.get("/tasks")
async def get_tasks(current_user=Depends(get_current_user)):
    db = get_db()
    user_id = str(current_user["_id"])

    session = await get_active_session(user_id, db)
    if not session:
        return []

    session_id = str(session["_id"])
    goals = await db.goals.find({"session_id": session_id}).to_list(None)
    goal_map = {str(g["_id"]): g["title"] for g in goals}

    tasks = await db.tasks.find({"session_id": session_id}).to_list(None)
    return [
        TaskResponse(
            id=str(t["_id"]),
            description=t["description"],
            day_number=t["day_number"],
            minutes=t.get("minutes", 30),
            difficulty=t.get("difficulty", "medium"),
            completed=t.get("completed", False),
            goal_title=goal_map.get(str(t.get("goal_id", "")), "Unknown"),
            goal_id=str(t.get("goal_id", "")),
            day_concept=t.get("day_concept"),
            resources=t.get("resources", [])
        ) for t in tasks
    ]


@app.get("/stats")
async def get_stats(current_user=Depends(get_current_user)):
    db = get_db()
    user_id = str(current_user["_id"])

    session = await get_active_session(user_id, db)
    if not session:
        return StatsResponse(
            current_streak=0, longest_streak=0, total_tasks=0,
            completed_tasks=0, progress_percent=0.0,
            total_minutes=0, completed_minutes=0
        )

    stats = await compute_stats(user_id, str(session["_id"]), db)
    return StatsResponse(**stats)


@app.post("/tasks/{task_id}/toggle")
async def toggle_task(task_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    user_id = str(current_user["_id"])

    # Validate ObjectId
    try:
        obj_id = ObjectId(task_id)
    except InvalidId:
        raise HTTPException(400, "Invalid task ID format")

    task = await db.tasks.find_one({"_id": obj_id, "user_id": user_id})
    if not task:
        raise HTTPException(404, "Task not found")

    new_status = not task.get("completed", False)
    await db.tasks.update_one(
        {"_id": obj_id},
        {"$set": {
            "completed": new_status,
            "completed_at": datetime.now(timezone.utc) if new_status else None
        }}
    )
    await update_streak(user_id, task["session_id"], new_status, db)
    return {"completed": new_status}

@app.post("/tasks/recalibrate")
async def recalibrate_tasks(
    current_user=Depends(get_current_user),
    body: Optional[RecalibrateRequest] = None
):
    try:
        db = get_db()
        user_id = str(current_user["_id"])
        
        session = await get_active_session(user_id, db)
        if not session:
            raise HTTPException(400, "No active session to recalibrate.")
        
        session_id = str(session["_id"])
        
        # Replicating main2.py explicit logic for BOTH modes
        start_day = body.day_number if body else None
        
        all_tasks = await db.tasks.find({"session_id": session_id, "user_id": user_id}).to_list(length=None)
        if not all_tasks:
            return {"message": "No tasks found."}
            
        total_days = max(t.get("day_number", 1) for t in all_tasks)
        incomplete_tasks = [t for t in all_tasks if not t.get("completed")]
        
        if not incomplete_tasks:
            return {"message": "All tasks are completed!"}
            
        # Determine the anchor day (either provided by partial button, or earliest incomplete)
        earliest_incomplete_day = min(t.get("day_number", 1) for t in incomplete_tasks)
        target_day = start_day if start_day is not None else earliest_incomplete_day
        
        # If this is the global 'Missed a Day' button, we reset the streak too
        if start_day is None:
            await db["stats"].update_one(
                {"user_id": user_id, "session_id": session_id},
                {"$set": {"current_streak": 0, "last_activity_date": None}}
            )

        if target_day >= total_days:
            # Shift only the tasks from this target day forward by one day
            shifted_count = 0
            for t in incomplete_tasks:
                if t.get("day_number") == target_day:
                    await db.tasks.update_one({"_id": t["_id"]}, {"$inc": {"day_number": 1}})
                    shifted_count += 1
            return {"message": f"Added 1 extra day for {shifted_count} remaining tasks.", "tasks_shifted": shifted_count}

        missed_tasks = [t for t in incomplete_tasks if t.get("day_number") == target_day]
        remaining_days = list(range(target_day + 1, total_days + 1))

        if missed_tasks and remaining_days:
            for i, task in enumerate(missed_tasks):
                new_day = remaining_days[i % len(remaining_days)]
                await db.tasks.update_one({"_id": task["_id"]}, {"$set": {"day_number": new_day}})

        return {
            "message": f"Redistributed {len(missed_tasks)} tasks across {len(remaining_days)} remaining days.",
            "tasks_shifted": len(missed_tasks),
            "from_day": target_day
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error recalibrating tasks: {str(e)}")


@app.post("/sessions/{session_id}/analyze")
async def analyze_session(session_id: str, current_user=Depends(get_current_user)):
    """Generate a performance analysis for a completed/ended session."""
    db = get_db()
    user_id = str(current_user["_id"])

    # Verify session
    if session_id == "active":
        session = await get_active_session(user_id, db)
    else:
        try:
            session = await db.sessions.find_one({"_id": ObjectId(session_id), "user_id": user_id})
        except Exception:
            session = None
            
    if not session:
        raise HTTPException(404, "Session not found")
        
    actual_session_id = str(session["_id"])

    tasks = await db.tasks.find({"session_id": actual_session_id}).to_list(None)
    if not tasks:
        raise HTTPException(400, "No tasks found to analyze")

    goals = await db.goals.find({"session_id": actual_session_id}).to_list(None)
    goal_title = goals[0]["title"] if goals else "Your Session"

    completed = [t["description"] for t in tasks if t.get("completed")]
    incomplete = [t["description"] for t in tasks if not t.get("completed")]

    prompt = build_analysis_prompt(goal_title, completed, incomplete)
    
    try:
        raw_response = await run_in_threadpool(generate_completion, prompt, OPENROUTER_MODEL)
        return {"analysis": raw_response}
    except Exception as e:
        print(f"Analysis Generation Error: {e}")
        raise HTTPException(500, "Failed to generate analysis")


@app.get("/quote")
async def get_quote():
    """Generate a dynamic motivational quote from the LLM."""
    prompt = build_quote_prompt()
    try:
        raw_response = await run_in_threadpool(generate_completion, prompt, OPENROUTER_MODEL)
        
        # Clean up the response (remove quotes, strip whitespace)
        quote = raw_response.strip().strip('"').strip("'")
        
        return {"quote": quote}
    except Exception as e:
        print(f"Quote Generation Error: {e}")
        # Fallback quote in case of error
        return {"quote": "Consistency beats intensity. Keep going!"}

# ─── Export Route ──────────────────────────────────────────────────────────────

@app.get("/export")
async def export_session_data(current_user=Depends(get_current_user)):
    """Export all data for the active session: goals, tasks (day-wise), notes, resources."""
    db = get_db()
    user_id = str(current_user["_id"])

    session = await get_active_session(user_id, db)
    if not session:
        raise HTTPException(400, "No active session to export.")

    session_id = str(session["_id"])

    # Goals
    goals = await db.goals.find({"session_id": session_id}).to_list(None)
    goal_titles = [g["title"] for g in goals]

    # Tasks grouped by day
    tasks = await db.tasks.find({"session_id": session_id}).sort("day_number", 1).to_list(None)
    goal_map = {str(g["_id"]): g["title"] for g in goals}

    days_map = {}
    for t in tasks:
        day = t.get("day_number", 1)
        if day not in days_map:
            days_map[day] = []
        days_map[day].append({
            "description": t.get("description", ""),
            "completed": t.get("completed", False),
            "minutes": t.get("minutes", 30),
            "difficulty": t.get("difficulty", "medium"),
            "goal_title": goal_map.get(str(t.get("goal_id", "")), "Unknown"),
            "resources": t.get("resources", [])
        })

    days_list = [{"day": d, "tasks": days_map[d]} for d in sorted(days_map.keys())]

    # Notes
    note = await db.notes.find_one({"user_id": user_id, "session_id": session_id})
    notes_content = note.get("content", "") if note else ""

    # Stats
    stats = await compute_stats(user_id, session_id, db)

    return {
        "session_name": session.get("name", "Learning Plan"),
        "goals": goal_titles,
        "days": days_list,
        "notes": notes_content,
        "stats": stats
    }


# ─── Quick Notes Routes ───────────────────────────────────────────────────────

@app.get("/notes")
async def get_notes(current_user=Depends(get_current_user)):
    """Get the quick notes for the user's active session."""
    db = get_db()
    user_id = str(current_user["_id"])

    session = await get_active_session(user_id, db)
    if not session:
        return {"content": ""}

    session_id = str(session["_id"])
    note = await db.notes.find_one({"user_id": user_id, "session_id": session_id})
    return {"content": note.get("content", "") if note else ""}


@app.put("/notes")
async def save_notes(body: dict, current_user=Depends(get_current_user)):
    """Save/update quick notes for the user's active session."""
    db = get_db()
    user_id = str(current_user["_id"])

    session = await get_active_session(user_id, db)
    if not session:
        raise HTTPException(400, "No active session. Generate a plan first.")

    session_id = str(session["_id"])
    content = body.get("content", "")

    await db.notes.update_one(
        {"user_id": user_id, "session_id": session_id},
        {"$set": {
            "content": content,
            "updated_at": datetime.now(timezone.utc)
        },
        "$setOnInsert": {
            "created_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    return {"message": "Notes saved.", "content": content}


# ─── Plan Generation Routes ───────────────────────────────────────────────────

@app.post("/generate")
async def generate_plan(
    goal: str = Form(""),
    days: int = Form(...),
    hours_per_day: int = Form(...),
    force_regenerate: bool = Form(False),
    difficulty: str = Form("Intermediate"),
    include_resources: bool = Form(False),
    file: UploadFile = File(None),
    current_user=Depends(get_current_user)
):
    db = get_db()
    user_id = str(current_user["_id"])

    # Ensure there is an active session — create one if not
    session = await get_active_session(user_id, db)
    if not session:
        now = datetime.now(timezone.utc)
        session_doc = {
            "user_id": user_id,
            "name": f"Plan — {now.strftime('%d %b %Y, %I:%M %p')}",
            "created_at": now,
            "is_active": True,
        }
        result = await db.sessions.insert_one(session_doc)
        session = await db.sessions.find_one({"_id": result.inserted_id})

    session_id = str(session["_id"])

    # Check if goal exists (if not force_regenerate, add to existing plan)
    existing_goals = await db.goals.count_documents({"session_id": session_id})
    if existing_goals > 0 and not force_regenerate:
        raise HTTPException(
            400,
            "A plan already exists in this session. Use /add-goal to add a new goal, or /sessions/new to start fresh."
        )

    if force_regenerate:
        await db.tasks.delete_many({"session_id": session_id, "user_id": user_id})
        await db.goals.delete_many({"session_id": session_id, "user_id": user_id})
        
    syllabus_text = None
    image_base64 = None
    image_mime_type = None
    
    if file:
        file_bytes = await file.read()
        filename_lower = file.filename.lower()
        if filename_lower.endswith(('.png', '.jpg', '.jpeg')):
            import base64
            image_base64 = base64.b64encode(file_bytes).decode('utf-8')
            image_mime_type = file.content_type or 'image/jpeg'
        else:
            syllabus_text = await extract_text_from_file(file_bytes, file.filename)

    # Generate plan with LLM (Offloaded to threadpool)
    prompt = build_generation_prompt(goal, days, hours_per_day, difficulty, include_resources, syllabus_text)
    
    raw_response = await run_in_threadpool(generate_completion, prompt, OPENROUTER_MODEL, image_base64, image_mime_type)
    parsed_data = parse_llm_response(raw_response)  # returns dict with 'goal_title' and 'days'
    parsed_days = parsed_data.get("days", [])

    if not parsed_days:
        raise HTTPException(500, "AI failed to generate a valid plan. Please try again.")

    # Default goal title if none provided
    final_goal = goal if goal.strip() else parsed_data.get("goal_title", file.filename if file else "Custom Syllabus")

    # Store goal — use the user-supplied goal string or fallback as the title
    goal_doc = {
        "session_id": session_id,
        "user_id": user_id,
        "title": final_goal,
        "days": days,
        "hours_per_day": hours_per_day,
        "difficulty": difficulty,
        "created_at": datetime.now(timezone.utc),
    }
    goal_result = await db.goals.insert_one(goal_doc)
    goal_id = str(goal_result.inserted_id)

    # Flatten days → tasks into individual task documents
    task_docs = []
    minutes_per_task = max(15, int(hours_per_day * 60 / 3))
    for day_obj in parsed_days:
        day_num = day_obj.get("day", 1)
        day_concept = day_obj.get("concept", None)
        for t in day_obj.get("tasks", []):
            # Parse time string like "30 min" or "1 hour" into minutes
            time_str = t.get("time", "")
            mins = minutes_per_task
            if "hour" in time_str:
                try: mins = int(float(time_str.split()[0]) * 60)
                except: pass
            elif "min" in time_str:
                try: mins = int(time_str.split()[0])
                except: pass

            task_docs.append({
                "goal_id": goal_id,
                "session_id": session_id,
                "user_id": user_id,
                "description": t.get("title", t.get("description", "Study task")),
                "day_number": day_num,
                "day_concept": day_concept,
                "minutes": mins,
                "difficulty": t.get("difficulty", difficulty),
                "completed": False,
                "completed_at": None,
                "created_at": datetime.now(timezone.utc),
                "resources": t.get("resources", [])
            })

    if task_docs:
        await db.tasks.insert_many(task_docs)

    total_tasks = len(task_docs)
    return {
        "message": f"Plan created for '{goal_doc['title']}' with {total_tasks} tasks over {days} days.",
        "goal_id": goal_id,
        "total_tasks": total_tasks
    }


@app.post("/add-goal")
async def add_goal_to_plan(
    new_goal: str = Form(""),
    days: int = Form(...),
    hours_per_day: int = Form(...),
    difficulty: str = Form("Intermediate"),
    include_resources: bool = Form(False),
    file: UploadFile = File(None),
    current_user=Depends(get_current_user)
):
    db = get_db()
    user_id = str(current_user["_id"])

    session = await get_active_session(user_id, db)
    if not session:
        raise HTTPException(400, "No active session. Generate a plan first.")

    session_id = str(session["_id"])

    # Get current tasks to build context for mid-plan prompt
    existing_tasks = await db.tasks.find(
        {"session_id": session_id, "completed": False}
    ).to_list(None)

    existing_summary = f"{len(existing_tasks)} remaining tasks over {days} days"
    
    syllabus_text = None
    image_base64 = None
    image_mime_type = None

    if file:
        file_bytes = await file.read()
        filename_lower = file.filename.lower()
        if filename_lower.endswith(('.png', '.jpg', '.jpeg')):
            import base64
            image_base64 = base64.b64encode(file_bytes).decode('utf-8')
            image_mime_type = file.content_type or 'image/jpeg'
        else:
            syllabus_text = await extract_text_from_file(file_bytes, file.filename)
        
    prompt = build_midplan_addition_prompt(
        new_goal, days, hours_per_day, existing_summary, difficulty, include_resources, syllabus_text
    )
    
    raw_response = await run_in_threadpool(generate_completion, prompt, OPENROUTER_MODEL, image_base64, image_mime_type)
    parsed_data = parse_llm_response(raw_response)
    parsed_days = parsed_data.get("days", [])

    if not parsed_days:
        raise HTTPException(500, "AI failed to generate a valid plan. Please try again.")

    # Default new goal title if none provided
    final_new_goal = new_goal if new_goal.strip() else parsed_data.get("goal_title", file.filename if file else "Custom Syllabus")

    # Store new goal
    goal_doc = {
        "session_id": session_id,
        "user_id": user_id,
        "title": final_new_goal,
        "days": days,
        "hours_per_day": hours_per_day,
        "difficulty": difficulty,
        "created_at": datetime.now(timezone.utc),
    }
    goal_result = await db.goals.insert_one(goal_doc)
    goal_id = str(goal_result.inserted_id)

    task_docs = []
    minutes_per_task = max(15, int(hours_per_day * 60 / 3))
    for day_obj in parsed_days:
        day_num = day_obj.get("day", 1)
        day_concept = day_obj.get("concept", None)
        for t in day_obj.get("tasks", []):
            time_str = t.get("time", "")
            mins = minutes_per_task
            if "hour" in time_str:
                try: mins = int(float(time_str.split()[0]) * 60)
                except: pass
            elif "min" in time_str:
                try: mins = int(time_str.split()[0])
                except: pass
            task_docs.append({
                "goal_id": goal_id,
                "session_id": session_id,
                "user_id": user_id,
                "description": t.get("title", t.get("description", "Study task")),
                "day_number": day_num,
                "day_concept": day_concept,
                "minutes": mins,
                "difficulty": t.get("difficulty", difficulty), # Aligned difficulty
                "completed": False,
                "completed_at": None,
                "created_at": datetime.now(timezone.utc),
                "resources": t.get("resources", []) # Added missing resources
            })

    if task_docs:
        await db.tasks.insert_many(task_docs)

    return {
        "message": f"'{goal_doc['title']}' added to your current plan with {len(task_docs)} new tasks.",
        "goal_id": goal_id,
        "total_new_tasks": len(task_docs)
    }

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timezone, date, timedelta
from typing import Optional
import re

from database import get_db, init_db, Goal as DBGoal, Task as DBTask, UserStats as DBUserStats
from api_client import generate_completion
from prompts import build_generation_prompt, build_midplan_addition_prompt, parse_llm_response

# Initialize DB
init_db()

app = FastAPI(
    title="Goal Architect API",
    description="AI-powered learning plan generator with task tracking and streak management."
)

# CORS — allow frontend to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response Models ───────────────────────────────────────────────

class GoalRequest(BaseModel):
    goal: str
    days: int
    hours_per_day: int
    force_regenerate: bool = False

class MissedDayRequest(BaseModel):
    missed_date: str

class AddGoalRequest(BaseModel):
    new_goal: str
    days: int
    hours_per_day: int


# ─── Helper: Get or Create UserStats ─────────────────────────────────────────

def get_or_create_stats(db: Session) -> DBUserStats:
    stats = db.query(DBUserStats).first()
    if not stats:
        stats = DBUserStats(
            current_streak=0,
            longest_streak=0,
            last_activity_date=None,
            total_tasks_completed=0
        )
        db.add(stats)
        db.commit()
        db.refresh(stats)
    return stats


def update_streak(db: Session, task_was_completed: bool):
    """Update streak logic when a task is toggled."""
    stats = get_or_create_stats(db)
    today_str = date.today().isoformat()

    if task_was_completed:
        if stats.last_activity_date == today_str:
            # Already active today — don't double-count streak
            pass
        else:
            yesterday = (date.today() - timedelta(days=1)).isoformat()
            if stats.last_activity_date == yesterday:
                stats.current_streak += 1
            else:
                stats.current_streak = 1

        stats.last_activity_date = today_str
        stats.total_tasks_completed += 1
        stats.longest_streak = max(stats.longest_streak, stats.current_streak)
    else:
        # Task was uncompleted
        stats.total_tasks_completed = max(0, stats.total_tasks_completed - 1)

    db.commit()


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"message": "Goal Architect API", "status": "running"}


@app.post("/generate_plan")
def generate_plan(request: GoalRequest, db: Session = Depends(get_db)):
    """Generate an AI-powered study plan."""

    # 1. Check cache
    if not request.force_regenerate:
        existing_goal = db.query(DBGoal).filter(
            DBGoal.title == request.goal,
            DBGoal.days == request.days,
            DBGoal.hours_per_day == request.hours_per_day
        ).first()

        if existing_goal:
            existing_tasks = db.query(DBTask).filter(DBTask.goal_id == existing_goal.id).all()
            if existing_tasks:
                return {"message": "Returned cached plan", "goal_id": existing_goal.id, "cached": True}

    # 2. Save goal
    new_goal = DBGoal(title=request.goal, days=request.days, hours_per_day=request.hours_per_day)
    db.add(new_goal)
    db.commit()
    db.refresh(new_goal)

    # 3. Generate via AI
    prompt = build_generation_prompt(request.goal, request.days, request.hours_per_day)
    print(f"Generating plan for '{request.goal}' ({request.days} days)...")
    llm_response = generate_completion(prompt)

    if not llm_response:
        raise HTTPException(status_code=500, detail="AI service unavailable. Please try again.")

    # 4. Parse response
    parsed_plan = parse_llm_response(llm_response)

    if not parsed_plan:
        raise HTTPException(status_code=500, detail="AI returned invalid format. Please try again.")

    # 5. Clear old tasks and save new ones
    db.query(DBTask).delete()
    db.commit()

    # Reset stats for new plan
    stats = get_or_create_stats(db)
    stats.total_tasks_completed = 0
    stats.current_streak = 0
    db.commit()

    for day_plan in parsed_plan:
        for task_data in day_plan["tasks"]:
            new_task = DBTask(
                goal_id=new_goal.id,
                day=day_plan["day"],
                concept=day_plan["concept"],
                description=task_data["title"],
                estimated_time=task_data.get("time", "30 min"),
                difficulty=task_data.get("difficulty", "medium"),
                completed=False,
                completed_at=None
            )
            db.add(new_task)

    db.commit()
    return {"message": "Plan generated successfully", "goal_id": new_goal.id, "plan": parsed_plan}


@app.post("/add_goal_to_plan")
def add_goal_to_plan(request: AddGoalRequest, db: Session = Depends(get_db)):
    """Add a new goal to the current active plan, merging remaining tasks."""
    
    # 1. Fetch incomplete tasks to determine remaining days and context
    incomplete_tasks = db.query(DBTask).filter(DBTask.completed == False).order_by(DBTask.day.asc()).all()
    
    if not incomplete_tasks:
        raise HTTPException(status_code=400, detail="No active, incomplete plan exists to add to. Create a new plan instead.")

    # Find the earliest incomplete day to anchor our new plan
    earliest_day = incomplete_tasks[0].day
    
    # We use the exactly requested days for the new timeline
    remaining_days = request.days
    hours_per_day = request.hours_per_day
    
    # We still want the old total_days just to see what the old context was, but the new plan
    # will overwrite everything from earliest_day onwards for `remaining_days` length.
    old_total_days = max(t.day for t in db.query(DBTask).all())

    # 3. Create a summary of existing tasks to pass to the LLM
    existing_tasks_summary = ""
    for current_day in range(earliest_day, old_total_days + 1):
        day_tasks = [t for t in incomplete_tasks if t.day == current_day]
        if day_tasks:
            existing_tasks_summary += f"- Day {current_day} original topics: " + ", ".join([t.description for t in day_tasks]) + "\n"

    # 4. Generate combined plan via AI
    prompt = build_midplan_addition_prompt(request.new_goal, remaining_days, hours_per_day, existing_tasks_summary)
    print(f"Generating merged plan adding '{request.new_goal}' for {remaining_days} remaining days...")
    llm_response = generate_completion(prompt)

    if not llm_response:
        raise HTTPException(status_code=500, detail="AI service unavailable. Please try again.")

    parsed_plan = parse_llm_response(llm_response)

    if not parsed_plan:
        raise HTTPException(status_code=500, detail="AI returned invalid format. Please try again.")

    # 5. Save the new goal record
    new_goal_record = DBGoal(title=request.new_goal, days=remaining_days, hours_per_day=hours_per_day)
    db.add(new_goal_record)
    
    # 6. Delete old incomplete tasks
    db.query(DBTask).filter(DBTask.completed == False).delete()
    db.commit()

    # 7. Insert new merged tasks, offsetting 'day' to start at earliest_day
    # The new plan duration is determined entirely by request.days.
    for day_plan in parsed_plan:
        # The LLM generates days 1..N. We map them to earliest_day..(earliest_day + request.days - 1)
        actual_day = earliest_day + (day_plan["day"] - 1)

        for task_data in day_plan["tasks"]:
            new_task = DBTask(
                goal_id=new_goal_record.id, # Link to the new combined goal record
                day=actual_day,
                concept=day_plan["concept"],
                description=task_data["title"],
                estimated_time=task_data.get("time", "30 min"),
                difficulty=task_data.get("difficulty", "medium"),
                completed=False,
                completed_at=None
            )
            db.add(new_task)

    db.commit()
    return {"message": "Goal added and plan reformulated", "plan": parsed_plan}


@app.get("/tasks")
def get_tasks(db: Session = Depends(get_db)):
    """Get all tasks with full metadata."""
    tasks = db.query(DBTask).order_by(DBTask.day.asc(), DBTask.id.asc()).all()
    return {
        "tasks": [
            {
                "id": t.id,
                "goal_id": t.goal_id,
                "day": t.day,
                "concept": t.concept,
                "description": t.description,
                "estimated_time": t.estimated_time,
                "difficulty": t.difficulty,
                "completed": t.completed,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None
            }
            for t in tasks
        ]
    }


@app.patch("/tasks/{task_id}/toggle")
def toggle_task(task_id: int, db: Session = Depends(get_db)):
    """Toggle task completion. Persists to DB and updates streak."""
    task = db.query(DBTask).filter(DBTask.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Toggle
    task.completed = not task.completed
    task.completed_at = datetime.now(timezone.utc) if task.completed else None

    db.commit()

    # Update streak
    update_streak(db, task.completed)

    return {
        "id": task.id,
        "completed": task.completed,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None
    }


@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """Get real-time progress analytics."""
    stats = get_or_create_stats(db)

    total_tasks = db.query(DBTask).count()
    completed_tasks = db.query(DBTask).filter(DBTask.completed == True).count()
    progress_percent = round((completed_tasks / total_tasks) * 100) if total_tasks > 0 else 0

    # Calculate total estimated learning time
    tasks = db.query(DBTask).all()
    total_minutes = 0
    completed_minutes = 0
    for t in tasks:
        minutes = _parse_time_to_minutes(t.estimated_time)
        total_minutes += minutes
        if t.completed:
            completed_minutes += minutes

    # Days info
    total_days = db.query(DBTask.day).distinct().count()
    completed_days = 0
    if total_days > 0:
        for day_num in db.query(DBTask.day).distinct().all():
            day_tasks = db.query(DBTask).filter(DBTask.day == day_num[0]).all()
            if all(t.completed for t in day_tasks):
                completed_days += 1

    return {
        "current_streak": stats.current_streak,
        "longest_streak": stats.longest_streak,
        "last_activity_date": stats.last_activity_date,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "progress_percent": progress_percent,
        "total_days": total_days,
        "completed_days": completed_days,
        "total_minutes": total_minutes,
        "completed_minutes": completed_minutes,
    }


@app.post("/missed_day")
def missed_day(request: MissedDayRequest, db: Session = Depends(get_db)):
    """Redistribute incomplete tasks across remaining days."""
    all_tasks = db.query(DBTask).order_by(DBTask.day.asc()).all()
    if not all_tasks:
        return {"message": "No tasks found."}

    total_days = max(t.day for t in all_tasks)
    incomplete_tasks = [t for t in all_tasks if not t.completed]

    if not incomplete_tasks:
        return {"message": "All tasks are completed!"}

    earliest_incomplete_day = min(t.day for t in incomplete_tasks)

    if earliest_incomplete_day == total_days:
        for t in incomplete_tasks:
            if t.day == earliest_incomplete_day:
                t.day += 1
        db.commit()
        return {"message": "Added 1 extra day for remaining tasks."}

    missed_tasks = [t for t in incomplete_tasks if t.day == earliest_incomplete_day]
    remaining_days = list(range(earliest_incomplete_day + 1, total_days + 1))

    if missed_tasks and remaining_days:
        for i, task in enumerate(missed_tasks):
            task.day = remaining_days[i % len(remaining_days)]

    db.commit()
    return {
        "message": f"Redistributed {len(missed_tasks)} tasks across {len(remaining_days)} remaining days."
    }


@app.delete("/reset")
def reset_all(db: Session = Depends(get_db)):
    """Clear all data and start fresh."""
    db.query(DBTask).delete()
    db.query(DBGoal).delete()
    stats = get_or_create_stats(db)
    stats.current_streak = 0
    stats.longest_streak = 0
    stats.last_activity_date = None
    stats.total_tasks_completed = 0
    db.commit()
    return {"message": "All data cleared."}


def _parse_time_to_minutes(time_str: str) -> int:
    """Parse time strings like '30 min', '1 hour', '1.5 hours' into minutes."""
    if not time_str:
        return 30
    time_str = time_str.lower().strip()
    try:
        if "hour" in time_str:
            num = float(re.sub(r'[^0-9.]', '', time_str))
            return int(num * 60)
        elif "min" in time_str:
            num = float(re.sub(r'[^0-9.]', '', time_str))
            return int(num)
        else:
            return 30
    except (ValueError, TypeError):
        return 30


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

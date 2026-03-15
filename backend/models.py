from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# ─── Auth ────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    email: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    is_verified: bool
    created_at: datetime


# ─── Sessions ────────────────────────────────────────────────────────────────

class SessionResponse(BaseModel):
    id: str
    name: str
    created_at: datetime
    goals: List[str] = []
    goal_count: int = 0
    task_count: int = 0
    completed_task_count: int = 0


# ─── Goals & Tasks ───────────────────────────────────────────────────────────

class GoalRequest(BaseModel):
    goal: str
    days: int
    hours_per_day: int
    force_regenerate: bool = False
    difficulty: str = "Intermediate"
    include_resources: bool = False
    syllabus: Optional[str] = None

class AddGoalRequest(BaseModel):
    new_goal: str
    days: int
    hours_per_day: int
    difficulty: str = "Intermediate"
    include_resources: bool = False
    syllabus: Optional[str] = None

class TaskResponse(BaseModel):
    id: str
    description: str
    day_number: int
    minutes: int
    difficulty: str
    completed: bool
    goal_title: str
    goal_id: str
    day_concept: Optional[str] = None
    resources: Optional[List[str]] = []

class RecalibrateRequest(BaseModel):
    day_number: Optional[int] = None

class StatsResponse(BaseModel):
    current_streak: int
    longest_streak: int
    total_tasks: int
    completed_tasks: int
    progress_percent: float
    total_minutes: int
    completed_minutes: int

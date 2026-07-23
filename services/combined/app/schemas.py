from pydantic import BaseModel, ConfigDict
from datetime import datetime
from app.models import TaskStatus, TaskPriority


# ── Auth / User ────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str
    display_name: str | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str | None = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Task ───────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    priority: TaskPriority | None = None
    project_id: str | None = None
    assignee_id: str | None = None
    due_date: datetime | None = None
    tag_ids: list[str] = []


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    project_id: str | None = None
    assignee_id: str | None = None
    due_date: datetime | None = None
    tag_ids: list[str] | None = None


class TaskResponse(BaseModel):
    id: str
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    project_id: str | None
    assignee_id: str | None
    owner_id: str
    due_date: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)


# ── Project ────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str | None
    owner_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Project Member ─────────────────────────────────────────────────

class MemberInvite(BaseModel):
    email: str
    role: str = "member"


class ProjectMemberResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Tag / Label ────────────────────────────────────────────────────

class TagCreate(BaseModel):
    name: str
    color: str = "#3B82F6"


class TagResponse(BaseModel):
    id: str
    name: str
    color: str
    project_id: str

    model_config = ConfigDict(from_attributes=True)


# ── Comment ────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    content: str


class CommentUpdate(BaseModel):
    content: str | None = None


class CommentResponse(BaseModel):
    id: str
    task_id: str
    author_id: str
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

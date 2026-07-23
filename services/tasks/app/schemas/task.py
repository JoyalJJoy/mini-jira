from pydantic import BaseModel, ConfigDict
from datetime import datetime
from app.models.task import TaskStatus, TaskPriority


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    priority: TaskPriority | None = None
    project_id: str | None = None
    assignee_id: str | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    project_id: str | None = None
    assignee_id: str | None = None


class TaskResponse(BaseModel):
    id: str
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    project_id: str | None
    assignee_id: str | None
    owner_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

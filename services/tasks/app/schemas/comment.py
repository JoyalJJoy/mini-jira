from pydantic import BaseModel, ConfigDict
from datetime import datetime


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

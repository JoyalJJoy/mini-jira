from pydantic import BaseModel, ConfigDict
from datetime import datetime

class TaskCreate(BaseModel):
    title: str
    description: str | None = None

class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    completed: bool | None = None

class TaskResponse(BaseModel):
    id: str
    title: str
    description: str | None 
    completed: bool
    owner_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
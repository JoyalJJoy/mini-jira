from pydantic import BaseModel, ConfigDict
from datetime import datetime


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

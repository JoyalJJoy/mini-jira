import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class TaskStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class TaskPriority(str, enum.Enum):
    P0 = "p0"
    P1 = "p1"
    P2 = "p2"
    P3 = "p3"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=TaskStatus.TODO.value)
    priority: Mapped[str] = mapped_column(String(5), default=TaskPriority.P2.value)
    owner_id: Mapped[str] = mapped_column(String, nullable=False)
    project_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    assignee_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

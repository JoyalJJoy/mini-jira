import uuid
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import settings
from app.models import Base
from app.db import engine
from app.routes import auth, users, tasks, projects, comments, tags, events, workspaces, boards

# Ensure all models are imported so create_all discovers them
from app.models import User, Task, Project, ProjectMember, Workspace, WorkspaceMember, Comment, Tag, TaskTag, Board, Column  # noqa: F401

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # ── Migration: add columns for existing projects ──────────
        # These are safe — SQLAlchemy will silently skip if columns already exist
        migrations = [
            "ALTER TABLE projects ADD COLUMN icon VARCHAR(10) DEFAULT '📋'",
            "ALTER TABLE projects ADD COLUMN color VARCHAR(20) DEFAULT '#3B82F6'",
            "ALTER TABLE projects ADD COLUMN is_archived BOOLEAN DEFAULT 0",
            "ALTER TABLE tasks ADD COLUMN column_id VARCHAR",
            "ALTER TABLE tasks ADD COLUMN position INTEGER DEFAULT 0",
        ]
        for stmt in migrations:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass  # column already exists

        # ── Migration: auto-create default board + columns for projects missing one
        from app.models import Board, Column
        from sqlalchemy import select

        result = await conn.execute(select(Project.id))
        project_ids = [r[0] for r in result.fetchall()]
        for pid in project_ids:
            existing = await conn.execute(select(Board.id).where(Board.project_id == pid).limit(1))
            if existing.scalar_one_or_none() is None:
                # Create default board
                board_id = str(uuid.uuid4())
                await conn.execute(
                    text("INSERT INTO boards (id, name, project_id, created_at) VALUES (:id, :name, :pid, :now)"),
                    {"id": board_id, "name": "Main Board", "pid": pid, "now": datetime.now(timezone.utc)},
                )
                # Create default columns
                default_columns = [
                    ("To Do", 0, None, "todo"),
                    ("In Progress", 1, None, "in_progress"),
                    ("Done", 2, None, "done"),
                ]
                for col_name, pos, wip, status_val in default_columns:
                    col_id = str(uuid.uuid4())
                    await conn.execute(
                        text("INSERT INTO columns (id, board_id, name, position, wip_limit, created_at) VALUES (:id, :bid, :name, :pos, :wip, :now)"),
                        {"id": col_id, "bid": board_id, "name": col_name, "pos": pos, "wip": wip, "now": datetime.now(timezone.utc)},
                    )
                    # Set column_id on tasks matching this status
                    await conn.execute(
                        text("UPDATE tasks SET column_id = :col_id WHERE project_id = :pid AND status = :status AND column_id IS NULL"),
                        {"col_id": col_id, "pid": pid, "status": status_val},
                   )

    yield
    await engine.dispose()


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Register all route modules
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(tasks.router)
app.include_router(projects.router)
app.include_router(comments.router)
app.include_router(tags.router)
app.include_router(events.router)
app.include_router(workspaces.router)
app.include_router(boards.router)


@app.get("/health")
async def health():
    return {"status": "ok"}

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import settings
from app.models import Base
from app.db import engine
from app.routes import auth, users, tasks, projects, comments, tags, events, workspaces

# Ensure all models are imported so create_all discovers them
from app.models import User, Task, Project, ProjectMember, Workspace, WorkspaceMember, Comment, Tag, TaskTag  # noqa: F401

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
        ]
        for stmt in migrations:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass  # column already exists

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


@app.get("/health")
async def health():
    return {"status": "ok"}

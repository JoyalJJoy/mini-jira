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
from app.routes import auth, users, tasks, projects, comments, tags, events, workspaces, boards, task_extras, sprints, saved_filters, dashboard

# Ensure all models are imported so create_all discovers them
from app.models import User, Task, Project, ProjectMember, Workspace, WorkspaceMember, Comment, Tag, TaskTag, Board, Column, ChecklistItem, Attachment, Activity, Sprint, IssueType, SavedFilter  # noqa: F401

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("Starting Mini Jira backend")
    logging.info("Database: %s", engine.dialect.name)
    logging.info("Clerk JWKS URL configured: %s", bool(settings.clerk_jwks_url))
    logging.info("Clerk secret key configured: %s", bool(settings.clerk_secret_key))

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Detect database type — SQLite needs manual ALTER TABLE migrations
        # for columns added after the initial deploy. PostgreSQL gets everything
        # from create_all since it's a fresh managed database.
        dialect = engine.dialect.name  # "sqlite" or "postgresql"

        if dialect == "postgresql":
            # ── Migration: fix timestamp columns to use WITH TIME ZONE ──
            # SQLAlchemy's DateTime (no timezone) maps to TIMESTAMP WITHOUT TIME ZONE
            # but our default values use timezone-aware datetimes. Fix: switch to
            # TIMESTAMP WITH TIME ZONE.
            ts_tables = {
                "users": ["created_at"],
                "tasks": ["created_at", "updated_at", "due_date"],
                "checklist_items": ["created_at"],
                "attachments": ["created_at"],
                "activities": ["created_at"],
                "sprints": ["created_at", "start_date", "end_date"],
                "saved_filters": ["created_at", "updated_at"],
                "workspaces": ["created_at", "updated_at"],
                "workspace_members": ["created_at"],
                "projects": ["created_at", "updated_at"],
                "boards": ["created_at"],
                "columns": ["created_at"],
                "project_members": ["created_at"],
                "comments": ["created_at", "updated_at"],
            }
            for tbl, cols in ts_tables.items():
                for col in cols:
                    try:
                        await conn.execute(text(
                            f'ALTER TABLE {tbl} ALTER COLUMN {col} TYPE TIMESTAMP WITH TIME ZONE '
                            f'USING {col} AT TIME ZONE \'UTC\''
                        ))
                    except Exception:
                        pass  # column already correct type

        if dialect == "sqlite":
            # ── Migration: add columns for existing projects ──────
            migrations = [
                "ALTER TABLE projects ADD COLUMN icon VARCHAR(10) DEFAULT '📋'",
                "ALTER TABLE projects ADD COLUMN color VARCHAR(20) DEFAULT '#3B82F6'",
                "ALTER TABLE projects ADD COLUMN is_archived BOOLEAN DEFAULT 0",
                "ALTER TABLE tasks ADD COLUMN column_id VARCHAR",
                "ALTER TABLE tasks ADD COLUMN position INTEGER DEFAULT 0",
                "ALTER TABLE tasks ADD COLUMN estimated_time INTEGER",
                "ALTER TABLE tasks ADD COLUMN sprint_id VARCHAR",
                "ALTER TABLE tasks ADD COLUMN issue_type VARCHAR(10) DEFAULT 'task'",
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


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan, redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_headers=["*"],
    allow_methods=["*"],
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
app.include_router(task_extras.router)
app.include_router(sprints.router)
app.include_router(saved_filters.router)
app.include_router(dashboard.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Debug endpoint — check user data in DB ─────────────────────────
@app.get("/debug/user/{user_id}")
async def debug_user(user_id: str):
    """Check what data exists for a given user in the database."""
    from app.models import User, Workspace, WorkspaceMember, Project, ProjectMember
    from sqlalchemy import select, func

    results = {}

    async with engine.connect() as conn:
        # Check user
        u = await conn.execute(select(User).where(User.id == user_id))
        u_row = u.mappings().first()
        results["user"] = dict(u_row) if u_row else None

        # Check workspaces
        ws_ids = await conn.execute(
            select(WorkspaceMember.workspace_id).where(WorkspaceMember.user_id == user_id)
        )
        ws_ids_list = [r[0] for r in ws_ids.fetchall()]
        results["workspace_ids"] = ws_ids_list

        if ws_ids_list:
            ws = await conn.execute(
                select(Workspace).where(Workspace.id.in_(ws_ids_list))
            )
            results["workspaces"] = [dict(r) for r in ws.mappings().all()]
        else:
            results["workspaces"] = []

        # Check projects
        p_ids = await conn.execute(
            select(ProjectMember.project_id).where(ProjectMember.user_id == user_id)
        )
        p_ids_list = [r[0] for r in p_ids.fetchall()]
        results["project_ids"] = p_ids_list

        if p_ids_list:
            projs = await conn.execute(
                select(Project).where(Project.id.in_(p_ids_list))
            )
            results["projects"] = [dict(r) for r in projs.mappings().all()]
        else:
            results["projects"] = []

    return results

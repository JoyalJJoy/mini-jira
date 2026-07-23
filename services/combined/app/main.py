import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.models import Base
from app.db import engine
from app.routes import auth, users, tasks, projects, comments, tags, events

# Ensure all models are imported so create_all discovers them
from app.models import User, Task, Project, ProjectMember, Comment, Tag, TaskTag  # noqa: F401

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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


@app.get("/health")
async def health():
    return {"status": "ok"}

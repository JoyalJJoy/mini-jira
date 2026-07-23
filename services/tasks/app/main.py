import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.config import settings
from app.db.session import engine, Base
from app.api.v1.router import router as v1_router
from app.core.subscribers import register_subscribers
from app.core.event_bus import event_bus
# Import models so metadata.create_all discovers them
from app.models import Task, Project, Comment  # noqa: F401

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await event_bus.connect()
    register_subscribers()
    event_bus.start()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

    await event_bus.disconnect()
    await engine.dispose()


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
app.include_router(v1_router)
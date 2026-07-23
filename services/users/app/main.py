from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.config import settings
from app.db.session import engine, Base
from app.api.v1.router import router as v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan) 
app.include_router(v1_router)
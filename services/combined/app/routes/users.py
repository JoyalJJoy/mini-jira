from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db import get_db
from app.models import User
from app.schemas import UserResponse

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/", response_model=list[UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    return result.scalars().all()

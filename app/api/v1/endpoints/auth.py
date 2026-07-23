from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.user import UserCreate, UserResponse, Token
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserResponse)
async def signup(data: UserCreate, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    try:
        user = await service.signup(data)
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=Token)
async def login(data: UserCreate, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    try:
        token = await service.login(data.email, data.password)
        return Token(access_token=token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

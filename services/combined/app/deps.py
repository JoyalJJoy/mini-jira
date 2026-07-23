from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.security import decode_token, verify_clerk_token
from app.models import User
from sqlalchemy import select

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> str:
    """Extract the authenticated user ID from a Bearer token.

    Supports two token types:
      1. Clerk JWTs (RS256, verified via JWKS)
      2. Legacy custom JWTs (HS256, for backward compat)
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = credentials.credentials

    # Try Clerk token first
    payload = verify_clerk_token(token)
    if payload:
        clerk_user_id = payload.get("sub", "")
        # Auto-create local user if first time seeing this Clerk user
        result = await db.execute(select(User).where(User.id == clerk_user_id))
        user = result.scalar_one_or_none()
        if not user:
            # Create a placeholder — display_name can be updated later
            user = User(
                id=clerk_user_id,
                email=f"{clerk_user_id}@clerk.local",
                hashed_password="",
                display_name="",
            )
            db.add(user)
            await db.commit()
        return clerk_user_id

    # Fall back to custom JWT
    payload = decode_token(token)
    if payload and payload.get("type") == "access":
        user_id = payload.get("sub")
        if user_id:
            return user_id

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token",
    )

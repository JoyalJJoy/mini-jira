import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.db import get_db
from app.security import decode_token, verify_clerk_token
from app.models import User
from sqlalchemy import select

bearer_scheme = HTTPBearer(auto_error=False)


async def _fetch_and_create_clerk_user(clerk_user_id: str, db: AsyncSession) -> User:
    """Fetch Clerk user info from the API and create a local User record."""
    email = f"{clerk_user_id[:8]}@clerk.local"
    display_name = ""

    if settings.clerk_secret_key:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"https://api.clerk.com/v1/users/{clerk_user_id}",
                    headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
                    timeout=10,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    email = data.get("email_addresses", [{}])[0].get("email_address", email)
                    display_name = data.get("first_name", "") or ""
                    if data.get("last_name"):
                        display_name = f"{display_name} {data['last_name']}".strip()
                    if not display_name:
                        display_name = data.get("username", email.split("@")[0])
        except Exception:
            pass  # fall back to defaults

    user = User(
        id=clerk_user_id,
        email=email,
        hashed_password="",
        display_name=display_name,
    )
    db.add(user)
    await db.commit()
    return user


async def _update_clerk_user_info(clerk_user_id: str, db: AsyncSession):
    """Update an existing user's info from Clerk API."""
    if not settings.clerk_secret_key:
        return
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.clerk.com/v1/users/{clerk_user_id}",
                headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                email = data.get("email_addresses", [{}])[0].get("email_address", "")
                display_name = data.get("first_name", "") or ""
                if data.get("last_name"):
                    display_name = f"{display_name} {data['last_name']}".strip()
                if not display_name:
                    display_name = data.get("username", email.split("@")[0])

                result = await db.execute(select(User).where(User.id == clerk_user_id))
                user = result.scalar_one_or_none()
                if user and (not user.display_name or user.display_name == ""):
                    user.email = email or user.email
                    user.display_name = display_name
                    await db.commit()
    except Exception:
        pass


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
            user = await _fetch_and_create_clerk_user(clerk_user_id, db)
        else:
            # Update display name if missing (e.g. from before this feature)
            await _update_clerk_user_info(clerk_user_id, db)
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

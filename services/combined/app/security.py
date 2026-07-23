import logging
from datetime import datetime, timedelta, timezone
import jwt
from jwt import PyJWKClient
from pwdlib import PasswordHash
from app.config import settings

logger = logging.getLogger("security")

pwd_context = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": user_id, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except jwt.InvalidTokenError:
        return None


# ── Clerk JWT verification ────────────────────────────────────────

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient | None:
    global _jwks_client
    if _jwks_client is None and settings.clerk_jwks_url:
        logger.info("Creating JWKS client with URL: %s", settings.clerk_jwks_url)
        try:
            _jwks_client = PyJWKClient(settings.clerk_jwks_url, cache_keys=True)
            logger.info("JWKS client created successfully")
        except Exception as e:
            logger.error("Failed to create JWKS client: %s", e, exc_info=True)
            _jwks_client = None
    elif not settings.clerk_jwks_url:
        logger.warning("CLERK_JWKS_URL is not set — Clerk token verification disabled")
    return _jwks_client


def verify_clerk_token(token: str) -> dict | None:
    """Verify a Clerk-issued session JWT and return its payload."""
    client = _get_jwks_client()
    if not client:
        logger.warning("No JWKS client available — skipping Clerk token verification")
        return None
    try:
        logger.debug("Attempting to get signing key from JWT (kid: %s)", 
                      jwt.get_unverified_header(token).get("kid", "unknown"))
        signing_key = client.get_signing_key_from_jwt(token)
        logger.debug("Got signing key: %s...", str(signing_key.key)[:40])
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_exp": True},
        )
        logger.info("Clerk token verified successfully for user: %s", payload.get("sub", "unknown"))
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Clerk token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning("Clerk token invalid: %s", e)
        return None
    except Exception as e:
        logger.error("Unexpected error verifying Clerk token: %s", e, exc_info=True)
        return None

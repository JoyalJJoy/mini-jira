import jwt
from app.core.config import settings


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except jwt.InvalidTokenError:
        return None

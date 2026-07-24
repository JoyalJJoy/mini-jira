from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Mini Jira"
    app_version: str = "1.0.0"
    debug: bool = False

    database_url: str = "sqlite+aiosqlite:///./mini_jira.db"

    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Clerk auth
    clerk_jwks_url: str = ""
    clerk_secret_key: str = ""

    # Redis (Upstash)
    redis_url: str = ""

    model_config = {"env_file": ".env"}

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Render.com provides DATABASE_URL as "postgresql://..." but
        # SQLAlchemy async needs "postgresql+asyncpg://..."
        if self.database_url and self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace(
                "postgresql://", "postgresql+asyncpg://", 1
            )
        # Also handle the internal Render env var format
        if self.database_url and self.database_url.startswith("postgresql+asyncpg://"):
            # If it still starts with postgresql:// after replacement, or already has +asyncpg, that's fine
            pass


settings = Settings()

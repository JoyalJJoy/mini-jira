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

    model_config = {"env_file": ".env"}


settings = Settings()

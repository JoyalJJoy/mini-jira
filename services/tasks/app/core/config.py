from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Task Service"
    app_version: str = "1.0.0"
    debug: bool = True

    database_url: str = "sqlite+aiosqlite:///./tasks.db"

    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    redis_url: str = "redis://localhost:6379/0"

    model_config = {"env_file": ".env"}


settings = Settings()

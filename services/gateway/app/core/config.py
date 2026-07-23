from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "API Gateway"
    app_version: str = "1.0.0"
    debug: bool = False

    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"

    user_service_url: str = "http://127.0.0.1:8001"
    task_service_url: str = "http://127.0.0.1:8002"

    model_config = {"env_file": ".env"}


settings = Settings()

import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # PostgreSQL Database
    DATABASE_URL: str | None = None
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "carbon_emission_db"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"

    # ML Model
    MODEL_PATH: str = "models/waste_model.onnx"
    IMAGE_SIZE: int = 224

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

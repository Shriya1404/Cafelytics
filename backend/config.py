import os

from dotenv import load_dotenv

load_dotenv()


def get_required_env(name):
    value = os.getenv(name)
    if value and value.strip():
        return value.strip()
    raise RuntimeError(
        f"Missing required environment variable: {name}. "
        "Set it in your backend .env file before starting the server."
    )


class Config:
    SQLALCHEMY_DATABASE_URI = get_required_env("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = get_required_env("JWT_SECRET_KEY")
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    DEBUG = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    PORT = int(os.getenv("PORT", "5000"))

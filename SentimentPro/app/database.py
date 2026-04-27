import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


def _get_database_url() -> str:
    configured_url = os.getenv("DATABASE_URL")
    if configured_url:
        if configured_url.startswith("postgres://"):
            configured_url = configured_url.replace("postgres://", "postgresql://", 1)
        return configured_url

    host = os.getenv("DB_HOST", "127.0.0.1")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "sentimentpro")
    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD")
    if not password:
        raise RuntimeError("Set DB_PASSWORD or DATABASE_URL before starting the API")

    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{name}"


DATABASE_URL = _get_database_url()

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

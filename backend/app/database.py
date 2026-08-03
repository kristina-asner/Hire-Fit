import os
from datetime import datetime
from dotenv import load_dotenv  # <--- Important for local development
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, JSON, text
from sqlalchemy.orm import sessionmaker, declarative_base

# Load environment variables (so it can read the URL from .env file)
load_dotenv()

# Database address
# Default is localhost to make debugging easier, in Docker it will take from ENV
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://ai:ai@localhost:5432/hirefit")
# 2. Critical fix: Replace the prefix to use the Psycopg 3 driver you installed
if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

# 1. Engine improvement for Scalability
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    session_id = Column(String, primary_key=True, index=True)
    status = Column(String, default="pending")  # pending, processing, completed, failed

    job_description = Column(Text, nullable=True)

    # Which HR (by name) uploaded/triggered this analysis, and the original filename
    created_by = Column(String, nullable=True)
    filename = Column(String, nullable=True)

    # Results (plain text + structured metadata in JSON)
    result_text = Column(Text, nullable=True)
    result_metadata = Column(JSON, nullable=True)

    # 2. Adding timestamps - critical for debugging
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    salt = Column(String, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    # Checks and creates tables if they don't exist
    Base.metadata.create_all(bind=engine)

    # create_all() only creates missing tables, it won't add new columns to a
    # table that already exists (e.g. the Railway DB from before this column
    # was added) - this additive, idempotent ALTER covers that case.
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS created_by VARCHAR"))
        conn.execute(text("ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS filename VARCHAR"))
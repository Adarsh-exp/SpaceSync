from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./spacesync.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
engine_kwargs = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # Supabase Postgres connections should negotiate SSL.
    connect_args = {"sslmode": os.getenv("DB_SSLMODE", "require")}
    engine_kwargs.update(
        {
            "pool_size": int(os.getenv("DB_POOL_SIZE", "5")),
            "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "10")),
            "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "1800")),
        }
    )

engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_sqlite_migrations():
    if not DATABASE_URL.startswith("sqlite"):
        return

    column_map = {
        "spaces": {
            "booking_mode": "ALTER TABLE spaces ADD COLUMN booking_mode VARCHAR DEFAULT 'instant'",
            "opening_time": "ALTER TABLE spaces ADD COLUMN opening_time VARCHAR",
            "closing_time": "ALTER TABLE spaces ADD COLUMN closing_time VARCHAR",
        },
        "bookings": {
            "request_expires_at": "ALTER TABLE bookings ADD COLUMN request_expires_at DATETIME",
            "reviewed_at": "ALTER TABLE bookings ADD COLUMN reviewed_at DATETIME",
            "rejection_reason": "ALTER TABLE bookings ADD COLUMN rejection_reason VARCHAR",
        },
        "reviews": {
            "is_flagged": "ALTER TABLE reviews ADD COLUMN is_flagged INTEGER DEFAULT 0",
            "flagged_at": "ALTER TABLE reviews ADD COLUMN flagged_at DATETIME",
        },
    }

    inspector = inspect(engine)
    with engine.begin() as conn:
        for table_name, columns in column_map.items():
            if not inspector.has_table(table_name):
                continue
            existing = {col["name"] for col in inspector.get_columns(table_name)}
            for column_name, ddl in columns.items():
                if column_name not in existing:
                    conn.execute(text(ddl))
        if inspector.has_table("spaces"):
            conn.execute(text("UPDATE spaces SET opening_time = '09:00' WHERE opening_time IS NULL OR opening_time = ''"))
            conn.execute(text("UPDATE spaces SET closing_time = '22:00' WHERE closing_time IS NULL OR closing_time = ''"))

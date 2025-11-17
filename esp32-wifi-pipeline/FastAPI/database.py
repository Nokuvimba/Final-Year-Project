# database.py
import os
import time
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import OperationalError

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://wifiuser:Password@localhost/wifi_db"
)

SQL_ECHO = os.getenv("SQL_ECHO", "false").lower() == "true"
RETRIES = int(os.getenv("DB_RETRIES", "10"))
DELAY = float(os.getenv("DB_RETRY_DELAY", "1.5"))

connect_args = {}

# Small retry loop (useful if Postgres is still starting)
engine = None
for _ in range(RETRIES):
    try:
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            echo=SQL_ECHO,
            connect_args=connect_args,
        )
        # smoke test
        with engine.connect():
            pass
        break
    except OperationalError:
        time.sleep(DELAY)

if engine is None:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        echo=SQL_ECHO,
        connect_args=connect_args,
    )

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
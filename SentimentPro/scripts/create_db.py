import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def main() -> None:
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = int(os.getenv("DB_PORT", "5432"))
    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD")
    target_db = os.getenv("DB_NAME", "sentimentpro")
    if not password:
        raise RuntimeError("Set DB_PASSWORD in .env before creating the database")

    conn = psycopg2.connect(host=host, port=port, user=user, password=password, dbname="postgres")
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target_db,))
    exists = cur.fetchone() is not None

    if exists:
        print(f"Database '{target_db}' already exists")
    else:
        cur.execute(f'CREATE DATABASE "{target_db}"')
        print(f"Database '{target_db}' created")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()

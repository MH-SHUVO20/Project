from sqlalchemy import text as sql_text

from app.database import engine


def ensure_schema() -> None:
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS company VARCHAR(160)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_analysis_complete BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_weekly_summary BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_product_updates BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_marketing_emails BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS theme VARCHAR(20) NOT NULL DEFAULT 'light'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'en'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS compact_mode BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "UPDATE users SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)",
        # API Keys table (idempotent)
        """CREATE TABLE IF NOT EXISTS api_keys (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            key_prefix VARCHAR(16) NOT NULL,
            key_hash VARCHAR(255) NOT NULL UNIQUE,
            label VARCHAR(60) NOT NULL DEFAULT 'default',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used_at TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS ix_api_keys_user_id ON api_keys(user_id)",
        "CREATE INDEX IF NOT EXISTS ix_api_keys_key_hash ON api_keys(key_hash)",
    ]
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(sql_text(statement))

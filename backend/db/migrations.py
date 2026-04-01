"""Simple SQL migration runner with schema versioning support."""

from __future__ import annotations

from pathlib import Path
import re
from typing import Iterable

from sqlalchemy import text

from backend.db import models  # noqa: F401 - Ensure ORM models are registered
from backend.db.session import Base
from backend.db.session import engine


MIGRATION_FILE_PATTERN = re.compile(r"^(\d{3})_.*\.sql$")


def _migration_dir() -> Path:
    return Path(__file__).parent / "migrations"


def ensure_migration_table() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR(64) PRIMARY KEY,
                    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )


def applied_versions() -> set[str]:
    ensure_migration_table()
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT version FROM schema_migrations")).fetchall()
    return {str(r[0]) for r in rows}


def _read_migrations() -> list[tuple[str, Path]]:
    migrations: list[tuple[str, Path]] = []
    for path in sorted(_migration_dir().glob("*.sql")):
        match = MIGRATION_FILE_PATTERN.match(path.name)
        if not match:
            continue
        migrations.append((match.group(1), path))
    return migrations


def _split_sql_statements(sql: str) -> Iterable[str]:
    # Simple statement splitter for migration files that contain multiple DDL statements.
    for part in sql.split(";"):
        statement = part.strip()
        if statement:
            yield statement


def run_migrations() -> list[str]:
    """Apply pending migrations and return applied versions."""
    ensure_migration_table()
    applied = applied_versions()
    executed: list[str] = []

    for version, path in _read_migrations():
        if version in applied:
            continue
        sql = path.read_text(encoding="utf-8")
        with engine.begin() as conn:
            # Make the initial schema portable for SQLite/PostgreSQL/MySQL.
            if version == "001":
                Base.metadata.create_all(bind=conn)
            for statement in _split_sql_statements(sql):
                conn.execute(text(statement))
            conn.execute(
                text("INSERT INTO schema_migrations(version) VALUES (:version)"),
                {"version": version},
            )
        executed.append(version)

    return executed

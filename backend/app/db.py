"""Database access: Postgres when DATABASE_URL is set (production), SQLite otherwise (local dev)."""

import os
import sqlite3
from collections.abc import Iterator
from pathlib import Path
from typing import Any

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "todo.db"

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'todo'
               CHECK (status IN ('todo', 'in_progress', 'done')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS steps (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    text     TEXT NOT NULL,
    position INTEGER NOT NULL,
    done     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_steps_task ON steps(task_id, position);
"""

# Same shape as the SQLite schema; created_at uses the same "YYYY-MM-DD HH:MM:SS" UTC text.
POSTGRES_SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    id         SERIAL PRIMARY KEY,
    title      TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'todo'
               CHECK (status IN ('todo', 'in_progress', 'done')),
    created_at TEXT NOT NULL
               DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS steps (
    id       SERIAL PRIMARY KEY,
    task_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    text     TEXT NOT NULL,
    position INTEGER NOT NULL,
    done     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_steps_task ON steps(task_id, position);
"""

# Re-derive every task's status from its steps (Done = has steps, all checked).
# Keeps rows written before this rule existed consistent with it.
SYNC_STATUSES = """
UPDATE tasks SET status = CASE
    WHEN EXISTS (SELECT 1 FROM steps WHERE task_id = tasks.id)
     AND NOT EXISTS (SELECT 1 FROM steps WHERE task_id = tasks.id AND done = 0)
    THEN 'done' ELSE 'todo' END;
"""


def database_url() -> str | None:
    return os.environ.get("DATABASE_URL") or None


def db_path() -> str:
    return os.environ.get("TODO_DB_PATH", str(DEFAULT_DB_PATH))


class Conn:
    """Thin wrapper so queries can be written once with `?` placeholders for either database.

    Rows support access by column name and dict(row) on both backends.
    """

    def __init__(self, raw: Any, postgres: bool) -> None:
        self.raw = raw
        self.postgres = postgres

    def execute(self, sql: str, params: tuple = ()) -> Any:
        if self.postgres:
            return self.raw.execute(sql.replace("?", "%s"), params)
        return self.raw.execute(sql, params)

    def insert(self, sql: str, params: tuple = ()) -> int:
        """Run an INSERT and return the new row's id."""
        if self.postgres:
            return self.execute(sql + " RETURNING id", params).fetchone()["id"]
        return self.execute(sql, params).lastrowid

    def executescript(self, sql: str) -> None:
        if self.postgres:
            self.raw.execute(sql)  # psycopg runs multiple statements when given no params
        else:
            self.raw.executescript(sql)

    def commit(self) -> None:
        self.raw.commit()

    def close(self) -> None:
        self.raw.close()


def connect() -> Conn:
    url = database_url()
    if url:
        import psycopg
        from psycopg.rows import dict_row

        return Conn(psycopg.connect(url, row_factory=dict_row), postgres=True)

    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return Conn(conn, postgres=False)


_initialized: set[str] = set()


def init_db() -> None:
    conn = connect()
    try:
        conn.executescript(POSTGRES_SCHEMA if conn.postgres else SQLITE_SCHEMA)
        conn.executescript(SYNC_STATUSES)
        conn.commit()
    finally:
        conn.close()


def ensure_db() -> None:
    """Create tables once per process per database. Done lazily on first request because
    serverless runtimes (Vercel) may not run the ASGI lifespan startup hook."""
    key = database_url() or db_path()
    if key not in _initialized:
        init_db()
        _initialized.add(key)


def get_conn() -> Iterator[Conn]:
    """FastAPI dependency: one connection per request, committed on success."""
    ensure_db()
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

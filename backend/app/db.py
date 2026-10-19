import os
import sqlite3
from collections.abc import Iterator
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "todo.db"

SCHEMA = """
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

# Re-derive every task's status from its steps (Done = has steps, all checked).
# Keeps rows written before this rule existed consistent with it.
SYNC_STATUSES = """
UPDATE tasks SET status = CASE
    WHEN EXISTS (SELECT 1 FROM steps WHERE task_id = tasks.id)
     AND NOT EXISTS (SELECT 1 FROM steps WHERE task_id = tasks.id AND done = 0)
    THEN 'done' ELSE 'todo' END;
"""


def db_path() -> str:
    return os.environ.get("TODO_DB_PATH", str(DEFAULT_DB_PATH))


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
        conn.executescript(SYNC_STATUSES)


def get_conn() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency: one connection per request, committed on success."""
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

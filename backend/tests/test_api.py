import os

import pytest
from fastapi.testclient import TestClient

# Every test runs against SQLite, and also against Postgres when TEST_DATABASE_URL is set.
# The Postgres database's tasks/steps tables are dropped before each test..
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture(params=["sqlite", "postgres"])
def client(request, tmp_path, monkeypatch):
    from app import db

    if request.param == "postgres":
        if not TEST_DATABASE_URL:
            pytest.skip("TEST_DATABASE_URL not set")
        import psycopg

        with psycopg.connect(TEST_DATABASE_URL) as conn:
            conn.execute("DROP TABLE IF EXISTS results, steps, tasks, durations, settings")
        monkeypatch.setenv("DATABASE_URL", TEST_DATABASE_URL)
        db._initialized.discard(TEST_DATABASE_URL)
    else:
        monkeypatch.delenv("DATABASE_URL", raising=False)
        monkeypatch.setenv("TODO_DB_PATH", str(tmp_path / "test.db"))

    from app.main import app

    with TestClient(app) as c:
        yield c


def test_create_and_list_task(client):
    r = client.post("/api/tasks", json={"title": "  Attend hackathon event in Bangalore  "})
    assert r.status_code == 201
    task = r.json()
    assert task["title"] == "Attend hackathon event in Bangalore"
    assert task["status"] == "todo"
    assert task["steps"] == []

    r = client.get("/api/tasks")
    assert [t["id"] for t in r.json()] == [task["id"]]


def test_steps_are_appended_in_order(client):
    task_id = client.post("/api/tasks", json={"title": "Hackathon"}).json()["id"]
    for text in ["Register", "Book train", "Pack laptop"]:
        assert client.post(f"/api/tasks/{task_id}/steps", json={"text": text}).status_code == 201

    steps = client.get(f"/api/tasks/{task_id}").json()["steps"]
    assert [s["text"] for s in steps] == ["Register", "Book train", "Pack laptop"]
    assert [s["position"] for s in steps] == [0, 1, 2]
    assert all(s["done"] is False for s in steps)


def test_toggle_step_persists(client):
    task_id = client.post("/api/tasks", json={"title": "Hackathon"}).json()["id"]
    step_id = client.post(f"/api/tasks/{task_id}/steps", json={"text": "Register"}).json()["id"]

    r = client.patch(f"/api/steps/{step_id}", json={"done": True})
    assert r.status_code == 200 and r.json()["done"] is True
    assert client.get(f"/api/tasks/{task_id}").json()["steps"][0]["done"] is True

    client.patch(f"/api/steps/{step_id}", json={"done": False})
    assert client.get(f"/api/tasks/{task_id}").json()["steps"][0]["done"] is False


def test_task_moves_to_done_when_all_steps_checked(client):
    task_id = client.post("/api/tasks", json={"title": "Hackathon"}).json()["id"]
    step_ids = [
        client.post(f"/api/tasks/{task_id}/steps", json={"text": t}).json()["id"]
        for t in ["Register", "Book train"]
    ]
    status = lambda: client.get(f"/api/tasks/{task_id}").json()["status"]  # noqa: E731

    client.patch(f"/api/steps/{step_ids[0]}", json={"done": True})
    assert status() == "todo"
    client.patch(f"/api/steps/{step_ids[1]}", json={"done": True})
    assert status() == "done"

    # Unchecking a step sends it back to To Do.
    client.patch(f"/api/steps/{step_ids[1]}", json={"done": False})
    assert status() == "todo"

    # A new unchecked step on a finished task also sends it back.
    client.patch(f"/api/steps/{step_ids[1]}", json={"done": True})
    client.post(f"/api/tasks/{task_id}/steps", json={"text": "Pack laptop"})
    assert status() == "todo"


def test_task_without_steps_stays_todo(client):
    task = client.post("/api/tasks", json={"title": "Hackathon"}).json()
    assert task["status"] == "todo"


def test_delete_task_removes_it_and_its_steps(client):
    task_id = client.post("/api/tasks", json={"title": "Hackathon"}).json()["id"]
    step_ids = [
        client.post(f"/api/tasks/{task_id}/steps", json={"text": t}).json()["id"]
        for t in ["Register", "Book train"]
    ]

    assert client.delete(f"/api/tasks/{task_id}").status_code == 204
    assert client.get(f"/api/tasks/{task_id}").status_code == 404
    assert client.get("/api/tasks").json() == []
    for step_id in step_ids:
        assert client.patch(f"/api/steps/{step_id}", json={"done": True}).status_code == 404


def test_not_found(client):
    assert client.get("/api/tasks/999").status_code == 404
    assert client.post("/api/tasks/999/steps", json={"text": "x"}).status_code == 404
    assert client.patch("/api/steps/999", json={"done": True}).status_code == 404
    assert client.delete("/api/tasks/999").status_code == 404


def test_rejects_empty_text(client):
    assert client.post("/api/tasks", json={"title": "   "}).status_code == 422
    task_id = client.post("/api/tasks", json={"title": "Hackathon"}).json()["id"]
    assert client.post(f"/api/tasks/{task_id}/steps", json={"text": ""}).status_code == 422


def test_results_are_saved_in_order_and_deleted_with_task(client):
    task_id = client.post("/api/tasks", json={"title": "Balcony"}).json()["id"]
    assert client.get(f"/api/tasks/{task_id}").json()["results"] == []
    for text in ["Fresh air", "Proud of it"]:
        assert client.post(f"/api/tasks/{task_id}/results", json={"text": text}).status_code == 201

    task = client.get("/api/tasks").json()[0]
    assert [r["text"] for r in task["results"]] == ["Fresh air", "Proud of it"]
    assert [r["position"] for r in task["results"]] == [0, 1]

    assert client.post("/api/tasks/999/results", json={"text": "x"}).status_code == 404
    assert client.post(f"/api/tasks/{task_id}/results", json={"text": " "}).status_code == 422
    assert client.delete(f"/api/tasks/{task_id}").status_code == 204


def test_reorder_steps(client):
    task_id = client.post("/api/tasks", json={"title": "Hackathon"}).json()["id"]
    ids = [
        client.post(f"/api/tasks/{task_id}/steps", json={"text": t}).json()["id"]
        for t in ["a", "b", "c"]
    ]
    r = client.put(f"/api/tasks/{task_id}/steps/order", json={"step_ids": [ids[2], ids[0], ids[1]]})
    assert r.status_code == 204
    steps = client.get(f"/api/tasks/{task_id}").json()["steps"]
    assert [s["text"] for s in steps] == ["C", "A", "B"]

    # Must list every step exactly once.
    assert client.put(f"/api/tasks/{task_id}/steps/order", json={"step_ids": ids[:2]}).status_code == 422
    assert client.put("/api/tasks/999/steps/order", json={"step_ids": []}).status_code == 404

    # A step added afterwards goes to the end.
    client.post(f"/api/tasks/{task_id}/steps", json={"text": "d"})
    texts = [s["text"] for s in client.get(f"/api/tasks/{task_id}").json()["steps"]]
    assert texts == ["C", "A", "B", "D"]


def test_text_is_stored_capitalized(client):
    task = client.post("/api/tasks", json={"title": "  clean my balcony"}).json()
    assert task["title"] == "Clean my balcony"
    step = client.post(f"/api/tasks/{task['id']}/steps", json={"text": "get broom"}).json()
    assert step["text"] == "Get broom"


def test_completed_at_tracks_when_task_is_done(client):
    task = client.post("/api/tasks", json={"title": "Hackathon"}).json()
    assert task["completed_at"] is None
    task_id = task["id"]
    step_id = client.post(f"/api/tasks/{task_id}/steps", json={"text": "Register"}).json()["id"]
    get = lambda: client.get(f"/api/tasks/{task_id}").json()  # noqa: E731

    client.patch(f"/api/steps/{step_id}", json={"done": True})
    completed_at = get()["completed_at"]
    assert completed_at is not None
    assert len(completed_at) == len("YYYY-MM-DD HH:MM:SS")

    # Re-saving a done step keeps the original finish time.
    client.patch(f"/api/steps/{step_id}", json={"done": True})
    assert get()["completed_at"] == completed_at

    client.patch(f"/api/steps/{step_id}", json={"done": False})
    assert get()["completed_at"] is None

    client.patch(f"/api/steps/{step_id}", json={"done": True})
    client.post(f"/api/tasks/{task_id}/steps", json={"text": "Pack laptop"})
    assert get()["completed_at"] is None


def test_old_database_gets_completed_at_column(tmp_path, monkeypatch):
    import sqlite3

    from app import db

    path = tmp_path / "old.db"
    old = sqlite3.connect(path)
    old.executescript(
        """
        CREATE TABLE tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'todo',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE steps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            position INTEGER NOT NULL,
            done INTEGER NOT NULL DEFAULT 0
        );
        INSERT INTO tasks (title, status, created_at) VALUES ('Old', 'done', '2026-01-02 03:04:05');
        INSERT INTO steps (task_id, text, position, done) VALUES (1, 'Step', 0, 1);
        """
    )
    old.commit()
    old.close()

    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("TODO_DB_PATH", str(path))
    db._initialized.discard(str(path))

    from app.main import app

    with TestClient(app) as c:
        [task] = c.get("/api/tasks").json()
    # Finish time unknown for old rows, so it is assumed to be the creation time.
    assert task["completed_at"] == "2026-01-02 03:04:05"
    assert task["duration"] == "1d"


def test_duration_defaults_to_one_day(client):
    assert client.get("/api/duration").json() == {"active": "1d", "durations": []}
    assert client.post("/api/tasks", json={"title": "Daily"}).json()["duration"] == "1d"


def test_set_duration_applies_to_new_tasks_only(client):
    old = client.post("/api/tasks", json={"title": "Daily"}).json()

    r = client.put("/api/duration", json={"key": "1w", "anchor": "2026-10-21"})
    assert r.status_code == 200
    assert r.json() == {"active": "1w", "durations": [{"key": "1w", "anchor": "2026-10-21"}]}

    new = client.post("/api/tasks", json={"title": "Weekly"}).json()
    assert new["duration"] == "1w"
    assert client.get(f"/api/tasks/{old['id']}").json()["duration"] == "1d"


def test_duration_keeps_its_first_anchor(client):
    client.put("/api/duration", json={"key": "1w", "anchor": "2026-10-21"})
    client.put("/api/duration", json={"key": "1d", "anchor": "2026-10-22"})
    state = client.put("/api/duration", json={"key": "1w", "anchor": "2026-11-03"}).json()
    assert state["active"] == "1w"
    assert {d["key"]: d["anchor"] for d in state["durations"]} == {
        "1d": "2026-10-22",
        "1w": "2026-10-21",
    }


def test_rejects_invalid_duration(client):
    for body in [
        {"key": "0d", "anchor": "2026-10-21"},
        {"key": "1x", "anchor": "2026-10-21"},
        {"key": "1000d", "anchor": "2026-10-21"},
        {"key": "1w", "anchor": "21/10/2026"},
    ]:
        assert client.put("/api/duration", json=body).status_code == 422

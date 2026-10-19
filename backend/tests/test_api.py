import os

import pytest
from fastapi.testclient import TestClient

# Every test runs against SQLite, and also against Postgres when TEST_DATABASE_URL is set.
# The Postgres database's tasks/steps tables are dropped before each test.
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture(params=["sqlite", "postgres"])
def client(request, tmp_path, monkeypatch):
    from app import db

    if request.param == "postgres":
        if not TEST_DATABASE_URL:
            pytest.skip("TEST_DATABASE_URL not set")
        import psycopg

        with psycopg.connect(TEST_DATABASE_URL) as conn:
            conn.execute("DROP TABLE IF EXISTS steps, tasks")
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

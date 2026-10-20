from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .db import Conn, get_conn
from .schemas import Result, ResultCreate, Step, StepCreate, StepOrder, StepUpdate, Task, TaskCreate

app = FastAPI(title="My To-Do")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _step(row: Any) -> Step:
    return Step(
        id=row["id"],
        task_id=row["task_id"],
        text=row["text"],
        position=row["position"],
        done=bool(row["done"]),
    )


def _result(row: Any) -> Result:
    return Result(
        id=row["id"], task_id=row["task_id"], text=row["text"], position=row["position"]
    )


def _sync_status(conn: Conn, task_id: int) -> None:
    """A task is Done once it has steps and every one is checked; otherwise it is To Do.

    completed_at records when the task last became Done (UTC, same format as created_at).
    """
    row = conn.execute(
        "SELECT COUNT(*) AS total, COALESCE(SUM(done), 0) AS checked FROM steps WHERE task_id = ?",
        (task_id,),
    ).fetchone()
    total, checked = row["total"], row["checked"]
    status = "done" if total > 0 and checked == total else "todo"
    if status == "todo":
        conn.execute(
            "UPDATE tasks SET status = ?, completed_at = NULL WHERE id = ?", (status, task_id)
        )
        return
    was_done = conn.execute("SELECT status FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if was_done is not None and was_done["status"] == "done":
        return  # already Done; keep the original finish time
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        "UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?", (status, now, task_id)
    )


def _load_task(conn: Conn, task_id: int) -> Task:
    row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Task not found")
    steps = conn.execute(
        "SELECT * FROM steps WHERE task_id = ? ORDER BY position", (task_id,)
    ).fetchall()
    results = conn.execute(
        "SELECT * FROM results WHERE task_id = ? ORDER BY position", (task_id,)
    ).fetchall()
    return Task(
        **dict(row), steps=[_step(s) for s in steps], results=[_result(r) for r in results]
    )


@app.get("/api/tasks", response_model=list[Task])
def list_tasks(conn: Conn = Depends(get_conn)) -> list[Task]:
    tasks = conn.execute("SELECT * FROM tasks ORDER BY id").fetchall()
    steps = conn.execute("SELECT * FROM steps ORDER BY task_id, position").fetchall()
    by_task: dict[int, list[Step]] = {}
    for s in steps:
        by_task.setdefault(s["task_id"], []).append(_step(s))
    results = conn.execute("SELECT * FROM results ORDER BY task_id, position").fetchall()
    results_by_task: dict[int, list[Result]] = {}
    for r in results:
        results_by_task.setdefault(r["task_id"], []).append(_result(r))
    return [
        Task(**dict(t), steps=by_task.get(t["id"], []), results=results_by_task.get(t["id"], []))
        for t in tasks
    ]


@app.post("/api/tasks", response_model=Task, status_code=201)
def create_task(body: TaskCreate, conn: Conn = Depends(get_conn)) -> Task:
    task_id = conn.insert("INSERT INTO tasks (title) VALUES (?)", (body.title,))
    return _load_task(conn, task_id)


@app.get("/api/tasks/{task_id}", response_model=Task)
def get_task(task_id: int, conn: Conn = Depends(get_conn)) -> Task:
    return _load_task(conn, task_id)


@app.post("/api/tasks/{task_id}/steps", response_model=Step, status_code=201)
def add_step(
    task_id: int, body: StepCreate, conn: Conn = Depends(get_conn)
) -> Step:
    if conn.execute("SELECT 1 FROM tasks WHERE id = ?", (task_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail="Task not found")
    next_pos = conn.execute(
        "SELECT COALESCE(MAX(position) + 1, 0) AS next_pos FROM steps WHERE task_id = ?",
        (task_id,),
    ).fetchone()["next_pos"]
    step_id = conn.insert(
        "INSERT INTO steps (task_id, text, position) VALUES (?, ?, ?)",
        (task_id, body.text, next_pos),
    )
    row = conn.execute("SELECT * FROM steps WHERE id = ?", (step_id,)).fetchone()
    _sync_status(conn, task_id)
    return _step(row)


@app.post("/api/tasks/{task_id}/results", response_model=Result, status_code=201)
def add_result(
    task_id: int, body: ResultCreate, conn: Conn = Depends(get_conn)
) -> Result:
    if conn.execute("SELECT 1 FROM tasks WHERE id = ?", (task_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail="Task not found")
    next_pos = conn.execute(
        "SELECT COALESCE(MAX(position) + 1, 0) AS next_pos FROM results WHERE task_id = ?",
        (task_id,),
    ).fetchone()["next_pos"]
    result_id = conn.insert(
        "INSERT INTO results (task_id, text, position) VALUES (?, ?, ?)",
        (task_id, body.text, next_pos),
    )
    row = conn.execute("SELECT * FROM results WHERE id = ?", (result_id,)).fetchone()
    return _result(row)


@app.put("/api/tasks/{task_id}/steps/order", status_code=204)
def reorder_steps(task_id: int, body: StepOrder, conn: Conn = Depends(get_conn)) -> None:
    if conn.execute("SELECT 1 FROM tasks WHERE id = ?", (task_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail="Task not found")
    existing = conn.execute("SELECT id FROM steps WHERE task_id = ?", (task_id,)).fetchall()
    if sorted(r["id"] for r in existing) != sorted(body.step_ids):
        raise HTTPException(status_code=422, detail="step_ids must list every step of the task once")
    for position, step_id in enumerate(body.step_ids):
        conn.execute("UPDATE steps SET position = ? WHERE id = ?", (position, step_id))


@app.patch("/api/steps/{step_id}", response_model=Step)
def update_step(
    step_id: int, body: StepUpdate, conn: Conn = Depends(get_conn)
) -> Step:
    cur = conn.execute("UPDATE steps SET done = ? WHERE id = ?", (int(body.done), step_id))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Step not found")
    row = conn.execute("SELECT * FROM steps WHERE id = ?", (step_id,)).fetchone()
    _sync_status(conn, row["task_id"])
    return _step(row)


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, conn: Conn = Depends(get_conn)) -> None:
    cur = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Task not found")

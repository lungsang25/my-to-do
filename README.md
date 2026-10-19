# My To-Do

A minimal to-do tracker. Enter your top priority, add the steps to achieve it one at a time, then track it on a To Do / Done board. A task moves to Done automatically once all its steps are checked (and back to To Do if one is unchecked).

- **Backend:** FastAPI + SQLite (`backend/`, data stored in `backend/todo.db`)
- **Frontend:** React + Vite + TypeScript (`frontend/`)

## Run it

Backend (http://localhost:8000):

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

Frontend (http://localhost:5173). In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to the backend, so open http://localhost:5173.

## Tests

```bash
cd backend
.venv/bin/python -m pytest
```

## API

| Method | Path | Body | Purpose |
|---|---|---|---|
| GET | `/api/tasks` | | All tasks with their steps |
| POST | `/api/tasks` | `{ "title": "..." }` | Create a task (status `todo`) |
| GET | `/api/tasks/{id}` | | One task with its steps |
| POST | `/api/tasks/{id}/steps` | `{ "text": "..." }` | Append a step |
| PATCH | `/api/steps/{id}` | `{ "done": true }` | Check or uncheck a step |
| DELETE | `/api/tasks/{id}` | | Delete a task and its steps |

Set `TODO_DB_PATH` to use a different database file.

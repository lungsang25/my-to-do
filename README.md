# My To-Do

A minimal to-do tracker. Enter your top priority, add the steps to achieve it one at a time, then track it on a To Do / Done board. A task moves to Done automatically once all its steps are checked (and back to To Do if one is unchecked).

The **Duration** button (top of the left column) sets the period you work in: 1 day (default), 1 week, 2 weeks, 1 month, 1 year, or any custom length. Periods start on the day you first choose that duration. The flame next to **Done** is that duration's streak: the number of periods in a row in which you finished every task you created during the period, before the period ended (your local time). A period with an unfinished task resets it to 0; periods with no tasks are skipped. Each duration is fully independent: every task remembers the duration it was created under, and the board, History and streak only show the active duration's tasks, so switching back and forth doesn't affect the others. Finished tasks stay in Done until their period ends, then move to History.

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
| GET | `/api/duration` | | Active duration and every duration used, with its start date |
| PUT | `/api/duration` | `{ "key": "1w", "anchor": "2026-10-21" }` | Switch duration (`anchor` = today's local date; kept from the first time a key is chosen) |

Set `TODO_DB_PATH` to use a different SQLite file. Set `DATABASE_URL` to a Postgres connection string to use Postgres instead (this is what production does).

To also run the tests against Postgres, point `TEST_DATABASE_URL` at a throwaway database (its `tasks` and `steps` tables are dropped before each test):

```bash
TEST_DATABASE_URL=postgresql://user:pass@localhost/todo_test .venv/bin/python -m pytest
```

## Deploy to Vercel

The repo deploys as two Vercel projects, both imported from this repo:

1. **Backend**: set Root Directory to `backend`. In the project's Storage tab, add a Neon Postgres database. This sets `DATABASE_URL`. Redeploy. Tables are created on the first request.
2. **Frontend**: set Root Directory to `frontend` (framework: Vite). [`frontend/vercel.json`](frontend/vercel.json) rewrites `/api/*` to `https://my-to-do-backend-lake.vercel.app`; if the backend got a different URL, update it there.

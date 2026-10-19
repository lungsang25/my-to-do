# Vercel entrypoint: Vercel's FastAPI support looks for an `app` in index.py.
from app.main import app  # noqa: F401

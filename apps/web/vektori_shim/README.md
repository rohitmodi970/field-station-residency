# Vektori Shim

Lightweight FastAPI shim that exposes `/health`, `/add`, and `/search` endpoints.

- If the `vektori` Python package is installed, the shim will use an in-memory `Vektori` instance.
- Otherwise it provides a safe in-memory fallback useful for local dev and backfill dry-runs.

Run:

```bash
cd apps/web
# Use the workspace python as configured by the environment
c:/Users/Srinjoy/Downloads/force_/.venv/Scripts/python.exe -m uvicorn vektori_shim.main:app --host 127.0.0.1 --port 8787 --reload
```

Endpoints:
- `GET /health` — check service
- `POST /add` — body `{ user_id, session_id?, messages: [{role, content}] }`
- `GET /search?user_id=...&q=...&depth=l1` — naive mock search or real Vektori search

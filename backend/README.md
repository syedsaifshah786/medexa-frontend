# Medexa Local FastAPI Backend

This backend serves local mock data for the Medexa frontend prototype.

## Run Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health check:

```text
http://localhost:8000/health
```

## Run Frontend

From the project root:

```powershell
npm run dev
```

The frontend reads:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

If the local backend is not running, the frontend falls back to its existing mock data.

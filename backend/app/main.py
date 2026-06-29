from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import billing, claims, patient_summary, sessions, soap_notes, transcripts

app = FastAPI(title="Medexa Local API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(sessions.router)
app.include_router(transcripts.router)
app.include_router(soap_notes.router)
app.include_router(billing.router)
app.include_router(patient_summary.router)
app.include_router(claims.router)

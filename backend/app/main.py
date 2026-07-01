from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import analysis, audio, billing, claims, patient_summary, session_transcript_analysis, sessions, soap_notes, transcripts
from app.services.llm_service import get_llm_settings, test_openai_auth

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


@app.get("/debug/llm-health")
def llm_health() -> dict:
    return get_llm_settings()


@app.get("/debug/openai-auth-test")
def openai_auth_test() -> dict:
    return test_openai_auth()


app.include_router(sessions.router)
app.include_router(analysis.router)
app.include_router(audio.router)
app.include_router(session_transcript_analysis.router)
app.include_router(transcripts.router)
app.include_router(soap_notes.router)
app.include_router(billing.router)
app.include_router(patient_summary.router)
app.include_router(claims.router)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.data import SOAP_NOTES_STORE
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


@app.get("/debug/soap-store")
def soap_store() -> dict:
    return {"count": len(SOAP_NOTES_STORE), "keys": list(SOAP_NOTES_STORE.keys())}


@app.get("/debug/soap-store/{session_id}")
def soap_store_session(session_id: str) -> dict:
    if session_id in SOAP_NOTES_STORE:
        return SOAP_NOTES_STORE[session_id]
    return {"detail": "SOAP note not generated for this session"}


@app.get("/debug/active-routes")
def active_routes() -> dict:
    routes = []
    route_sources = list(app.routes)
    for route in app.routes:
        original_router = getattr(route, "original_router", None)
        if original_router is not None:
            route_sources.extend(getattr(original_router, "routes", []) or [])

    for route in route_sources:
        path = getattr(route, "path", "")
        if not path:
            continue
        routes.append(
            {
                "path": path,
                "methods": sorted(getattr(route, "methods", []) or []),
                "name": getattr(route, "name", ""),
            }
        )
    return {"routes": routes}


app.include_router(sessions.router)
app.include_router(analysis.router)
app.include_router(audio.router)
app.include_router(session_transcript_analysis.router)
app.include_router(transcripts.router)
app.include_router(soap_notes.router)
app.include_router(billing.router)
app.include_router(patient_summary.router)
app.include_router(claims.router)

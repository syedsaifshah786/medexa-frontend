from fastapi import APIRouter, HTTPException

from app import data
from app.schemas import StartSessionRequest, SessionStateUpdate

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("")
def list_sessions() -> list[dict]:
    return data.sessions


@router.get("/{session_id}")
def session_detail(session_id: str) -> dict:
    data.ensure_session(session_id)
    return data.get_session(session_id)


@router.post("/start")
def start_session(payload: StartSessionRequest) -> dict:
    session_id = payload.session_id or payload.patient_id or "new-session"
    data.ensure_session(session_id)
    session = data.get_session(session_id)
    session["status"] = "active"
    data.session_states[session_id] = data.state_from_elapsed("recording", 0)
    return {"session": session, "state": data.session_states[session_id]}


@router.get("/{session_id}/state")
def get_state(session_id: str) -> dict:
    data.ensure_session(session_id)
    return data.session_states[session_id]


@router.post("/{session_id}/state")
def update_state(session_id: str, payload: SessionStateUpdate) -> dict:
    data.ensure_session(session_id)
    elapsed = payload.elapsedSeconds
    if elapsed is None:
        elapsed = data.session_states[session_id]["elapsedSeconds"]
    data.session_states[session_id] = data.state_from_elapsed(payload.status, elapsed)
    return data.session_states[session_id]


@router.get("/{session_id}/insights")
def list_insights(session_id: str) -> list[dict]:
    data.ensure_session(session_id)
    return data.insights_by_session[session_id]


@router.post("/{session_id}/insights/{insight_id}/approve")
def approve_insight(session_id: str, insight_id: str) -> dict:
    data.ensure_session(session_id)
    for insight in data.insights_by_session[session_id]:
        if insight["id"] == insight_id:
            insight["status"] = "approved"
            return insight
    raise HTTPException(status_code=404, detail="Insight not found")


@router.post("/{session_id}/insights/{insight_id}/ignore")
def ignore_insight(session_id: str, insight_id: str) -> dict:
    data.ensure_session(session_id)
    for insight in data.insights_by_session[session_id]:
        if insight["id"] == insight_id:
            insight["status"] = "ignored"
            return insight
    raise HTTPException(status_code=404, detail="Insight not found")


@router.get("/{session_id}/suggestions")
def list_suggestions(session_id: str) -> list[dict]:
    data.ensure_session(session_id)
    return data.suggestions_by_session[session_id]


@router.post("/{session_id}/suggestions/{suggestion_id}/apply")
def apply_suggestion(session_id: str, suggestion_id: str) -> dict:
    data.ensure_session(session_id)
    for suggestion in data.suggestions_by_session[session_id]:
        if suggestion["id"] == suggestion_id:
            suggestion["applied"] = True
            return suggestion
    raise HTTPException(status_code=404, detail="Suggestion not found")

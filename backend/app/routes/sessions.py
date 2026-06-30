from fastapi import APIRouter, HTTPException

from app import data
from app.schemas import CptTimerStartRequest, StartSessionRequest, SessionStateUpdate

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
    timer_state = data.timer_states[session_id]
    data.timer_states[session_id] = data.timer_state_from_elapsed(
        session_id,
        payload.status,
        elapsed,
        timer_state["cpt_timer"],
    )
    return data.session_states[session_id]


@router.get("/{session_id}/timer-state")
def get_timer_state(session_id: str) -> dict:
    data.ensure_session(session_id)
    return data.timer_states[session_id]


@router.post("/{session_id}/timer-state/start")
def start_timer_state(session_id: str) -> dict:
    data.ensure_session(session_id)
    cpt_timer = data.timer_states[session_id]["cpt_timer"]
    data.timer_states[session_id] = data.timer_state_from_elapsed(
        session_id,
        "recording",
        0,
        cpt_timer if cpt_timer["status"] != "idle" else data.cpt_timer_from_elapsed(),
    )
    data.session_states[session_id] = data.state_from_elapsed("recording", 0)
    return data.timer_states[session_id]


@router.post("/{session_id}/timer-state/pause")
def pause_timer_state(session_id: str) -> dict:
    data.ensure_session(session_id)
    state = data.timer_states[session_id]
    cpt_timer = state["cpt_timer"].copy()
    if cpt_timer["status"] == "running":
        cpt_timer = data.cpt_timer_from_elapsed(
            "paused",
            cpt_timer["seconds"],
            cpt_timer["code"],
            cpt_timer.get("source"),
            cpt_timer.get("reason"),
        )
    data.timer_states[session_id] = data.timer_state_from_elapsed(
        session_id,
        "paused",
        state["total_seconds"],
        cpt_timer,
    )
    data.session_states[session_id] = data.state_from_elapsed("paused", state["total_seconds"])
    return data.timer_states[session_id]


@router.post("/{session_id}/timer-state/resume")
def resume_timer_state(session_id: str) -> dict:
    data.ensure_session(session_id)
    state = data.timer_states[session_id]
    cpt_timer = state["cpt_timer"].copy()
    if cpt_timer["status"] == "paused":
        cpt_timer = data.cpt_timer_from_elapsed(
            "running",
            cpt_timer["seconds"],
            cpt_timer["code"],
            cpt_timer.get("source"),
            cpt_timer.get("reason"),
        )
    data.timer_states[session_id] = data.timer_state_from_elapsed(
        session_id,
        "recording",
        state["total_seconds"],
        cpt_timer,
    )
    data.session_states[session_id] = data.state_from_elapsed("recording", state["total_seconds"])
    return data.timer_states[session_id]


@router.post("/{session_id}/timer-state/stop")
def stop_timer_state(session_id: str) -> dict:
    data.ensure_session(session_id)
    state = data.timer_states[session_id]
    cpt_timer = state["cpt_timer"].copy()
    if cpt_timer["status"] in {"running", "paused"}:
        cpt_timer = data.cpt_timer_from_elapsed(
            "stopped",
            cpt_timer["seconds"],
            cpt_timer["code"],
            cpt_timer.get("source"),
            cpt_timer.get("reason"),
        )
    data.timer_states[session_id] = data.timer_state_from_elapsed(
        session_id,
        "stopped",
        state["total_seconds"],
        cpt_timer,
    )
    data.session_states[session_id] = data.state_from_elapsed("stopped", state["total_seconds"])
    return data.timer_states[session_id]


@router.post("/{session_id}/cpt-timer/start")
def start_cpt_timer(session_id: str, payload: CptTimerStartRequest) -> dict:
    data.ensure_session(session_id)
    state = data.timer_states[session_id]
    cpt_timer = data.cpt_timer_from_elapsed(
        "running",
        0,
        payload.code,
        payload.source,
        payload.reason,
    )
    data.timer_states[session_id] = data.timer_state_from_elapsed(
        session_id,
        state["recording_status"],
        state["total_seconds"],
        cpt_timer,
    )
    return data.timer_states[session_id]


@router.post("/{session_id}/cpt-timer/pause")
def pause_cpt_timer(session_id: str) -> dict:
    data.ensure_session(session_id)
    state = data.timer_states[session_id]
    cpt_timer = state["cpt_timer"]
    data.timer_states[session_id] = data.timer_state_from_elapsed(
        session_id,
        state["recording_status"],
        state["total_seconds"],
        data.cpt_timer_from_elapsed(
            "paused",
            cpt_timer["seconds"],
            cpt_timer["code"],
            cpt_timer.get("source"),
            cpt_timer.get("reason"),
        ),
    )
    return data.timer_states[session_id]


@router.post("/{session_id}/cpt-timer/resume")
def resume_cpt_timer(session_id: str) -> dict:
    data.ensure_session(session_id)
    state = data.timer_states[session_id]
    cpt_timer = state["cpt_timer"]
    data.timer_states[session_id] = data.timer_state_from_elapsed(
        session_id,
        state["recording_status"],
        state["total_seconds"],
        data.cpt_timer_from_elapsed(
            "running",
            cpt_timer["seconds"],
            cpt_timer["code"],
            cpt_timer.get("source"),
            cpt_timer.get("reason"),
        ),
    )
    return data.timer_states[session_id]


@router.post("/{session_id}/cpt-timer/stop")
def stop_cpt_timer(session_id: str) -> dict:
    data.ensure_session(session_id)
    state = data.timer_states[session_id]
    cpt_timer = state["cpt_timer"]
    data.timer_states[session_id] = data.timer_state_from_elapsed(
        session_id,
        state["recording_status"],
        state["total_seconds"],
        data.cpt_timer_from_elapsed(
            "stopped",
            cpt_timer["seconds"],
            cpt_timer["code"],
            cpt_timer.get("source"),
            cpt_timer.get("reason"),
        ),
    )
    return data.timer_states[session_id]


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

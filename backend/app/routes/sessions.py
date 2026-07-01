import re

from fastapi import APIRouter, HTTPException

from app import data
from app.data import SOAP_NOTES_STORE
from app.schemas import CptTimerStartRequest, DebugDetectRequest, FinalizeSessionRequest, StartSessionRequest, SessionStateUpdate
from app.services.llm_service import generate_soap_with_llm
from app.services.rule_engine import analyze_transcript_chunk

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _normalize_speech_text(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", text.lower())).strip()


def _detect_trigger_command(text: str) -> dict:
    phrase = _normalize_speech_text(text)
    wake_words = [
        "medexa",
        "hey medexa",
        "hi medexa",
        "okay medexa",
        "ok medexa",
        "madexa",
        "med exa",
        "medix",
        "medics",
        "medicsa",
        "mede xa",
        "med ex",
        "med extra",
    ]
    command_phrases = [
        ("start_recording", ["medexa start recording", "hey medexa start recording", "medexa begin session", "medexa start session", "start recording"]),
        ("stop_recording", ["medexa stop recording", "medexa stop session", "stop recording"]),
        ("pause", ["medexa pause", "pause recording"]),
        ("resume", ["medexa resume", "resume recording"]),
        ("start_cpt", ["medexa start cpt", "start cpt timer", "start procedure timer", "start procedure"]),
    ]
    wake_word_detected = any(wake_word in phrase for wake_word in wake_words)

    for command, phrases in command_phrases:
        if any(command_phrase in phrase for command_phrase in phrases):
            return {
                "wakeWordDetected": wake_word_detected or True,
                "command": command,
                "phrase": phrase,
                "confidence": "high" if wake_word_detected else "medium",
            }

    return {
        "wakeWordDetected": wake_word_detected,
        "command": "none",
        "phrase": phrase,
        "confidence": "medium" if wake_word_detected else "low",
    }


def _timer_response(session_id: str) -> dict:
    state = data.timer_states[session_id].copy()
    state["cpt_records"] = list(data.cpt_records_by_session.get(session_id, {}).values())
    return state


def _close_active_cpt_record(session_id: str, end_second: int) -> None:
    state = data.timer_states[session_id]
    cpt_timer = state["cpt_timer"]
    code = cpt_timer.get("code")
    if not code:
        return

    records = data.cpt_records_by_session.setdefault(session_id, {})
    record = records.get(code) or {
        "code": code,
        "displayName": code,
        "seconds": 0,
        "units": 0,
        "status": "stopped",
        "source": cpt_timer.get("source") or "manual",
        "reason": cpt_timer.get("reason") or "",
        "intervals": [],
    }
    record["seconds"] = cpt_timer.get("seconds", record.get("seconds", 0))
    record["units"] = data.cpt_units_from_seconds(record["seconds"])
    record["status"] = "stopped"
    record["source"] = cpt_timer.get("source") or record.get("source") or "manual"
    record["reason"] = cpt_timer.get("reason") or record.get("reason") or ""
    if record["intervals"]:
        last_interval = record["intervals"][-1]
        if last_interval.get("endSecond") is None:
            last_interval["endSecond"] = end_second
    records[code] = record


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
    return _timer_response(session_id)


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
    return _timer_response(session_id)


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
    return _timer_response(session_id)


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
    return _timer_response(session_id)


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
    return _timer_response(session_id)


@router.post("/{session_id}/cpt-timer/start")
def start_cpt_timer(session_id: str, payload: CptTimerStartRequest) -> dict:
    data.ensure_session(session_id)
    state = data.timer_states[session_id]
    _close_active_cpt_record(session_id, state["total_seconds"])
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
    data.cpt_records_by_session.setdefault(session_id, {})[payload.code] = {
        "code": payload.code,
        "displayName": payload.code,
        "seconds": 0,
        "units": 0,
        "status": "running",
        "source": payload.source,
        "reason": payload.reason,
        "intervals": [{"startSecond": state["total_seconds"]}],
    }
    return _timer_response(session_id)


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
    _close_active_cpt_record(session_id, state["total_seconds"])
    return _timer_response(session_id)


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
    code = cpt_timer.get("code")
    if code:
        record = data.cpt_records_by_session.setdefault(session_id, {}).get(code)
        if record:
            record["status"] = "running"
            record.setdefault("intervals", []).append({"startSecond": state["total_seconds"]})
    return _timer_response(session_id)


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
    _close_active_cpt_record(session_id, state["total_seconds"])
    return _timer_response(session_id)


@router.post("/{session_id}/finalize-session")
def finalize_session(session_id: str, payload: FinalizeSessionRequest) -> dict:
    print("[Finalize] called for session:", session_id)
    print("[Finalize] transcript length:", len(payload.transcript or ""))
    data.ensure_session(session_id)
    llm_payload = payload.model_dump()
    generated = generate_soap_with_llm(llm_payload)
    soap_note = {
        "chief_complaint": generated.get("chief_complaint", generated["subjective"]),
        "pain_scale": generated.get("pain_scale", "Requires clinician review"),
        "duration": generated.get("duration", f"{payload.total_seconds // 60}:{str(payload.total_seconds % 60).zfill(2)}"),
        "observation_notes": generated.get("observation_notes", generated["objective"]),
        "range_of_motion": generated.get("range_of_motion", "Requires clinician review"),
        "affect": generated.get("affect", "Requires clinician review"),
        "vital_signs": generated.get("vital_signs", "Requires clinician review"),
        "diagnosis_summary": generated.get("diagnosis_summary", generated["assessment"]),
        "subjective": {
            "chiefComplaint": generated.get("chief_complaint", generated["subjective"]),
            "painScale": generated.get("pain_scale", "Requires clinician review"),
            "duration": generated.get("duration", f"{payload.total_seconds // 60}:{str(payload.total_seconds % 60).zfill(2)}"),
        },
        "objective": {
            "observationNotes": generated.get("observation_notes", generated["objective"]),
            "rangeOfMotion": generated.get("range_of_motion", "Requires clinician review"),
            "affect": generated.get("affect", "Requires clinician review"),
            "vitalSigns": generated.get("vital_signs", "Requires clinician review"),
        },
        "assessment": {
            "diagnosisSummary": generated.get("diagnosis_summary", generated["assessment"]),
            "primaryDiagnosisCode": "Requires clinician review",
            "severity": "Requires clinician review",
        },
        "plan": {
            "followUpPlan": generated["plan"],
        },
    }
    summary = generated.get("summary") or "AI-assisted suggestions require clinician review."
    billing_summary = generated.get("billing_summary") or {
        "total_seconds": payload.total_seconds,
        "cpt_records": [record.model_dump() for record in payload.cpt_records],
    }
    billing_summary["total_seconds"] = payload.total_seconds
    billing_summary["cpt_records"] = [record.model_dump() for record in payload.cpt_records]
    print("[Finalize] generated soap keys:", soap_note.keys())
    response_payload = {
        "session_id": session_id,
        "soap_note": soap_note,
        "summary": summary,
        "billing_summary": billing_summary,
        "redirect_url": f"/soap-notes?sessionId={session_id}",
        "llm_used": bool(generated.get("llm_used")),
        "llm_fallback_reason": generated.get("llm_fallback_reason", ""),
    }
    SOAP_NOTES_STORE[session_id] = response_payload
    print("[Finalize] saved SOAP for session:", session_id)
    print("[Finalize] SOAP store keys:", list(SOAP_NOTES_STORE.keys()))
    data.generated_soap_session_ids.add(session_id)
    data.summaries_by_session[session_id]["summary"] = summary
    return response_payload


@router.post("/{session_id}/debug-detect")
def debug_detect(session_id: str, payload: DebugDetectRequest) -> dict:
    data.ensure_session(session_id)
    analysis = analyze_transcript_chunk(payload.text, "00:00", "00:10")
    return {
        "trigger_command": _detect_trigger_command(payload.text),
        "cpt_timer_suggestion": analysis.get("cpt_timer_suggestion"),
        "cpt_suggestions": analysis.get("cpt_suggestions", []),
        "live_suggestions": analysis.get("live_suggestions", []),
    }


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

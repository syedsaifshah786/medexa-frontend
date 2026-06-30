import re

from fastapi import APIRouter, HTTPException

from app import data
from app.schemas import CptTimerStartRequest, DebugDetectRequest, FinalizeSessionRequest, StartSessionRequest, SessionStateUpdate
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


@router.post("/{session_id}/finalize-session")
def finalize_session(session_id: str, payload: FinalizeSessionRequest) -> dict:
    data.ensure_session(session_id)
    session = data.get_session(session_id)
    transcript_excerpt = " ".join(payload.transcript.split())[:420]
    cpt_codes = [
        f"{item.get('code')} {item.get('display_name', '')}".strip()
        for item in payload.detected_cpt_suggestions
        if item.get("code")
    ]
    icd_codes = [
        f"{item.get('code')} from phrase '{item.get('phrase')}'"
        for item in payload.detected_icd10_suggestions
        if item.get("code")
    ]
    ncci_notes = [
        item.get("explanation", "NCCI conflict requires clinician billing review.")
        for item in payload.ncci_conflicts
    ]
    applied_notes = "; ".join(payload.applied_suggestions[:6])
    cpt_code = payload.cpt_timer.code
    cpt_seconds = payload.cpt_timer.seconds
    cpt_units = payload.cpt_timer.units
    cpt_minutes = f"{cpt_seconds // 60}:{str(cpt_seconds % 60).zfill(2)}"

    soap_note = {
        "subjective": {
            "chiefComplaint": transcript_excerpt
            or f"{session['patientName']} participated in the {session['careType'].lower()} encounter.",
            "painScale": "Requires clinician review",
            "duration": f"{payload.total_seconds // 60}:{str(payload.total_seconds % 60).zfill(2)}",
        },
        "objective": {
            "observationNotes": " ".join(
                [
                    f"AI-assisted session draft for {session['patientName']}.",
                    f"Suggested CPT timing: {cpt_code or 'None'} for {cpt_minutes}, {cpt_units} unit(s).",
                    f"Applied suggestions: {applied_notes or 'None'}.",
                ]
            ),
            "rangeOfMotion": "Requires clinician review",
            "affect": "Requires clinician review",
            "vitalSigns": "Requires clinician review",
        },
        "assessment": {
            "diagnosisSummary": " ".join(
                [
                    "AI-assisted suggestion requiring clinician review.",
                    f"ICD suggestions: {', '.join(icd_codes[:4]) or 'None detected'}.",
                    f"CPT suggestions: {', '.join(cpt_codes[:4]) or 'None detected'}.",
                    f"NCCI warnings: {' '.join(ncci_notes[:3]) or 'None detected'}.",
                ]
            ),
            "primaryDiagnosisCode": session["icd"],
            "severity": "Requires clinician review",
        },
        "plan": {
            "followUpPlan": "Clinician should review transcript-derived SOAP content, suggested CPT/ICD codes, units, and billing alerts before signing or billing.",
        },
    }
    summary = " ".join(
        [
            soap_note["subjective"]["chiefComplaint"],
            soap_note["objective"]["observationNotes"],
            soap_note["assessment"]["diagnosisSummary"],
            soap_note["plan"]["followUpPlan"],
        ]
    )
    data.soap_notes_by_session[session_id] = soap_note
    data.summaries_by_session[session_id]["summary"] = summary
    return {
        "session_id": session_id,
        "soap_note": soap_note,
        "summary": summary,
        "billing_summary": {
            "total_seconds": payload.total_seconds,
            "cpt_code": cpt_code,
            "cpt_seconds": cpt_seconds,
            "units": cpt_units,
        },
        "redirect_url": f"/soap-notes?sessionId={session_id}",
    }


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

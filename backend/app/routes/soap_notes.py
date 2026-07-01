from fastapi import APIRouter, HTTPException

from app import data
from app.data import get_soap_note, save_soap_note
from app.schemas import SoapNotesPayload

router = APIRouter(prefix="/soap-notes", tags=["soap-notes"])


@router.get("/{session_id}")
def get_soap_notes(session_id: str) -> dict:
    print("[SOAP GET FILE STORE] requested:", session_id)
    note = get_soap_note(session_id)
    print("[SOAP GET FILE STORE] found:", bool(note))
    if note:
        return note
    raise HTTPException(status_code=404, detail="SOAP note not generated for this session")


@router.put("/{session_id}")
def update_soap_notes(session_id: str, payload: SoapNotesPayload) -> dict:
    data.ensure_session(session_id)
    saved = save_soap_note(session_id, payload.model_dump())
    data.generated_soap_session_ids.add(session_id)
    return saved


@router.post("/{session_id}/generate")
def generate_soap_notes(session_id: str) -> dict:
    data.ensure_session(session_id)
    session = data.get_session(session_id)
    approved = [
        insight
        for insight in data.insights_by_session[session_id]
        if insight.get("status") == "approved"
    ]
    notes = " ".join(insight["description"] for insight in approved)
    generated = {
        "subjective": {
            "chiefComplaint": notes or f"{session['patientName']} reports current concerns during the {session['careType'].lower()} encounter.",
            "painScale": "6" if session["icd"].startswith("M") else "4",
            "duration": "3 weeks" if notes else "Current session",
        },
        "objective": {
            "observationNotes": f"Live session documentation for {session['patientName']} was reviewed. {notes or 'Patient participation and symptom tolerance were monitored.'}",
            "rangeOfMotion": "Lumbar mobility guarded" if session["icd"].startswith("M") else "Functional mobility monitored",
            "affect": "Alert, cooperative",
            "vitalSigns": "Vital signs within normal limits",
        },
        "assessment": {
            "diagnosisSummary": f"{session['careType']} encounter associated with {session['icd']}. Clinical findings support continued skilled intervention.",
            "primaryDiagnosisCode": session["icd"],
            "severity": "Moderate" if session["icd"].startswith("M") else "Stable",
        },
        "plan": {
            "followUpPlan": "Continue skilled session documentation, address protocol prompts, and reassess functional tolerance at the next visit.",
        },
    }
    save_soap_note(session_id, generated)
    data.generated_soap_session_ids.add(session_id)
    data.summaries_by_session[session_id]["summary"] = " ".join(
        [
            generated["subjective"]["chiefComplaint"],
            generated["objective"]["observationNotes"],
            generated["assessment"]["diagnosisSummary"],
            generated["plan"]["followUpPlan"],
        ]
    )
    return generated

from fastapi import APIRouter

from app import data
from app.schemas import SummaryPayload

router = APIRouter(prefix="/patient-summary", tags=["patient-summary"])


@router.get("/{session_id}")
def get_patient_summary(session_id: str) -> dict:
    data.ensure_session(session_id)
    return data.summaries_by_session[session_id]


@router.put("/{session_id}")
def update_patient_summary(session_id: str, payload: SummaryPayload) -> dict:
    data.ensure_session(session_id)
    data.summaries_by_session[session_id]["summary"] = payload.summary
    return data.summaries_by_session[session_id]


@router.post("/{session_id}/send")
def send_patient_summary(session_id: str) -> dict:
    data.ensure_session(session_id)
    data.summaries_by_session[session_id]["sent"] = True
    return data.summaries_by_session[session_id]

from fastapi import APIRouter

from app import data
from app.schemas import CptPayload, DiagnosisPayload, SessionMetaPayload

router = APIRouter(prefix="/claims", tags=["claims"])


@router.get("/{session_id}")
def get_claim(session_id: str) -> dict:
    data.ensure_session(session_id)
    return data.claims_by_session[session_id]


@router.post("/{session_id}/cpt")
def add_claim_cpt(session_id: str, payload: CptPayload) -> dict:
    data.ensure_session(session_id)
    item = {
        "id": f"cpt-{payload.code}-{len(data.claims_by_session[session_id]['cptItems']) + 1}",
        "code": payload.code,
        "description": payload.description or payload.title or payload.code,
        "units": payload.units,
        "duration": payload.duration,
        "modifier": payload.modifier,
    }
    data.claims_by_session[session_id]["cptItems"].append(item)
    return item


@router.post("/{session_id}/diagnosis")
def add_claim_diagnosis(session_id: str, payload: DiagnosisPayload) -> dict:
    data.ensure_session(session_id)
    item = payload.model_dump()
    item["id"] = f"dx-{payload.code.lower().replace('.', '')}-{len(data.claims_by_session[session_id]['diagnosisCodes']) + 1}"
    data.claims_by_session[session_id]["diagnosisCodes"].append(item)
    return item


@router.put("/{session_id}/session-data")
def update_session_data(session_id: str, payload: SessionMetaPayload) -> dict:
    data.ensure_session(session_id)
    data.claims_by_session[session_id]["patientMeta"] = payload.model_dump()
    return data.claims_by_session[session_id]


@router.post("/{session_id}/save-draft")
def save_draft(session_id: str) -> dict:
    data.ensure_session(session_id)
    data.claims_by_session[session_id]["claimStatus"] = "draft"
    return data.claims_by_session[session_id]


@router.post("/{session_id}/verify")
def verify_claim(session_id: str) -> dict:
    data.ensure_session(session_id)
    data.claims_by_session[session_id]["claimStatus"] = "verified"
    return data.claims_by_session[session_id]


@router.post("/{session_id}/submit")
def submit_claim(session_id: str) -> dict:
    data.ensure_session(session_id)
    data.claims_by_session[session_id]["claimStatus"] = "submitted"
    return data.claims_by_session[session_id]

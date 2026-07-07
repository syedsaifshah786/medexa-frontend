from fastapi import APIRouter, Body

from app import data
from app.schemas import CptPayload, DiagnosisPayload, SessionMetaPayload
from app.services.claim_service import (
    add_claim_cpt as service_add_claim_cpt,
    add_claim_diagnosis as service_add_claim_diagnosis,
    build_claim_document,
    get_claim as service_get_claim,
    save_claim_document_draft as service_save_claim_document_draft,
    set_claim_status,
    submit_claim as service_submit_claim,
    update_session_data as service_update_session_data,
    verify_claim_document as service_verify_claim_document,
)
from app.services.localization import normalize_language
from app.services.team_backend_adapter import integration_status

router = APIRouter(prefix="/claims", tags=["claims"])
session_claim_router = APIRouter(prefix="/sessions", tags=["claim-document"])
debug_router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/{session_id}")
def get_claim(session_id: str, language: str = "en") -> dict:
    return service_get_claim(session_id, language)


@router.post("/{session_id}/cpt")
def add_claim_cpt(session_id: str, payload: CptPayload) -> dict:
    return service_add_claim_cpt(session_id, payload)


@router.post("/{session_id}/diagnosis")
def add_claim_diagnosis(session_id: str, payload: DiagnosisPayload) -> dict:
    return service_add_claim_diagnosis(session_id, payload)


@router.put("/{session_id}/session-data")
def update_claim_session_data(session_id: str, payload: SessionMetaPayload) -> dict:
    return service_update_session_data(session_id, payload)


@router.post("/{session_id}/save-draft")
def save_draft(session_id: str, language: str = "en") -> dict:
    return set_claim_status(session_id, "draft", language)


@router.post("/{session_id}/verify")
def verify_claim(session_id: str, language: str = "en") -> dict:
    return set_claim_status(session_id, "verified", language)


@router.post("/{session_id}/submit")
def submit_claim(session_id: str, language: str = "en") -> dict:
    return service_submit_claim(session_id, language)


@session_claim_router.get("/{session_id}/claim-document")
def get_claim_document(session_id: str, language: str = "en") -> dict:
    return build_claim_document(session_id, language)


@session_claim_router.post("/{session_id}/claim-document/verify")
def verify_claim_document(session_id: str, language: str = "en") -> dict:
    return service_verify_claim_document(session_id, language)


@session_claim_router.post("/{session_id}/claim-document/draft")
def save_claim_document_draft(session_id: str, payload: dict = Body(default_factory=dict), language: str = "en") -> dict:
    return service_save_claim_document_draft(session_id, payload, language)


@session_claim_router.get("/{session_id}/claim-document/837p-draft")
def get_claim_document_837p_draft(session_id: str, language: str = "en") -> dict:
    return build_claim_document(session_id, language)["draft_837p"]


@debug_router.get("/claim-document/{session_id}")
def debug_claim_document(session_id: str, language: str = "en") -> dict:
    normalized_language = normalize_language(language)
    claim_document = build_claim_document(session_id, normalized_language)
    return {
        "session_id": session_id,
        "sources": {
            "soap_note_found": bool(data.get_soap_note(session_id, normalized_language)),
            "cpt_records_found": bool(data.cpt_records_by_session.get(session_id)),
            "icd_found": bool(claim_document.get("diagnoses")),
            "claim_service": True,
        },
        "claim_document": claim_document,
    }


@debug_router.get("/team-backend-integration")
def debug_team_backend_integration() -> dict:
    return integration_status()

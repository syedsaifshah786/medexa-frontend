from fastapi import APIRouter, HTTPException

from app import data
from app.schemas import CptPayload
from app.services.billing_summary_service import build_billing_summary

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/{session_id}")
def get_billing(session_id: str, language: str = "en") -> dict:
    data.ensure_session(session_id)
    return build_billing_summary(session_id, language)


@router.post("/{session_id}/cpt")
def add_cpt(session_id: str, payload: CptPayload) -> dict:
    data.ensure_session(session_id)
    item = payload.model_dump()
    item["id"] = f"cpt-{payload.code}-{len(data.billing_by_session[session_id]['cptCodes']) + 1}"
    item["title"] = item["title"] or item["description"] or payload.code
    item["status"] = "pending"
    data.billing_by_session[session_id]["cptCodes"].append(item)
    return item


@router.put("/{session_id}/cpt/{cpt_id}")
def edit_cpt(session_id: str, cpt_id: str, payload: CptPayload) -> dict:
    data.ensure_session(session_id)
    for item in data.billing_by_session[session_id]["cptCodes"]:
        if item["id"] == cpt_id:
            item.update(payload.model_dump(exclude_none=True))
            item["title"] = item.get("title") or item.get("description") or item["code"]
            return item
    raise HTTPException(status_code=404, detail="CPT item not found")


@router.post("/{session_id}/cpt/{cpt_id}/approve")
def approve_cpt(session_id: str, cpt_id: str) -> dict:
    return _update_status(session_id, cpt_id, "approved")


@router.post("/{session_id}/cpt/{cpt_id}/reject")
def reject_cpt(session_id: str, cpt_id: str) -> dict:
    return _update_status(session_id, cpt_id, "rejected")


def _update_status(session_id: str, cpt_id: str, status: str) -> dict:
    data.ensure_session(session_id)
    for item in data.billing_by_session[session_id]["cptCodes"]:
        if item["id"] == cpt_id:
            item["status"] = status
            return item
    raise HTTPException(status_code=404, detail="CPT item not found")

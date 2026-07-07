from __future__ import annotations

from copy import deepcopy
from typing import Any

from app import data


class LocalSessionRepository:
    """Lightweight repository over the existing local stores."""

    def ensure(self, session_id: str) -> None:
        data.ensure_session(session_id)

    def get_session(self, session_id: str) -> dict[str, Any]:
        self.ensure(session_id)
        return data.get_session(session_id)

    def save_session(self, session_id: str, session: dict[str, Any]) -> None:
        data.SESSION_STORE[session_id] = session
        for index, item in enumerate(data.sessions):
            if item.get("id") == session_id:
                data.sessions[index] = session
                break
        else:
            data.sessions.append(session)

    def get_claim(self, session_id: str) -> dict[str, Any]:
        self.ensure(session_id)
        return data.claims_by_session[session_id]

    def save_claim(self, session_id: str, claim: dict[str, Any]) -> dict[str, Any]:
        self.ensure(session_id)
        data.claims_by_session[session_id] = claim
        return claim

    def get_cpt_records(self, session_id: str) -> dict[str, Any]:
        self.ensure(session_id)
        return data.cpt_records_by_session.setdefault(session_id, {})

    def save_cpt_record(self, session_id: str, code: str, record: dict[str, Any]) -> dict[str, Any]:
        records = self.get_cpt_records(session_id)
        records[code] = record
        return record

    def get_billing(self, session_id: str) -> dict[str, Any]:
        self.ensure(session_id)
        return data.billing_by_session[session_id]

    def save_billing(self, session_id: str, billing: dict[str, Any]) -> dict[str, Any]:
        self.ensure(session_id)
        data.billing_by_session[session_id] = billing
        return billing

    def get_claim_document_draft(self, session_id: str) -> dict[str, Any]:
        return data.claim_document_drafts_by_session.get(session_id, {})

    def save_claim_document_draft(self, session_id: str, draft: dict[str, Any]) -> dict[str, Any]:
        self.ensure(session_id)
        data.claim_document_drafts_by_session[session_id] = deepcopy(draft)
        return data.claim_document_drafts_by_session[session_id]

    def list_all(self) -> list[dict[str, Any]]:
        return [deepcopy(session) for session in data.sessions]


session_repository = LocalSessionRepository()

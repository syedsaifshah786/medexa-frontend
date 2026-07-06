from datetime import datetime, timezone

from fastapi import APIRouter, Body

from app import data
from app.schemas import CptPayload, DiagnosisPayload, SessionMetaPayload
from app.services.localization import normalize_language, translate_cpt_display_name
from app.services.rule_engine import enrich_billing_payload, load_rules

router = APIRouter(prefix="/claims", tags=["claims"])
session_claim_router = APIRouter(prefix="/sessions", tags=["claim-document"])
debug_router = APIRouter(prefix="/debug", tags=["debug"])

REVIEW_TEXT = {
    "en": "Requires Review",
    "ar": "يتطلب المراجعة",
    "he": "Requires Review",
}


def _is_known_session(session_id: str) -> bool:
    return (
        any(session.get("id") == session_id for session in data.sessions)
        or session_id in data.SESSION_STORE
        or bool(data.cpt_records_by_session.get(session_id))
        or bool(data.get_soap_note(session_id))
        or bool(data.claim_document_drafts_by_session.get(session_id))
    )


def _duration_display(seconds: int) -> str:
    safe_seconds = max(int(seconds or 0), 0)
    return f"{safe_seconds // 60:02d}:{safe_seconds % 60:02d}"


def _duration_seconds(value: str | None) -> int:
    if not value:
        return 0
    parts = str(value).split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
    except ValueError:
        return 0
    return 0


def _rule_record(lookup: object, code: str, code_field: str = "code") -> dict:
    if isinstance(lookup, dict):
        record = lookup.get(code)
        if isinstance(record, dict):
            return record
        for value in lookup.values():
            if isinstance(value, dict) and str(value.get(code_field) or "") == code:
                return value
    if isinstance(lookup, list):
        for value in lookup:
            if isinstance(value, dict) and str(value.get(code_field) or "") == code:
                return value
    return {}


def _cpt_display(code: str, fallback: str, language: str, rules: dict) -> str:
    lookup_record = _rule_record(rules.get("medexa_cpt_lookup", {}), code)
    billing_record = _rule_record(rules.get("cpt_billing_rules", {}), code, "cpt_code")
    label = lookup_record.get("label") or billing_record.get("description") or fallback or code
    return translate_cpt_display_name(code, str(label), language)


def _icd_description(code: str, fallback: str, rules: dict) -> str:
    lookup_record = _rule_record(rules.get("medexa_icd10_lookup", {}), code)
    return str(lookup_record.get("label") or lookup_record.get("description") or fallback or code)


def _patient_display_name(session: dict) -> tuple[str, int | None, str | None]:
    name = str(session.get("patientName") or "Requires Review")
    age_sex = str(session.get("ageSex") or "")
    age: int | None = None
    gender: str | None = None

    if "/" in age_sex:
        age_part, gender_part = [part.strip() for part in age_sex.split("/", 1)]
        try:
            age = int(age_part)
        except ValueError:
            age = None
        gender = gender_part or None

    if age and gender and " " in name:
        first, *rest = name.split()
        initial = rest[-1][0] if rest else ""
        display_name = f"{first} {initial}. ({age}/{gender[0].upper()})"
    elif age_sex:
        display_name = f"{name} ({age_sex})"
    else:
        display_name = name

    return display_name, age, gender


def _diagnoses_from_sources(session: dict, soap_note: dict | None, rules: dict, known_session: bool) -> list[dict]:
    suggestions: list[dict] = []
    soap = soap_note or {}

    raw_suggestions = soap.get("detected_icd10_suggestions") or soap.get("icd10_suggestions") or []
    if isinstance(raw_suggestions, list):
        suggestions.extend([item for item in raw_suggestions if isinstance(item, dict)])

    assessment = {}
    soap_payload = soap.get("soap_note")
    if isinstance(soap_payload, dict) and isinstance(soap_payload.get("assessment"), dict):
        assessment = soap_payload["assessment"]
    elif isinstance(soap.get("assessment"), dict):
        assessment = soap["assessment"]

    primary_code = str(assessment.get("primaryDiagnosisCode") or "").strip()
    if primary_code:
        suggestions.insert(
            0,
            {
                "code": primary_code,
                "phrase": assessment.get("diagnosisSummary") or soap.get("diagnosis_summary") or primary_code,
                "source": "ai_suggested",
            },
        )

    if not suggestions and known_session and session.get("icd"):
        suggestions.append({"code": session["icd"], "phrase": session["icd"], "source": "session_seed"})

    diagnoses = []
    seen: set[str] = set()
    for suggestion in suggestions:
        code = str(suggestion.get("code") or "").strip()
        if not code or code in seen:
            continue
        seen.add(code)
        pointer = chr(ord("A") + len(diagnoses))
        diagnoses.append(
            {
                "pointer": pointer,
                "code": code,
                "description": _icd_description(code, str(suggestion.get("phrase") or suggestion.get("reason") or code), rules),
                "priority": "primary" if len(diagnoses) == 0 else "secondary",
                "source": suggestion.get("source") or "ai_suggested",
                "review_required": (suggestion.get("source") or "ai_suggested") != "session_seed",
            }
        )
        if len(diagnoses) >= 4:
            break

    return diagnoses


def _cpt_lines_from_sources(session_id: str, language: str, rules: dict, known_session: bool, diagnosis_pointer: str) -> list[dict]:
    records = list(data.cpt_records_by_session.get(session_id, {}).values())
    soap_note = data.get_soap_note(session_id, language)
    billing_summary = soap_note.get("billing_summary", {}) if isinstance(soap_note, dict) else {}
    if not records and isinstance(billing_summary, dict):
        records = [item for item in billing_summary.get("cpt_records", []) if isinstance(item, dict)]

    lines: list[dict] = []
    if records:
        for index, record in enumerate(records, start=1):
            code = str(record.get("code") or "").strip()
            if not code:
                continue
            seconds = int(record.get("seconds") or 0)
            units = int(record.get("units") or data.cpt_units_from_seconds(seconds))
            display_name = _cpt_display(code, str(record.get("displayName") or record.get("reason") or code), language, rules)
            lines.append(
                {
                    "line_number": index,
                    "cpt_code": code,
                    "description": display_name,
                    "display_name": display_name,
                    "units": units,
                    "duration_seconds": seconds,
                    "duration_display": _duration_display(seconds),
                    "modifier": record.get("modifier"),
                    "diagnosis_pointer": diagnosis_pointer,
                    "validation_status": "passed" if units > 0 else "needs_review",
                    "body_region": record.get("bodyRegion") or record.get("body_region"),
                }
            )
        return lines

    if not known_session:
        return []

    billing = enrich_billing_payload(data.billing_by_session.get(session_id, {}))
    for index, item in enumerate(billing.get("cptCodes", []), start=1):
        code = str(item.get("code") or "").strip()
        if not code:
            continue
        warning = str(item.get("warning") or "")
        status = str(item.get("status") or "")
        modifier_review = "modifier" in warning.lower() and status != "approved"
        modifier = "59" if "modifier" in warning.lower() and status == "approved" else None
        duration_display = str(item.get("duration") or "")
        units = int(item.get("units") or 0)
        display_name = _cpt_display(code, str(item.get("title") or item.get("description") or code), language, rules)
        lines.append(
            {
                "line_number": index,
                "cpt_code": code,
                "description": display_name,
                "display_name": display_name,
                "units": units,
                "duration_seconds": _duration_seconds(duration_display),
                "duration_display": duration_display or _duration_display(0),
                "modifier": modifier,
                "diagnosis_pointer": diagnosis_pointer,
                "validation_status": "needs_review" if modifier_review or units <= 0 else "passed",
                "body_region": item.get("bodyRegion") or item.get("body_region"),
            }
        )
    return lines


def _build_validation(session: dict, provider: dict, cpt_lines: list[dict], diagnoses: list[dict], soap_note: dict | None, rule_warnings: list[str]) -> dict:
    missing = []
    warnings = []
    modifier_review_required = any(line.get("validation_status") == "needs_review" and not line.get("modifier") for line in cpt_lines)
    pairing_rules_missing = any("cpt_icd10_rules" in warning for warning in rule_warnings)
    review_values = set(REVIEW_TEXT.values())

    def present(value: object) -> bool:
        return bool(value) and str(value) not in review_values

    checks = {
        "patient_present": present(session.get("patientName")),
        "provider_present": present(provider.get("ordering_provider")),
        "payer_present": present(session.get("payorSource")),
        "cpt_lines_present": bool(cpt_lines),
        "diagnoses_present": bool(diagnoses),
        "units_present": bool(cpt_lines) and all(int(line.get("units") or 0) > 0 for line in cpt_lines),
        "modifier_review_required": modifier_review_required,
        "soap_note_available": bool(soap_note),
    }

    labels = {
        "patient_present": "patient info",
        "provider_present": "provider",
        "payer_present": "payer",
        "cpt_lines_present": "CPT lines",
        "diagnoses_present": "ICD codes",
        "units_present": "units",
    }
    for field, label in labels.items():
        if not checks[field]:
            missing.append(label)

    if modifier_review_required:
        warnings.append("Modifier review required before billing.")
    if pairing_rules_missing:
        warnings.append("CPT/ICD-10 pairing rules unavailable; review required.")

    return {**checks, "warnings": warnings, "missing": missing}


def _draft_837p(session_id: str, patient: dict, provider: dict, diagnoses: list[dict], cpt_lines: list[dict], validation: dict) -> dict:
    return {
        "claimType": "837P_DRAFT",
        "sessionId": session_id,
        "patient": patient,
        "subscriber": {"name": patient.get("name"), "relationship": "self", "member_id": patient.get("member_id")},
        "payer": {"name": patient.get("payer")},
        "provider": provider,
        "diagnoses": [
            {
                "pointer": item["pointer"],
                "code": item["code"],
                "description": item["description"],
                "priority": item["priority"],
                "source": item["source"],
            }
            for item in diagnoses
        ],
        "serviceLines": [
            {
                "lineNumber": item["line_number"],
                "dateOfService": None,
                "cptCode": item["cpt_code"],
                "description": item["description"],
                "units": item["units"],
                "duration": item["duration_display"],
                "modifier": item["modifier"],
                "diagnosisPointer": item["diagnosis_pointer"],
                "charge": None,
                "validationStatus": item["validation_status"],
            }
            for item in cpt_lines
        ],
        "validationResults": validation,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


def build_claim_document(session_id: str, language: str = "en") -> dict:
    normalized_language = normalize_language(language)
    known_session = _is_known_session(session_id)
    data.ensure_session(session_id)
    session = data.get_session(session_id)
    if not known_session:
        session = {
            "id": session_id,
            "patientName": REVIEW_TEXT[normalized_language],
            "ageSex": "",
            "mrnNumber": REVIEW_TEXT[normalized_language],
            "payorSource": REVIEW_TEXT[normalized_language],
            "careType": REVIEW_TEXT[normalized_language],
            "sessionTime": REVIEW_TEXT[normalized_language],
            "dateTime": None,
        }
    soap_note = data.get_soap_note(session_id, normalized_language)
    rules, rule_warnings = load_rules()
    display_name, age, gender = _patient_display_name(session)
    provider_name = (
        data.claims_by_session.get(session_id, {}).get("patientMeta", {}).get("provider")
        if known_session
        else REVIEW_TEXT[normalized_language]
    ) or REVIEW_TEXT[normalized_language]

    patient = {
        "name": session.get("patientName") or REVIEW_TEXT[normalized_language],
        "display_name": display_name,
        "mrn": session.get("mrnNumber") or REVIEW_TEXT[normalized_language],
        "patient_id": session.get("patientId") or ("99283" if session_id == "samuel-thompson" else None),
        "age": age,
        "gender": gender,
        "payer": session.get("payorSource") or REVIEW_TEXT[normalized_language],
        "member_id": session.get("memberId"),
    }
    provider = {
        "ordering_provider": provider_name,
        "rendering_provider": provider_name,
    }
    diagnoses = _diagnoses_from_sources(session, soap_note, rules, known_session)
    primary_pointer = diagnoses[0]["pointer"] if diagnoses else ""
    cpt_lines = _cpt_lines_from_sources(session_id, normalized_language, rules, known_session, primary_pointer)
    total_units = sum(int(line.get("units") or 0) for line in cpt_lines)
    duration_seconds = sum(int(line.get("duration_seconds") or 0) for line in cpt_lines) or data.timer_states.get(session_id, {}).get("total_seconds", 0)
    validation = _build_validation(session, provider, cpt_lines, diagnoses, soap_note, rule_warnings)
    claim_status = "ready_for_review" if not validation["missing"] and not validation["warnings"] else "needs_review"
    if data.claim_document_drafts_by_session.get(session_id):
        claim_status = "draft" if claim_status == "ready_for_review" else claim_status

    service_session = {
        "date_of_service": session.get("dateTime"),
        "display_meta": f"{session.get('sessionTime') or REVIEW_TEXT[normalized_language]} • {duration_seconds // 60} min",
        "duration_seconds": duration_seconds,
        "care_type": session.get("careType") or REVIEW_TEXT[normalized_language],
    }

    draft = _draft_837p(session_id, patient, provider, diagnoses, cpt_lines, validation)
    for line in draft["serviceLines"]:
        line["dateOfService"] = service_session["date_of_service"]

    return {
        "session_id": session_id,
        "claim_status": claim_status,
        "patient": patient,
        "provider": provider,
        "session": service_session,
        "summary": {
            "total_units": total_units,
            "billable_units": total_units,
            "total_cpt_lines": len(cpt_lines),
        },
        "cpt_lines": cpt_lines,
        "diagnoses": diagnoses,
        "validation": validation,
        "draft_837p": draft,
    }


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


@session_claim_router.get("/{session_id}/claim-document")
def get_claim_document(session_id: str, language: str = "en") -> dict:
    return build_claim_document(session_id, language)


@session_claim_router.post("/{session_id}/claim-document/verify")
def verify_claim_document(session_id: str, language: str = "en") -> dict:
    claim_document = build_claim_document(session_id, language)
    data.claims_by_session[session_id]["claimStatus"] = (
        "verified" if claim_document["claim_status"] == "ready_for_review" else "draft"
    )
    return claim_document


@session_claim_router.post("/{session_id}/claim-document/draft")
def save_claim_document_draft(session_id: str, payload: dict = Body(default_factory=dict), language: str = "en") -> dict:
    claim_document = build_claim_document(session_id, language)
    data.claim_document_drafts_by_session[session_id] = payload or claim_document
    claim_document["claim_status"] = "draft"
    return {"saved": True, "claim_document": claim_document}


@session_claim_router.get("/{session_id}/claim-document/837p-draft")
def get_claim_document_837p_draft(session_id: str, language: str = "en") -> dict:
    return build_claim_document(session_id, language)["draft_837p"]


@debug_router.get("/claim-document/{session_id}")
def debug_claim_document(session_id: str, language: str = "en") -> dict:
    claim_document = build_claim_document(session_id, language)
    return {
        "session_id": session_id,
        "sources": {
            "soap_note_found": bool(data.get_soap_note(session_id, normalize_language(language))),
            "cpt_records_found": bool(data.cpt_records_by_session.get(session_id)),
            "icd_found": bool(claim_document.get("diagnoses")),
        },
        "claim_document": claim_document,
    }

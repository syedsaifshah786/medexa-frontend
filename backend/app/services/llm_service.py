from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


def _as_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return "; ".join(_as_text(item) for item in value if _as_text(item))
    if isinstance(value, dict):
        return "; ".join(f"{key}: {_as_text(item)}" for key, item in value.items() if _as_text(item))
    return str(value).strip() if value is not None else ""


def _fallback_soap(payload: dict) -> dict:
    print("[Medexa LLM] Falling back to deterministic SOAP generation.")
    transcript = " ".join(str(payload.get("transcript", "")).split())
    cpt_records = payload.get("cpt_records") or []
    detected_cpts = payload.get("detected_cpt_suggestions") or []
    detected_icds = payload.get("detected_icd10_suggestions") or []
    ncci_conflicts = payload.get("ncci_conflicts") or []
    applied_suggestions = payload.get("applied_suggestions") or []
    approved_insights = payload.get("approved_insights") or []
    total_seconds = int(payload.get("total_seconds") or 0)

    cpt_lines = [
        f"{record.get('code')} {record.get('displayName') or record.get('display_name') or ''} "
        f"for {int(record.get('seconds') or 0)} seconds, {int(record.get('units') or 0)} unit(s)"
        for record in cpt_records
        if record.get("code")
    ]
    suggested_cpts = [
        f"{item.get('code')} {item.get('display_name', '')}".strip()
        for item in detected_cpts
        if item.get("code")
    ]
    suggested_icds = [
        f"{item.get('code')} from phrase '{item.get('phrase')}'"
        for item in detected_icds
        if item.get("code")
    ]
    ncci_notes = [
        item.get("explanation", "NCCI warning requires clinician review.")
        for item in ncci_conflicts
    ]

    transcript_excerpt = transcript[:600]
    billing_summary = {
        "total_seconds": total_seconds,
        "cpt_records": cpt_records,
        "suggested_cpt_codes": suggested_cpts,
        "suggested_icd10_codes": suggested_icds,
        "ncci_conflicts": ncci_conflicts,
    }

    return {
        "subjective": transcript_excerpt
        or "No patient-reported speech was captured. Clinician review is required.",
        "objective": " ".join(
            [
                "AI-assisted session draft based on live transcript and clinician actions.",
                f"Applied CPT records: {'; '.join(cpt_lines) or 'None applied'}.",
                f"Approved insights: {_as_text(approved_insights) or 'None'}.",
                f"Applied suggestions: {_as_text(applied_suggestions) or 'None'}.",
            ]
        ),
        "assessment": " ".join(
            [
                "Clinical impression / working assessment only; clinician review required.",
                f"Suggested ICD-10: {', '.join(suggested_icds[:5]) or 'None detected'}.",
                f"Suggested CPT: {', '.join(suggested_cpts[:5]) or 'None detected'}.",
                f"NCCI / billing caveats: {' '.join(ncci_notes[:3]) or 'None detected'}.",
            ]
        ),
        "plan": "Clinician should review transcript-derived SOAP content, CPT/ICD suggestions, documentation support, and billing caveats before signing or billing.",
        "summary": "AI-assisted SOAP draft generated from the live session. AI-assisted suggestions require clinician review.",
        "billing_summary": billing_summary,
    }


def _soap_to_prompt(payload: dict) -> str:
    return (
        "Generate a SOAP note from the supplied JSON only. Do not invent facts. Do not confirm diagnosis. "
        "Label assessment as clinical impression / working assessment. CPT/ICD entries are suggestions requiring clinician review. "
        "Return strict JSON with keys subjective, objective, assessment, plan, summary, billing_summary.\n\n"
        f"SESSION_JSON:\n{json.dumps(payload, ensure_ascii=True)}"
    )


def _extract_json(text: str) -> dict:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("LLM response did not include a JSON object.")
    return json.loads(text[start : end + 1])


def generate_soap_with_llm(payload: dict) -> dict:
    provider = os.getenv("LLM_PROVIDER", "none").lower()
    api_key = os.getenv("OPENAI_API_KEY", "")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if provider != "openai" or not api_key:
        return _fallback_soap(payload)

    request_body = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You generate concise clinical documentation drafts as strict JSON.",
            },
            {"role": "user", "content": _soap_to_prompt(payload)},
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = json.loads(response.read().decode("utf-8"))
        content = raw["choices"][0]["message"]["content"]
        generated = _extract_json(content)
        fallback = _fallback_soap(payload)
        return {
            "subjective": _as_text(generated.get("subjective")) or fallback["subjective"],
            "objective": _as_text(generated.get("objective")) or fallback["objective"],
            "assessment": _as_text(generated.get("assessment")) or fallback["assessment"],
            "plan": _as_text(generated.get("plan")) or fallback["plan"],
            "summary": _as_text(generated.get("summary")) or fallback["summary"],
            "billing_summary": generated.get("billing_summary") or fallback["billing_summary"],
        }
    except (KeyError, ValueError, json.JSONDecodeError, urllib.error.URLError, TimeoutError) as exc:
        print(f"[Medexa LLM] OpenAI SOAP generation failed: {exc}")
        return _fallback_soap(payload)

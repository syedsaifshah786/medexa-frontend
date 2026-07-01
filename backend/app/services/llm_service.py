from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from typing import Any


def get_openai_api_key() -> str:
    key = os.getenv("OPENAI_API_KEY") or ""
    key = key.strip().strip('"').strip("'").strip()
    return key


def get_llm_settings() -> dict:
    raw_key = os.getenv("OPENAI_API_KEY") or ""
    stripped_key = raw_key.strip()
    cleaned_key = get_openai_api_key()
    return {
        "llm_provider": os.getenv("LLM_PROVIDER", "none").strip().lower(),
        "openai_model": os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini",
        "openai_api_key_configured": bool(cleaned_key),
        "openai_api_key_length": len(cleaned_key),
        "openai_api_key_prefix": cleaned_key[:7] if cleaned_key else "",
        "openai_api_key_suffix": cleaned_key[-4:] if cleaned_key else "",
        "has_leading_or_trailing_whitespace": raw_key != stripped_key,
        "has_quotes": (
            len(stripped_key) >= 2
            and (
                (stripped_key.startswith('"') and stripped_key.endswith('"'))
                or (stripped_key.startswith("'") and stripped_key.endswith("'"))
            )
        ),
    }


def test_openai_auth() -> dict:
    api_key = get_openai_api_key()
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    key_debug = {
        "key_prefix": api_key[:7] if api_key else "",
        "key_suffix": api_key[-4:] if api_key else "",
        "key_length": len(api_key),
    }

    if not api_key:
        return {
            "ok": False,
            "status": 0,
            "error": "OPENAI_API_KEY is not configured",
            **key_debug,
        }

    request = urllib.request.Request(
        "https://api.openai.com/v1/models",
        headers={"Authorization": f"Bearer {api_key}"},
        method="GET",
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            response.read()
            return {"ok": True, "status": response.status, "model": model}
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            print("[LLM] OpenAI auth failed. Check Hugging Face OPENAI_API_KEY secret.")
            error = "Unauthorized / invalid api key"
        else:
            error = str(exc.reason) if exc.reason else "OpenAI auth test failed"
        return {"ok": False, "status": exc.code, "error": error, **key_debug}
    except (urllib.error.URLError, TimeoutError) as exc:
        return {"ok": False, "status": 0, "error": str(exc), **key_debug}


def _as_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return "; ".join(_as_text(item) for item in value if _as_text(item))
    if isinstance(value, dict):
        return "; ".join(f"{key}: {_as_text(item)}" for key, item in value.items() if _as_text(item))
    return str(value).strip() if value is not None else ""


def _find_first_phrase(text: str, phrases: list[str]) -> str:
    normalized = text.lower()
    return next((phrase for phrase in phrases if phrase in normalized), "")


def _detect_pain_scale(text: str) -> str:
    normalized = text.lower()
    number_words = {
        "zero": "0",
        "one": "1",
        "two": "2",
        "three": "3",
        "four": "4",
        "five": "5",
        "six": "6",
        "seven": "7",
        "eight": "8",
        "nine": "9",
        "ten": "10",
    }
    import re

    numeric = re.search(r"\b(10|[0-9])\s*(?:/|out of)\s*10\b", normalized)
    if numeric:
        return f"{numeric.group(1)}/10"
    word = re.search(r"pain scale\s+(zero|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s+out of ten)?", normalized)
    if word:
        return f"{number_words[word.group(1)]}/10"
    return "Requires clinician review"


def _detect_duration(text: str) -> str:
    import re

    normalized = text.lower()
    match = re.search(r"\b(?:for\s+)?((?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:day|days|week|weeks|month|months))\b", normalized)
    return match.group(1) if match else "Current session"


def _fallback_soap(payload: dict, reason: str = "", log: bool = True) -> dict:
    if log:
        if reason == "openai_429_rate_or_quota_limit":
            print("[Medexa LLM] OpenAI rate/quota limit hit, using deterministic SOAP fallback")
        else:
            print("[Medexa LLM] Falling back to deterministic SOAP generation.")
    transcript = " ".join(str(payload.get("transcript", "")).split())
    cpt_records = payload.get("cpt_records") or []
    detected_cpts = payload.get("detected_cpt_suggestions") or []
    detected_icds = payload.get("detected_icd10_suggestions") or []
    ncci_conflicts = payload.get("ncci_conflicts") or []
    applied_suggestions = payload.get("applied_suggestions") or []
    approved_insights = payload.get("approved_insights") or []
    total_seconds = int(payload.get("total_seconds") or 0)
    chief_phrase = _find_first_phrase(
        transcript,
        [
            "lower back pain",
            "back pain",
            "knee pain",
            "shoulder pain",
            "difficulty walking",
            "weakness",
            "balance",
        ],
    )
    pain_scale = _detect_pain_scale(transcript)
    duration = _detect_duration(transcript)

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
    insufficient_transcript_message = "Insufficient transcript captured for this session"
    billing_summary = {
        "total_seconds": total_seconds,
        "cpt_records": cpt_records,
        "suggested_cpt_codes": suggested_cpts,
        "suggested_icd10_codes": suggested_icds,
        "ncci_conflicts": ncci_conflicts,
    }
    activity_terms = []
    normalized_transcript = transcript.lower()
    for phrase, label in [
        ("therapeutic exercise", "therapeutic exercise"),
        ("range of motion", "range of motion"),
        ("strengthening", "strengthening"),
        ("gait training", "gait training"),
        ("stair training", "stair training"),
        ("manual therapy", "manual therapy"),
        ("soft tissue mobilization", "soft tissue mobilization"),
        ("joint mobilization", "joint mobilization"),
        ("balance training", "balance training"),
        ("transfer training", "transfer training"),
    ]:
        if phrase in normalized_transcript:
            activity_terms.append(label)
    for record in cpt_records:
        label = record.get("displayName") or record.get("display_name") or record.get("code")
        if label:
            activity_terms.append(str(label))
    activity_summary = ", ".join(dict.fromkeys(activity_terms)) or "therapy activities require clinician review"
    chief_complaint = (
        f"Patient reports {chief_phrase}"
        if chief_phrase
        else transcript[:180] or insufficient_transcript_message
    )

    return {
        "llm_used": False,
        "llm_fallback_reason": reason or "deterministic_fallback",
        "chief_complaint": chief_complaint,
        "pain_scale": pain_scale,
        "duration": duration,
        "subjective": transcript_excerpt or insufficient_transcript_message,
        "objective": " ".join(
            [
                "AI-assisted session draft based on live transcript and clinician actions.",
                f"Objective therapy activities documented: {activity_summary}.",
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
        "diagnosis_summary": "Working clinical impression only; suggested diagnoses require clinician review.",
        "observation_notes": f"Therapy activities observed or documented from transcript: {activity_summary}.",
        "range_of_motion": "Range of motion referenced in transcript." if "range of motion" in normalized_transcript else "Requires clinician review",
        "affect": "Requires clinician review",
        "vital_signs": "Requires clinician review",
        "summary": "AI-assisted SOAP draft generated from the live session. AI-assisted suggestions require clinician review.",
        "billing_summary": billing_summary,
    }


def generate_fallback_soap(payload: dict, reason: str = "deterministic_fallback") -> dict:
    return _fallback_soap(payload, reason)


def _soap_to_prompt(payload: dict) -> str:
    return (
        "Generate a concise SOAP note from the supplied JSON only. Do not invent facts or confirm diagnosis. "
        "Return compact strict JSON with keys subjective, objective, assessment, plan, summary, billing_summary, "
        "chief_complaint, pain_scale, duration, diagnosis_summary, observation_notes, range_of_motion, affect, vital_signs. "
        "Keep each text field brief; CPT/ICD entries are suggestions requiring clinician review.\n\n"
        f"SESSION_JSON:\n{json.dumps(payload, ensure_ascii=True)}"
    )


def _extract_json(text: str) -> dict:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("LLM response did not include a JSON object.")
    return json.loads(text[start : end + 1])


def generate_soap_with_llm(payload: dict) -> dict:
    provider = os.getenv("LLM_PROVIDER", "none").strip().lower()
    api_key = get_openai_api_key()
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"

    print("[LLM] provider:", provider)
    print("[LLM] model:", model)
    print("[LLM] key configured:", bool(api_key))
    print("[LLM] key length:", len(api_key))
    print("[LLM] key prefix:", api_key[:7] if api_key else "")
    print("[LLM] key suffix:", api_key[-4:] if api_key else "")

    if provider != "openai" or not api_key:
        return _fallback_soap(payload, "openai_not_configured")

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
        "max_tokens": 900,
        "response_format": {"type": "json_object"},
    }

    def _openai_request() -> urllib.request.Request:
        return urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=json.dumps(request_body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

    try:
        print(f"[Medexa LLM] Generating SOAP with OpenAI model: {model}")
        raw = None
        for attempt, delay in enumerate([0, 2, 5], start=1):
            if delay:
                time.sleep(delay)
            try:
                with urllib.request.urlopen(_openai_request(), timeout=20) as response:
                    raw = json.loads(response.read().decode("utf-8"))
                break
            except urllib.error.HTTPError as exc:
                if exc.code != 429:
                    raise
                print("[LLM] OpenAI rate limit or quota exceeded. Check OpenAI billing, usage, credits, project limits, or rate limits.")
                if attempt == 3:
                    raise

        if raw is None:
            raise ValueError("OpenAI response was empty.")
        content = raw["choices"][0]["message"]["content"]
        generated = _extract_json(content)
        fallback = _fallback_soap(payload, "openai_response_missing_fields", log=False)
        return {
            "llm_used": True,
            "llm_fallback_reason": "",
            "subjective": _as_text(generated.get("subjective")) or fallback["subjective"],
            "objective": _as_text(generated.get("objective")) or fallback["objective"],
            "assessment": _as_text(generated.get("assessment")) or fallback["assessment"],
            "plan": _as_text(generated.get("plan")) or fallback["plan"],
            "chief_complaint": _as_text(generated.get("chief_complaint")) or fallback["chief_complaint"],
            "pain_scale": _as_text(generated.get("pain_scale")) or fallback["pain_scale"],
            "duration": _as_text(generated.get("duration")) or fallback["duration"],
            "diagnosis_summary": _as_text(generated.get("diagnosis_summary")) or fallback["diagnosis_summary"],
            "observation_notes": _as_text(generated.get("observation_notes")) or fallback["observation_notes"],
            "range_of_motion": _as_text(generated.get("range_of_motion")) or fallback["range_of_motion"],
            "affect": _as_text(generated.get("affect")) or fallback["affect"],
            "vital_signs": _as_text(generated.get("vital_signs")) or fallback["vital_signs"],
            "summary": _as_text(generated.get("summary")) or fallback["summary"],
            "billing_summary": generated.get("billing_summary") or fallback["billing_summary"],
        }
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            print("[LLM] OpenAI auth failed. Check Hugging Face OPENAI_API_KEY secret.")
        if exc.code == 429:
            print("[LLM] OpenAI rate limit or quota exceeded. Check OpenAI billing, usage, credits, project limits, or rate limits.")
            print(f"[Medexa LLM] OpenAI SOAP generation failed: {exc}")
            return _fallback_soap(payload, "openai_429_rate_or_quota_limit")
        print(f"[Medexa LLM] OpenAI SOAP generation failed: {exc}")
        return _fallback_soap(payload, f"openai_http_{exc.code}")
    except (KeyError, ValueError, json.JSONDecodeError, urllib.error.URLError, TimeoutError) as exc:
        print(f"[Medexa LLM] OpenAI SOAP generation failed: {exc}")
        return _fallback_soap(payload, "openai_generation_failed")

from __future__ import annotations

import json
import re
from functools import lru_cache
from itertools import combinations
from pathlib import Path
from typing import Any

DISCLAIMER = "AI-generated suggestions require clinician review before use."

RULE_FILE_NAMES = {
    "icd10_phrase_map": "icd10_phrase_map.json",
    "body_region_map": "body_region_map.json",
    "cpt_phrase_map": "cpt_phrase_map.json",
    "cpt_rules": "cpt_rules.json",
    "ncci_conflicts": "ncci_conflicts.json",
    "billing_category_map": "billing_category_map.json",
}

APP_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = APP_DIR.parent
RULE_DIRS = [
    BACKEND_DIR / "data" / "rules",
    APP_DIR.parents[1] / "backend" / "data" / "rules",
    BACKEND_DIR / "data" / "rules" / "backend" / "data" / "rules",
]

LOCAL_CPT_FALLBACK_PHRASES = {
    "therapeutic exercise": "97110",
    "ther ex": "97110",
    "range of motion": "97110",
    "rom": "97110",
    "strengthening": "97110",
    "gait training": "97116",
    "walking practice": "97116",
    "stair training": "97116",
    "manual therapy": "97140",
    "joint mobilization": "97140",
    "soft tissue mobilization": "97140",
    "neuromuscular reeducation": "97112",
    "balance training": "97112",
    "therapeutic activity": "97530",
    "functional activity": "97530",
    "transfer training": "97530",
    "self care": "97535",
    "adl training": "97535",
}


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _display_label(value: str) -> str:
    return value.replace("_", " ").replace("/", " / ").title()


def _confidence_for_phrase(phrase: str) -> str:
    word_count = len(phrase.split())
    if word_count <= 1:
        return "low"
    if word_count >= 3 or len(phrase) >= 14:
        return "high"
    return "medium"


def _load_json_file(file_name: str) -> tuple[Any, str | None]:
    for rule_dir in RULE_DIRS:
        path = rule_dir / file_name
        if not path.exists():
            continue

        try:
            with path.open("r", encoding="utf-8") as rule_file:
                return json.load(rule_file), None
        except (OSError, json.JSONDecodeError) as exc:
            return {}, f"Could not load {file_name}: {exc}"

    return {}, f"Missing rule file: {file_name}"


@lru_cache(maxsize=1)
def load_rules() -> tuple[dict[str, Any], list[str]]:
    rules: dict[str, Any] = {}
    warnings: list[str] = []

    for key, file_name in RULE_FILE_NAMES.items():
        data, warning = _load_json_file(file_name)
        rules[key] = data
        if warning:
            warnings.append(warning)

    return rules, warnings


def _public_phrase_items(phrase_map: dict[str, Any]) -> list[tuple[str, Any]]:
    return [
        (phrase, value)
        for phrase, value in phrase_map.items()
        if not phrase.startswith("_") and isinstance(phrase, str) and phrase.strip()
    ]


def find_phrase_matches(text: str, phrase_map: dict) -> list[dict]:
    normalized = normalize_text(text)
    matches: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for phrase, value in sorted(_public_phrase_items(phrase_map), key=lambda item: len(item[0]), reverse=True):
        normalized_phrase = normalize_text(phrase)
        if not normalized_phrase or normalized_phrase not in normalized:
            continue

        value_key = json.dumps(value, sort_keys=True) if isinstance(value, (dict, list)) else str(value)
        key = (normalized_phrase, value_key)
        if key in seen:
            continue

        seen.add(key)
        matches.append(
            {
                "phrase": phrase,
                "value": value,
                "confidence": _confidence_for_phrase(normalized_phrase),
            }
        )

    return matches


def detect_body_regions(text: str) -> list[dict]:
    rules, _warnings = load_rules()
    matches = find_phrase_matches(text, rules.get("body_region_map", {}))
    regions: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for match in matches:
        region = str(match["value"])
        key = (match["phrase"], region)
        if key in seen:
            continue

        seen.add(key)
        regions.append({"phrase": match["phrase"], "region": region})

    return regions


def suggest_icd10_codes(text: str) -> list[dict]:
    rules, _warnings = load_rules()
    matches = find_phrase_matches(text, rules.get("icd10_phrase_map", {}))
    suggestions: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for match in matches:
        code = str(match["value"])
        key = (match["phrase"], code)
        if key in seen:
            continue

        seen.add(key)
        suggestions.append(
            {
                "phrase": match["phrase"],
                "code": code,
                "reason": f"Matched transcript phrase: {match['phrase']}",
                "confidence": match["confidence"],
            }
        )

    return suggestions


def _category_matches_by_code(text: str) -> dict[str, set[str]]:
    rules, _warnings = load_rules()
    category_matches = find_phrase_matches(text, rules.get("billing_category_map", {}))
    cpt_rules = rules.get("cpt_rules", {})
    labels_to_codes = {
        details.get("label"): code
        for code, details in cpt_rules.items()
        if isinstance(details, dict) and details.get("label")
    }
    matched: dict[str, set[str]] = {}

    for match in category_matches:
        category = str(match["value"])
        code = labels_to_codes.get(category)
        if code:
            matched.setdefault(code, set()).add(match["phrase"])

    return matched


def suggest_cpt_codes(text: str) -> list[dict]:
    rules, _warnings = load_rules()
    matches = find_phrase_matches(text, rules.get("cpt_phrase_map", {}))
    matched_phrases_by_code = _category_matches_by_code(text)
    normalized = normalize_text(text)

    for match in matches:
        code = str(match["value"])
        matched_phrases_by_code.setdefault(code, set()).add(match["phrase"])

    for phrase, code in LOCAL_CPT_FALLBACK_PHRASES.items():
        if phrase in normalized:
            matched_phrases_by_code.setdefault(code, set()).add(phrase)

    return enrich_cpt_suggestions(
        [
            {
                "code": code,
                "matched_phrases": sorted(phrases, key=len, reverse=True),
            }
            for code, phrases in matched_phrases_by_code.items()
        ]
    )


def enrich_cpt_suggestions(cpt_codes: list) -> list[dict]:
    rules, _warnings = load_rules()
    cpt_rules = rules.get("cpt_rules", {})
    enriched: list[dict] = []
    seen_codes: set[str] = set()

    for suggestion in cpt_codes:
        code = str(suggestion.get("code", ""))
        if not code or code in seen_codes:
            continue

        seen_codes.add(code)
        details = cpt_rules.get(code, {}) if isinstance(cpt_rules, dict) else {}
        label = str(details.get("label") or suggestion.get("label") or "")
        display_name = str(details.get("display_name") or _display_label(label or code))
        matched_phrases = list(dict.fromkeys(suggestion.get("matched_phrases", [])))
        phrase_list = ", ".join(matched_phrases[:4]) or "clinical activity"

        enriched.append(
            {
                "code": code,
                "label": label,
                "display_name": display_name,
                "descriptor": details.get("descriptor", ""),
                "matched_phrases": matched_phrases,
                "documentation_requirements": details.get("documentation_requirements", []),
                "billing_caveats": details.get("billing_caveats", {}),
                "reason": f"Transcript mentions {phrase_list}, which maps to {display_name}.",
                "confidence": details.get("confidence") or ("high" if len(matched_phrases) > 1 else "medium"),
            }
        )

    return enriched


def _region_family(region: str) -> str:
    parts = region.split("_")
    if len(parts) >= 2 and parts[-1] in {"right", "left"}:
        return "_".join(parts[:-1])
    return region


def detect_ncci_conflicts(cpt_codes: list, body_regions: list) -> list[dict]:
    rules, _warnings = load_rules()
    conflict_rules = [
        item
        for item in rules.get("ncci_conflicts", [])
        if isinstance(item, dict) and item.get("cpt_a") and item.get("cpt_b")
    ]
    codes = [str(item.get("code", item)) for item in cpt_codes]
    code_pairs = {frozenset(pair) for pair in combinations(dict.fromkeys(codes), 2)}
    region_families = {_region_family(str(region.get("region", ""))) for region in body_regions if region.get("region")}
    clearly_different_regions = len(region_families) > 1
    warnings: list[dict] = []

    for rule in conflict_rules:
        pair = frozenset([str(rule["cpt_a"]), str(rule["cpt_b"])])
        if pair not in code_pairs:
            continue

        body_region_sensitive = bool(rule.get("body_region_sensitive"))
        severity = "info" if body_region_sensitive and clearly_different_regions else "warning"
        warnings.append(
            {
                "cpt_a": str(rule["cpt_a"]),
                "cpt_b": str(rule["cpt_b"]),
                "conflict_type": rule.get("conflict_type", "mutually_exclusive"),
                "body_region_sensitive": body_region_sensitive,
                "modifier_59_possible": bool(rule.get("modifier_59_possible")),
                "explanation": rule.get("explanation", "NCCI conflict requires clinician billing review."),
                "severity": severity,
            }
        )

    return warnings


def _symptoms_from_text(text: str, icd_suggestions: list[dict]) -> list[str]:
    normalized = normalize_text(text)
    symptoms: list[str] = []
    symptom_phrases = [
        ("back pain", "Back pain"),
        ("lower back pain", "Lower back pain"),
        ("difficulty walking", "Difficulty walking"),
        ("pain scale", "Pain severity reported"),
        ("range of motion", "Limited range of motion"),
        ("sleep", "Sleep disturbance"),
        ("weakness", "Weakness"),
        ("numbness", "Numbness"),
        ("dizziness", "Dizziness"),
        ("knee pain", "Knee pain"),
        ("shoulder pain", "Shoulder pain"),
    ]

    for phrase, label in symptom_phrases:
        if phrase in normalized:
            symptoms.append(label)

    for suggestion in icd_suggestions[:4]:
        symptoms.append(str(suggestion["phrase"]).title())

    unique_symptoms: list[str] = []
    seen: set[str] = set()
    for symptom in symptoms:
        key = normalize_text(symptom)
        if key in seen:
            continue
        seen.add(key)
        unique_symptoms.append(symptom)

    return unique_symptoms


def _soap_update(
    symptoms: list[str],
    impressions: list[str],
    cpt_suggestions: list[dict],
    body_regions: list[dict],
) -> dict:
    subjective = (
        f"Patient reported {', '.join(symptoms).lower()} during this segment."
        if symptoms
        else "No additional patient-reported symptom details detected in this segment."
    )
    objective_terms = list(dict.fromkeys(region["region"].replace("_", " ") for region in body_regions[:3]))
    objective = (
        f"Detected therapy or movement references involving {', '.join(objective_terms)}."
        if objective_terms
        else "No new objective movement or body-region findings detected from speech alone."
    )
    assessment = (
        f"Possible clinical impressions for clinician review: {'; '.join(impressions[:4])}."
        if impressions
        else "No possible clinical impression was suggested by this segment."
    )
    plan = (
        "Clinician should review generated ICD/CPT suggestions, NCCI warnings, documentation support, and follow-up needs before use."
        if cpt_suggestions
        else "Clinician should review the transcript segment before adding generated suggestions to the note."
    )

    return {
        "subjective": subjective,
        "objective": objective,
        "assessment": assessment,
        "plan": plan,
    }


def analyze_transcript_chunk(chunk_text: str, start_time: str, end_time: str) -> dict:
    rules, rule_warnings = load_rules()
    clean_text = " ".join(chunk_text.split())
    icd10_suggestions = suggest_icd10_codes(clean_text)
    body_regions = detect_body_regions(clean_text)
    cpt_suggestions = suggest_cpt_codes(clean_text)
    ncci_conflicts = detect_ncci_conflicts(cpt_suggestions, body_regions)
    symptoms = _symptoms_from_text(clean_text, icd10_suggestions)
    impressions = [
        f"{suggestion['phrase'].title()} ({suggestion['code']})"
        for suggestion in icd10_suggestions[:5]
    ]
    billing_hints = [
        f"Review {suggestion['code']} {suggestion['display_name']} documentation requirements."
        for suggestion in cpt_suggestions[:4]
    ]

    if rule_warnings:
        billing_hints.extend(rule_warnings)

    summary = (
        f"Segment {start_time}-{end_time} reviewed: {clean_text[:220]}{'...' if len(clean_text) > 220 else ''}"
        if clean_text
        else "No clinically meaningful speech was captured in this segment."
    )
    confidence = (
        "high"
        if len(icd10_suggestions) + len(cpt_suggestions) + len(body_regions) >= 4
        else "medium"
        if clean_text
        else "low"
    )
    cpt_timer_suggestion = {
        "should_start": False,
        "code": None,
        "display_name": None,
        "reason": "",
        "confidence": "low",
    }

    if cpt_suggestions:
        first_cpt = cpt_suggestions[0]
        cpt_timer_suggestion = {
            "should_start": True,
            "code": first_cpt["code"],
            "display_name": first_cpt["display_name"],
            "reason": first_cpt["reason"],
            "confidence": first_cpt["confidence"],
        }

    live_suggestions: list[dict] = []
    for suggestion in cpt_suggestions[:3]:
        live_suggestions.append(
            {
                "id": f"cpt-{suggestion['code']}",
                "type": "billing",
                "title": f"Suggested CPT {suggestion['code']}",
                "description": f"{suggestion['display_name']} detected. {suggestion['reason']} Requires clinician review.",
                "action_label": "Apply",
                "status": "pending",
            }
        )

    for suggestion in icd10_suggestions[:2]:
        live_suggestions.append(
            {
                "id": f"icd-{suggestion['code']}-{normalize_text(suggestion['phrase']).replace(' ', '-')[:24]}",
                "type": "detected",
                "title": f"AI-assisted ICD suggestion {suggestion['code']}",
                "description": f"Phrase '{suggestion['phrase']}' may support {suggestion['code']}. Requires clinician review.",
                "action_label": "Apply",
                "status": "pending",
            }
        )

    for conflict in ncci_conflicts[:3]:
        live_suggestions.append(
            {
                "id": f"ncci-{conflict['cpt_a']}-{conflict['cpt_b']}",
                "type": "alert",
                "title": "Modifier 59 Required",
                "description": conflict["explanation"],
                "action_label": "Apply",
                "status": "pending",
            }
        )

    if symptoms:
        live_suggestions.append(
            {
                "id": f"protocol-review-{normalize_text(symptoms[0]).replace(' ', '-')[:24]}",
                "type": "protocol",
                "title": "Protocol Ask",
                "description": f"Clarify functional impact for {symptoms[0].lower()} before closing the note.",
                "action_label": "Apply",
                "status": "pending",
            }
        )

    return {
        "summary": summary,
        "possible_clinical_impressions": impressions or ["No specific possible clinical impression detected from this segment"],
        "possible_diagnoses": impressions or ["No specific possible clinical impression detected from this segment"],
        "icd10_suggestions": icd10_suggestions,
        "body_regions": body_regions,
        "cpt_suggestions": cpt_suggestions,
        "ncci_conflicts": ncci_conflicts,
        "symptoms": symptoms or ["No clear symptom keywords detected"],
        "soap_update": _soap_update(symptoms, impressions, cpt_suggestions, body_regions),
        "billing_hints": billing_hints or ["No specific CPT or billing relevance detected in this segment"],
        "confidence": confidence,
        "disclaimer": DISCLAIMER,
        "cpt_timer_suggestion": cpt_timer_suggestion,
        "live_suggestions": live_suggestions,
        "rule_warnings": rule_warnings,
        "rules_loaded": any(bool(rules.get(key)) for key in RULE_FILE_NAMES),
    }

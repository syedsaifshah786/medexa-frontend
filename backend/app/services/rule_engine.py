from __future__ import annotations

import json
import re
from functools import lru_cache
from itertools import combinations
from pathlib import Path
from typing import Any

from app.services.localization import (
    apply_label,
    clinician_review,
    is_arabic,
    modifier59_description,
    modifier59_title,
    translate_cpt_display_name,
)

DISCLAIMER = "AI-assisted suggestions require clinician review."

RULE_FILE_NAMES = {
    "medexa_cpt_lookup": "medexa_cpt_lookup.json",
    "medexa_icd10_lookup": "medexa_icd10_lookup.json",
    "cpt_billing_rules": "cpt_billing_rules.json",
    "cpt_icd10_rules": "cpt_icd10_rules.json",
    "cpt_mue_rules": "cpt_mue_rules.json",
    "cpt_ptp_rules": "cpt_ptp_rules.json",
    "cpt_addon_rules": "cpt_addon_rules.json",
    "icd10_phrase_map": "icd10_phrase_map.json",
    "body_region_map": "body_region_map.json",
    "cpt_phrase_map": "cpt_phrase_map.json",
    "cpt_rules": "cpt_rules.json",
    "ncci_conflicts": "ncci_conflicts.json",
    "billing_category_map": "billing_category_map.json",
}

BACKEND_ROOT = Path(__file__).resolve().parents[2]
RULES_DIR = BACKEND_ROOT / "data" / "rules"
OPTIONAL_RULE_FILES = {"cpt_icd10_rules.json"}

print("[RuleEngine] RULES_DIR:", RULES_DIR)

LOCAL_CPT_FALLBACK_PHRASES = {
    "therapeutic exercise": "97110",
    "ther ex": "97110",
    "therex": "97110",
    "range of motion": "97110",
    "rom": "97110",
    "strengthening": "97110",
    "stretching": "97110",
    "gait training": "97116",
    "gate training": "97116",
    "walking practice": "97116",
    "stair training": "97116",
    "ambulation": "97116",
    "treadmill walking": "97116",
    "manual therapy": "97140",
    "joint mobilization": "97140",
    "soft tissue mobilization": "97140",
    "myofascial release": "97140",
    "manual traction": "97140",
    "neuromuscular reeducation": "97112",
    "balance training": "97112",
    "proprioception": "97112",
    "postural training": "97112",
    "therapeutic activity": "97530",
    "functional activity": "97530",
    "transfer training": "97530",
    "sit to stand": "97530",
    "self care": "97535",
    "adl training": "97535",
    "activities of daily living": "97535",
}

APPROVED_CPT_PHRASES = {
    "97110": [
        "therapeutic exercise",
        "therapeutic exercises",
        "ther ex",
        "therex",
        "range of motion",
        "range motion",
        "rom",
        "strengthening",
        "strength training",
        "stretching",
    ],
    "97112": [
        "neuromuscular reeducation",
        "neuromuscular re-education",
        "neuro reeducation",
        "neuro re-education",
        "neuromuscular rehab",
        "balance training",
        "balance exercise",
        "proprioception",
        "postural training",
    ],
    "97116": [
        "gait training",
        "gate training",
        "walking training",
        "walking practice",
        "stair training",
        "stairs training",
        "ambulation",
        "treadmill walking",
    ],
    "97140": [
        "manual therapy",
        "manual techniques",
        "joint mobilization",
        "soft tissue mobilization",
        "soft tissue work",
        "myofascial release",
        "manual traction",
    ],
    "97530": [
        "therapeutic activity",
        "therapeutic activities",
        "functional activity",
        "functional activities",
        "transfer training",
        "sit to stand",
        "bed mobility",
        "functional mobility",
    ],
    "97535": [
        "self care",
        "self-care",
        "adl training",
        "activities of daily living",
        "dressing training",
        "grooming training",
        "bathing training",
    ],
}

GENERIC_CPT_PHRASES = {"therapy", "therapeutic", "exercise", "treatment", "activity"}

BODY_REGION_DISPLAY_NAMES = {
    "spine_lumbar": "lower back",
    "spine_cervical": "neck",
    "spine_thoracic": "upper back",
    "shoulder_right": "shoulder",
    "shoulder_left": "shoulder",
    "elbow_right": "elbow",
    "elbow_left": "elbow",
    "wrist_right": "wrist",
    "wrist_left": "wrist",
    "hand_right": "hand",
    "hand_left": "hand",
    "hip_right": "hip",
    "hip_left": "hip",
    "knee_right": "knee",
    "knee_left": "knee",
    "ankle_right": "ankle",
    "ankle_left": "ankle",
    "foot_right": "foot",
    "foot_left": "foot",
}

LOCAL_BODY_REGION_FALLBACK_PHRASES = {
    "lower back": "lower back",
    "low back": "lower back",
    "lumbar": "lower back",
    "lumbar spine": "lower back",
    "back pain": "lower back",
    "knee": "knee",
    "left knee": "knee",
    "right knee": "knee",
    "shoulder": "shoulder",
    "hip": "hip",
    "ankle": "ankle",
    "lower extremity": "lower extremity",
    "leg": "lower extremity",
    "gait": "lower extremity",
    "walking": "lower extremity",
    "stair": "lower extremity",
}


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _display_label(value: str) -> str:
    return value.replace("_", " ").replace("/", " / ").title()


def _display_body_region(region: str, phrase: str = "") -> str:
    normalized_region = normalize_text(region).replace(" ", "_")
    normalized_phrase = normalize_text(phrase)
    if normalized_phrase in LOCAL_BODY_REGION_FALLBACK_PHRASES:
        return LOCAL_BODY_REGION_FALLBACK_PHRASES[normalized_phrase]
    if region in BODY_REGION_DISPLAY_NAMES:
        return BODY_REGION_DISPLAY_NAMES[region]
    if normalized_region in BODY_REGION_DISPLAY_NAMES:
        return BODY_REGION_DISPLAY_NAMES[normalized_region]
    return region.replace("_", " ").strip() or phrase.strip() or "unspecified"


def _confidence_for_phrase(phrase: str) -> str:
    word_count = len(phrase.split())
    if word_count <= 1:
        return "low"
    if word_count >= 3 or len(phrase) >= 14:
        return "high"
    return "medium"


def _load_json_file(file_name: str) -> tuple[Any, str | None]:
    path = RULES_DIR / file_name
    if not path.exists():
        rule_type = "optional rule file" if file_name in OPTIONAL_RULE_FILES else "rule file"
        warning = f"Missing {rule_type}: {path}"
        print("[RuleEngine]", warning)
        return {}, warning

    try:
        with path.open("r", encoding="utf-8") as rule_file:
            return json.load(rule_file), None
    except (OSError, json.JSONDecodeError) as exc:
        warning = f"Could not load {path}: {exc}"
        print("[RuleEngine]", warning)
        return {}, warning


@lru_cache(maxsize=1)
def load_rules() -> tuple[dict[str, Any], list[str]]:
    rules: dict[str, Any] = {}
    warnings: list[str] = []

    for key, file_name in RULE_FILE_NAMES.items():
        data, warning = _load_json_file(file_name)
        rules[key] = data
        print(f"[RuleEngine] {file_name} loaded:", len(data) if hasattr(data, "__len__") else 0)
        if warning:
            warnings.append(warning)

    print("[RuleEngine] CPT phrase map loaded:", len(rules.get("cpt_phrase_map", {})))
    print("[RuleEngine] CPT rules loaded:", len(rules.get("cpt_rules", {})))
    print("[RuleEngine] Medexa CPT lookup loaded:", len(rules.get("medexa_cpt_lookup", {})))
    print("[RuleEngine] Medexa ICD10 lookup loaded:", len(rules.get("medexa_icd10_lookup", {})))
    print("[RuleEngine] body region map loaded:", len(rules.get("body_region_map", {})))
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


def _normalize_cpt_phrase_text(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", text.lower())).strip()


def _split_normalized_sentences(text: str) -> list[str]:
    return [
        _normalize_cpt_phrase_text(sentence)
        for sentence in re.split(r"[.!?\n;]+", text or "")
        if _normalize_cpt_phrase_text(sentence)
    ]


def _phrase_matches_exact(normalized_text: str, phrase: str) -> bool:
    normalized_phrase = _normalize_cpt_phrase_text(phrase)
    if not normalized_phrase or normalized_phrase in GENERIC_CPT_PHRASES:
        return False
    return re.search(rf"(^|\s){re.escape(normalized_phrase)}(\s|$)", normalized_text) is not None


def _first_phrase_position(normalized_text: str, phrase: str) -> int:
    normalized_phrase = _normalize_cpt_phrase_text(phrase)
    match = re.search(rf"(^|\s){re.escape(normalized_phrase)}(\s|$)", normalized_text)
    return match.start() if match else 10**9


def _iter_lookup_records(lookup: Any) -> list[dict]:
    if isinstance(lookup, dict):
        return [item for item in lookup.values() if isinstance(item, dict) and item.get("code")]
    if isinstance(lookup, list):
        return [item for item in lookup if isinstance(item, dict) and item.get("code")]
    return []


def _index_rule_list(rule_items: Any, code_field: str = "cpt_code") -> dict[str, dict]:
    if isinstance(rule_items, dict):
        return {
            str(key): value
            for key, value in rule_items.items()
            if isinstance(value, dict)
        }
    if isinstance(rule_items, list):
        return {
            str(item.get(code_field)): item
            for item in rule_items
            if isinstance(item, dict) and item.get(code_field)
        }
    return {}


def _billing_rule_for_code(code: str) -> dict:
    rules, _warnings = load_rules()
    return _index_rule_list(rules.get("cpt_billing_rules", {})).get(str(code), {})


def _icd10_rule_for_code(code: str) -> dict:
    rules, _warnings = load_rules()
    return _index_rule_list(rules.get("cpt_icd10_rules", {})).get(str(code), {})


def _mue_rule_for_code(code: str) -> dict:
    rules, _warnings = load_rules()
    return _index_rule_list(rules.get("cpt_mue_rules", {})).get(str(code), {})


def _addon_rule_for_code(code: str) -> dict:
    rules, _warnings = load_rules()
    return _index_rule_list(rules.get("cpt_addon_rules", {})).get(str(code), {})


def _valid_icd10_codes_for_cpt(code: str) -> set[str]:
    rule = _icd10_rule_for_code(code)
    valid_codes = rule.get("valid_icd10_codes", [])
    return {
        str(item.get("code") if isinstance(item, dict) else item)
        for item in valid_codes
        if item
    }


def iter_cpt_phrases(phrase_map: Any) -> list[tuple[str, str]]:
    phrases: list[tuple[str, str]] = []

    if isinstance(phrase_map, dict):
        for key, value in phrase_map.items():
            if str(key).startswith("_"):
                continue
            if isinstance(value, str):
                if re.fullmatch(r"\d{5}", str(key)):
                    phrases.append((value, str(key)))
                else:
                    phrases.append((str(key), value))
            elif isinstance(value, list):
                code = str(key)
                for phrase in value:
                    if isinstance(phrase, str):
                        phrases.append((phrase, code))
                    elif isinstance(phrase, dict) and phrase.get("phrase"):
                        phrases.append((str(phrase["phrase"]), str(phrase.get("code") or code)))
    elif isinstance(phrase_map, list):
        for item in phrase_map:
            if isinstance(item, dict) and item.get("phrase") and item.get("code"):
                phrases.append((str(item["phrase"]), str(item["code"])))

    approved = {
        _normalize_cpt_phrase_text(phrase): code
        for code, phrase_list in APPROVED_CPT_PHRASES.items()
        for phrase in phrase_list
    }
    safe_phrases = [
        (phrase, code)
        for phrase, code in phrases
        if approved.get(_normalize_cpt_phrase_text(phrase)) == str(code)
        and _normalize_cpt_phrase_text(phrase) not in GENERIC_CPT_PHRASES
    ]
    safe_keys = {(_normalize_cpt_phrase_text(phrase), code) for phrase, code in safe_phrases}

    for code, phrase_list in APPROVED_CPT_PHRASES.items():
        for phrase in phrase_list:
            key = (_normalize_cpt_phrase_text(phrase), code)
            if key not in safe_keys:
                safe_phrases.append((phrase, code))
                safe_keys.add(key)

    return sorted(safe_phrases, key=lambda item: len(_normalize_cpt_phrase_text(item[0])), reverse=True)


def detect_body_regions(text: str) -> list[dict]:
    rules, _warnings = load_rules()
    matches = find_phrase_matches(text, rules.get("body_region_map", {}))
    regions: list[dict] = []
    seen: set[str] = set()

    for match in matches:
        region_code = str(match["value"])
        region = _display_body_region(region_code, str(match["phrase"]))
        key = normalize_text(region)
        if key in seen:
            continue

        seen.add(key)
        regions.append({"phrase": match["phrase"], "region": region, "region_code": region_code})

    normalized = normalize_text(text)
    for phrase, region in sorted(LOCAL_BODY_REGION_FALLBACK_PHRASES.items(), key=lambda item: len(item[0]), reverse=True):
        if phrase not in normalized:
            continue
        key = normalize_text(region)
        if key in seen:
            continue
        seen.add(key)
        regions.append({"phrase": phrase, "region": region, "region_code": key.replace(" ", "_")})

    return regions


def suggest_icd10_codes(text: str) -> list[dict]:
    rules, _warnings = load_rules()
    suggestions: list[dict] = []
    seen: set[tuple[str, str]] = set()
    normalized = _normalize_cpt_phrase_text(text)
    sentences = _split_normalized_sentences(text)

    for record in _iter_lookup_records(rules.get("medexa_icd10_lookup", {})):
        code = str(record.get("code") or "")
        trigger_phrases = [str(phrase) for phrase in record.get("trigger_phrases", []) if str(phrase).strip()]
        required_context = [str(phrase) for phrase in record.get("required_context", []) if str(phrase).strip()]
        exclude_if_present = [str(phrase) for phrase in record.get("exclude_if_present", []) if str(phrase).strip()]

        if not code or not trigger_phrases:
            continue

        for phrase in trigger_phrases:
            if not _phrase_matches_exact(normalized, phrase):
                continue

            matched_sentence = next((sentence for sentence in sentences if _phrase_matches_exact(sentence, phrase)), normalized)
            if any(_phrase_matches_exact(matched_sentence, excluded) for excluded in exclude_if_present):
                continue

            context_matched = [
                context
                for context in required_context
                if _phrase_matches_exact(matched_sentence, context) or _phrase_matches_exact(normalized, context)
            ]
            if required_context and not context_matched:
                continue

            key = (phrase, code)
            if key in seen:
                continue

            seen.add(key)
            suggestions.append(
                {
                    "phrase": phrase,
                    "code": code,
                    "label": record.get("label", ""),
                    "reason": f"Matched Medexa ICD-10 lookup phrase: {phrase}",
                    "confidence": "high" if context_matched or len(phrase.split()) >= 3 else "medium",
                    "source": "medexa_icd10_lookup",
                    "required_context_matched": context_matched,
                    "notes": record.get("notes", ""),
                }
            )
            break

    if suggestions:
        return suggestions

    matches = find_phrase_matches(text, rules.get("icd10_phrase_map", {}))
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
                "source": "icd10_phrase_map",
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
    lookup = rules.get("medexa_cpt_lookup", {})
    matched_phrases_by_code: dict[str, set[str]] = {}
    normalized = _normalize_cpt_phrase_text(text)
    sentences = _split_normalized_sentences(text)
    first_position_by_code: dict[str, int] = {}
    lookup_suggestions: list[dict] = []
    seen_lookup_codes: set[str] = set()

    print("[CPT Detect] transcript:", text)
    for record in _iter_lookup_records(lookup):
        code = str(record.get("code") or "")
        trigger_phrases = [str(phrase) for phrase in record.get("trigger_phrases", []) if str(phrase).strip()]
        required_context = [str(phrase) for phrase in record.get("required_context", []) if str(phrase).strip()]
        exclude_if_present = [str(phrase) for phrase in record.get("exclude_if_present", []) if str(phrase).strip()]

        if not code or not trigger_phrases:
            continue

        matched_phrases: list[str] = []
        required_context_matched: list[str] = []
        first_position = 10**9

        for phrase in trigger_phrases:
            if not _phrase_matches_exact(normalized, phrase):
                continue

            matched_sentence = next((sentence for sentence in sentences if _phrase_matches_exact(sentence, phrase)), normalized)
            if any(_phrase_matches_exact(matched_sentence, excluded) for excluded in exclude_if_present):
                continue

            context_matches = [
                context
                for context in required_context
                if _phrase_matches_exact(matched_sentence, context) or _phrase_matches_exact(normalized, context)
            ]
            if required_context and not context_matches:
                continue

            matched_phrases.append(phrase)
            required_context_matched.extend(context_matches)
            first_position = min(first_position, _first_phrase_position(normalized, phrase))

        if not matched_phrases or code in seen_lookup_codes:
            continue

        seen_lookup_codes.add(code)
        lookup_suggestions.append(
            {
                "code": code,
                "label": record.get("label", ""),
                "display_name": record.get("label") or code,
                "matched_phrases": list(dict.fromkeys(matched_phrases)),
                "matched_phrase": matched_phrases[0],
                "required_context_matched": list(dict.fromkeys(required_context_matched)),
                "ncci_conflicts": record.get("ncci_conflicts", []),
                "notes": record.get("notes", ""),
                "disciplines": record.get("disciplines", []),
                "source": "medexa_cpt_lookup",
                "confidence": "high" if required_context_matched or len(matched_phrases) > 1 else "medium",
                "_position": first_position,
            }
        )
        print("[CPT Detect] medexa lookup matched:", matched_phrases, "code:", code)

    if lookup_suggestions:
        return enrich_cpt_suggestions(sorted(lookup_suggestions, key=lambda suggestion: suggestion.get("_position", 10**9)))

    for phrase, code in iter_cpt_phrases(rules.get("cpt_phrase_map", {})):
        if _phrase_matches_exact(normalized, phrase):
            matched_phrases_by_code.setdefault(code, set()).add(phrase)
            phrase_position = normalized.find(_normalize_cpt_phrase_text(phrase))
            first_position_by_code[code] = min(first_position_by_code.get(code, phrase_position), phrase_position)
            print("[CPT Detect] matched phrase:", phrase, "code:", code)

    suggestions = enrich_cpt_suggestions(
        [
            {
                "code": code,
                "matched_phrases": sorted(phrases, key=len, reverse=True),
            }
            for code, phrases in matched_phrases_by_code.items()
        ]
    )
    final_suggestions = sorted(suggestions, key=lambda suggestion: first_position_by_code.get(suggestion["code"], 10**9))
    print("[CPT Detect] final suggestions:", final_suggestions)
    return final_suggestions


def _matched_body_region(text: str) -> dict | None:
    regions = detect_body_regions(text)
    if not regions:
        return None

    region = regions[0]
    return {
        "phrase": str(region.get("phrase", "")),
        "region": str(region.get("region_code") or region.get("region", "")),
        "display": str(region.get("region") or region.get("phrase") or "unspecified").replace("_", " "),
    }


def _billing_category_for_code(text: str, code: str) -> str | None:
    rules, _warnings = load_rules()
    category_matches = find_phrase_matches(text, rules.get("billing_category_map", {}))
    cpt_rules = rules.get("cpt_rules", {})
    label = ""
    if isinstance(cpt_rules, dict) and isinstance(cpt_rules.get(code), dict):
        label = str(cpt_rules[code].get("label") or "")

    for match in category_matches:
        category = str(match.get("value") or "")
        if category and category == label:
            return category

    return label or None


def _record_value(record: Any, key: str, default: Any = None) -> Any:
    if isinstance(record, dict):
        return record.get(key, default)
    return getattr(record, key, default)


def _ncci_conflict_for_codes(code_a: str, code_b: str) -> dict | None:
    rules, _warnings = load_rules()
    code_a = str(code_a)
    code_b = str(code_b)
    ptp_rules = _index_rule_list(rules.get("cpt_ptp_rules", {}))
    for source_code, rule in ptp_rules.items():
        ptp = rule.get("ptp", {}) if isinstance(rule, dict) else {}
        for item in ptp.get("bundled_into", []) if isinstance(ptp, dict) else []:
            primary_code = str(item.get("primary_code", "")).split(".")[0]
            if {source_code, primary_code} == {code_a, code_b}:
                return {
                    "cpt_a": source_code,
                    "cpt_b": primary_code,
                    "conflict_type": "ptp_bundled_into",
                    "body_region_sensitive": False,
                    "modifier_59_possible": str(item.get("modifier_indicator")) == "1",
                    "modifier_indicator": item.get("modifier_indicator"),
                    "explanation": f"PTP rule: {source_code} is bundled into {primary_code}. Clinician review is required before using Modifier 59.",
                    "source": "cpt_ptp_rules",
                }
        for item in ptp.get("bundles_others", []) if isinstance(ptp, dict) else []:
            bundled_code = str(item.get("bundled_code", "")).split(".")[0]
            if {source_code, bundled_code} == {code_a, code_b}:
                return {
                    "cpt_a": source_code,
                    "cpt_b": bundled_code,
                    "conflict_type": "ptp_bundles_other",
                    "body_region_sensitive": False,
                    "modifier_59_possible": str(item.get("modifier_indicator")) == "1",
                    "modifier_indicator": item.get("modifier_indicator"),
                    "explanation": f"PTP rule: {bundled_code} is bundled with {source_code}. Clinician review is required before using Modifier 59.",
                    "source": "cpt_ptp_rules",
                }

    pair = frozenset([str(code_a), str(code_b)])
    for rule in rules.get("ncci_conflicts", []):
        if not isinstance(rule, dict) or not rule.get("cpt_a") or not rule.get("cpt_b"):
            continue
        if frozenset([str(rule["cpt_a"]), str(rule["cpt_b"])]) == pair:
            return rule
    return None


def _normalize_modifier_region(region: Any) -> str:
    normalized = normalize_text(str(region or "")).replace("_", " ")
    if not normalized or normalized == "unspecified":
        return ""
    return _display_body_region(normalized, normalized)


def detect_modifier59_suggestions(cpt_records: list, new_cpt_suggestions: list, language: str = "en") -> list[dict]:
    by_region: dict[str, list[dict]] = {}
    cpt_items: list[dict] = []

    for record in cpt_records or []:
        code = str(_record_value(record, "code", "") or "")
        if not code:
            continue
        record_region = (
            _record_value(record, "bodyRegion")
            or _record_value(record, "body_region")
            or _record_value(record, "bodyRegionCode")
            or _record_value(record, "body_region_code")
        )
        cpt_items.append({"code": code, "body_region": record_region})

    cpt_items.extend(new_cpt_suggestions or [])
    for item in cpt_items:
        code = str(item.get("code") or "")
        region = _normalize_modifier_region(item.get("body_region") or item.get("bodyRegion"))
        region_key = normalize_text(region)
        if not code or not region_key:
            continue
        by_region.setdefault(region_key, []).append({**item, "body_region": region})

    suggestions: list[dict] = []
    print("[Modifier59] cpt records:", cpt_records)
    print("[Modifier59] new cpt suggestions:", new_cpt_suggestions)
    print("[Modifier59] grouped by region:", by_region)

    for region_key, region_items in by_region.items():
        unique_by_code = {str(item["code"]): item for item in region_items if item.get("code")}
        if len(unique_by_code) < 2:
            continue

        codes = sorted(unique_by_code)
        body_region = str(next(iter(unique_by_code.values())).get("body_region") or region_key)
        ncci_rule = None
        for code_a, code_b in combinations(codes, 2):
            ncci_rule = _ncci_conflict_for_codes(code_a, code_b)
            if ncci_rule:
                break
        description = (
            f"Potential NCCI conflict detected for multiple CPT services in the same body region: {body_region}. "
            "Review whether Modifier 59 is required for distinct procedural services."
            if ncci_rule
            else (
                f"Multiple CPT services detected for the same body region: {body_region}. "
                "Review whether Modifier 59 is required for distinct procedural services."
            )
        )
        if is_arabic(language):
            description = modifier59_description(codes, body_region, language)
        suggestions.append(
            {
                "id": f"modifier-59-{'-'.join(codes)}-{normalize_text(body_region).replace(' ', '-')}",
                "type": "modifier",
                "title": modifier59_title(language),
                "description": description,
                "codes": codes,
                "body_region": body_region,
                "modifier": "59",
                "status": "pending",
                "requires_clinician_review": True,
            }
        )

    print("[Modifier59] suggestions:", suggestions)
    return suggestions


def analyze_transcript_for_cpt(text: str, existing_cpt_records: list = [], full_transcript: str = "", language: str = "en") -> dict:
    clean_text = normalize_text(text or "")
    body_region = _matched_body_region(clean_text) or _matched_body_region(full_transcript or "")
    body_region_display = body_region["display"] if body_region else None
    body_region_code = body_region["region"] if body_region else None
    cpt_suggestions = suggest_cpt_codes(clean_text)
    if not cpt_suggestions and full_transcript:
        cpt_suggestions = suggest_cpt_codes(full_transcript)
    cpt_timer_suggestions: list[dict] = []

    for suggestion in cpt_suggestions:
        matched_phrase = next(iter(suggestion.get("matched_phrases", [])), "")
        billing_category = _billing_category_for_code(clean_text, suggestion["code"])
        cpt_timer_suggestions.append(
            {
                "should_start": True,
                "code": suggestion["code"],
                "display_name": translate_cpt_display_name(suggestion["code"], suggestion["display_name"], language),
                "matched_phrase": matched_phrase,
                "matched_phrases": suggestion.get("matched_phrases", []),
                "required_context_matched": suggestion.get("required_context_matched", []),
                "body_region": body_region_display or "unspecified",
                "body_region_code": body_region_code,
                "billing_category": billing_category,
                "ncci_conflicts": suggestion.get("ncci_conflicts", []),
                "notes": suggestion.get("notes", ""),
                "source": suggestion.get("source", "cpt_phrase_map"),
                "description": suggestion.get("description", ""),
                "isEightMinuteRule": suggestion.get("isEightMinuteRule", False),
                "mue": suggestion.get("mue", {}),
                "addon_rule": suggestion.get("addon_rule", {}),
                "reason": (
                    f"Transcript mentions {matched_phrase or suggestion['display_name']} for {body_region_display}."
                    if body_region_display
                    else suggestion["reason"]
                ),
                "confidence": suggestion["confidence"],
            }
        )

    modifier59_suggestions = detect_modifier59_suggestions(existing_cpt_records or [], cpt_timer_suggestions, language)

    return {
        "cpt_timer_suggestions": cpt_timer_suggestions,
        "cpt_timer_suggestion": cpt_timer_suggestions[0] if cpt_timer_suggestions else None,
        "modifier59_suggestions": modifier59_suggestions,
        "body_regions": detect_body_regions(clean_text),
        "disclaimer": DISCLAIMER,
    }


def enrich_cpt_suggestions(cpt_codes: list) -> list[dict]:
    rules, _warnings = load_rules()
    cpt_rules = rules.get("cpt_rules", {})
    medexa_lookup = rules.get("medexa_cpt_lookup", {})
    enriched: list[dict] = []
    seen_codes: set[str] = set()

    for suggestion in cpt_codes:
        code = str(suggestion.get("code", ""))
        if not code or code in seen_codes:
            continue

        seen_codes.add(code)
        details = cpt_rules.get(code, {}) if isinstance(cpt_rules, dict) else {}
        lookup_details = medexa_lookup.get(code, {}) if isinstance(medexa_lookup, dict) else {}
        billing_details = _billing_rule_for_code(code)
        mue_details = _mue_rule_for_code(code).get("mue", {})
        addon_details = _addon_rule_for_code(code)
        label = str(details.get("label") or suggestion.get("label") or "")
        display_name = str(
            suggestion.get("display_name")
            or details.get("display_name")
            or lookup_details.get("label")
            or billing_details.get("description")
            or _display_label(label or code)
        )
        matched_phrases = list(dict.fromkeys(suggestion.get("matched_phrases", [])))
        phrase_list = ", ".join(matched_phrases[:4]) or "clinical activity"

        enriched.append(
            {
                "code": code,
                "label": label,
                "display_name": display_name,
                "descriptor": details.get("descriptor", "") or billing_details.get("description", ""),
                "matched_phrases": matched_phrases,
                "matched_phrase": suggestion.get("matched_phrase") or (matched_phrases[0] if matched_phrases else ""),
                "documentation_requirements": details.get("documentation_requirements", []),
                "billing_caveats": details.get("billing_caveats", {}),
                "reason": suggestion.get("reason") or f"Transcript mentions {phrase_list}, which maps to {display_name}.",
                "confidence": suggestion.get("confidence") or details.get("confidence") or ("high" if len(matched_phrases) > 1 else "medium"),
                "required_context_matched": suggestion.get("required_context_matched", []),
                "body_region": suggestion.get("body_region"),
                "ncci_conflicts": suggestion.get("ncci_conflicts", lookup_details.get("ncci_conflicts", [])),
                "notes": suggestion.get("notes", lookup_details.get("notes", "")),
                "disciplines": suggestion.get("disciplines", lookup_details.get("disciplines", [])),
                "source": suggestion.get("source", "cpt_phrase_map"),
                "description": billing_details.get("description", ""),
                "isEightMinuteRule": bool(billing_details.get("isEightMinuteRule", False)),
                "mue": mue_details,
                "addon_rule": addon_details,
            }
        )

    return enriched


def _region_family(region: str) -> str:
    parts = region.split("_")
    if len(parts) >= 2 and parts[-1] in {"right", "left"}:
        return "_".join(parts[:-1])
    return region


def detect_ncci_conflicts(cpt_codes: list, body_regions: list) -> list[dict]:
    codes = [str(item.get("code", item)) for item in cpt_codes]
    code_pairs = {frozenset(pair) for pair in combinations(dict.fromkeys(codes), 2)}
    region_families = {_region_family(str(region.get("region", ""))) for region in body_regions if region.get("region")}
    clearly_different_regions = len(region_families) > 1
    warnings: list[dict] = []

    for pair in code_pairs:
        pair_codes = list(pair)
        if len(pair_codes) != 2:
            continue
        rule = _ncci_conflict_for_codes(pair_codes[0], pair_codes[1])
        if not rule:
            continue
        pair = frozenset([str(rule["cpt_a"]), str(rule["cpt_b"])])

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
                "source": rule.get("source", "ncci_conflicts"),
            }
        )

    return warnings


def build_rule_live_suggestions(cpt_suggestions: list[dict], icd10_suggestions: list[dict], cpt_records: list, language: str = "en") -> list[dict]:
    detected_codes = [str(suggestion.get("code")) for suggestion in cpt_suggestions if suggestion.get("code")]
    existing_codes = [str(_record_value(record, "code", "") or "") for record in cpt_records or []]
    all_codes = list(dict.fromkeys([*existing_codes, *detected_codes]))
    detected_icds = {str(suggestion.get("code")) for suggestion in icd10_suggestions if suggestion.get("code")}
    suggestions: list[dict] = []

    for suggestion in cpt_suggestions:
        code = str(suggestion.get("code") or "")
        if not code:
            continue

        valid_icds = _valid_icd10_codes_for_cpt(code)
        if valid_icds and detected_icds and detected_icds.isdisjoint(valid_icds):
            suggestions.append(
                {
                    "id": f"cpt-icd10-{code}",
                    "type": "alert",
                    "title": "CPT / ICD-10 compatibility review",
                    "description": f"CPT {code} was detected, but the detected ICD-10 suggestions do not appear in its configured valid diagnosis list.",
                    "action_label": apply_label(language),
                    "status": "pending",
                    "codes": [code],
                    "requires_clinician_review": True,
                    "source": "cpt_icd10_rules",
                }
            )

        mue = suggestion.get("mue") or _mue_rule_for_code(code).get("mue", {})
        limit = int(mue.get("limit") or 0) if isinstance(mue, dict) else 0
        record_units = [
            int(_record_value(record, "units", 0) or 0)
            for record in cpt_records or []
            if str(_record_value(record, "code", "") or "") == code
        ]
        if limit and record_units and max(record_units) > limit:
            suggestions.append(
                {
                    "id": f"mue-{code}",
                    "type": "alert",
                    "title": f"MUE warning for CPT {code}",
                    "description": f"CPT {code} units exceed configured MUE limit {limit}. Review billing units before claim submission.",
                    "action_label": apply_label(language),
                    "status": "pending",
                    "codes": [code],
                    "requires_clinician_review": True,
                    "source": "cpt_mue_rules",
                }
            )

        addon_rule = suggestion.get("addon_rule") or _addon_rule_for_code(code)
        if addon_rule.get("isAddonCode"):
            parent_code = str(addon_rule.get("parentCode") or "")
            if parent_code and parent_code not in all_codes:
                suggestions.append(
                    {
                        "id": f"addon-parent-{code}",
                        "type": "alert",
                        "title": f"Add-on CPT parent required for {code}",
                        "description": f"CPT {code} is configured as an add-on code and requires parent CPT {parent_code}.",
                        "action_label": apply_label(language),
                        "status": "pending",
                        "codes": [code, parent_code],
                        "requires_clinician_review": True,
                        "source": "cpt_addon_rules",
                    }
                )

    for code_a, code_b in combinations(all_codes, 2):
        rule = _ncci_conflict_for_codes(code_a, code_b)
        if not rule:
            continue
        suggestions.append(
            {
                "id": f"ptp-{code_a}-{code_b}",
                "type": "alert",
                "title": modifier59_title(language),
                "description": rule.get("explanation", "PTP/NCCI conflict requires clinician review before billing."),
                "action_label": apply_label(language),
                "status": "pending",
                "codes": [code_a, code_b],
                "modifier": "59" if rule.get("modifier_59_possible") else None,
                "requires_clinician_review": True,
                "source": rule.get("source", "cpt_ptp_rules"),
            }
        )

    unique: dict[str, dict] = {}
    for suggestion in suggestions:
        unique[suggestion["id"]] = suggestion
    return list(unique.values())


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


def analyze_transcript_chunk(
    chunk_text: str,
    start_time: str,
    end_time: str,
    existing_cpt_records: list | None = None,
    full_transcript: str = "",
    language: str = "en",
) -> dict:
    rules, rule_warnings = load_rules()
    clean_text = " ".join(chunk_text.split())
    icd10_suggestions = suggest_icd10_codes(clean_text)
    body_regions = detect_body_regions(clean_text)
    cpt_suggestions = suggest_cpt_codes(clean_text)
    if not cpt_suggestions and full_transcript:
        cpt_suggestions = suggest_cpt_codes(full_transcript)
    cpt_detection = analyze_transcript_for_cpt(clean_text, existing_cpt_records or [], full_transcript, language)
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
    cpt_timer_suggestions = cpt_detection["cpt_timer_suggestions"]
    cpt_timer_suggestion = cpt_detection["cpt_timer_suggestion"] or {
        "should_start": False,
        "code": None,
        "display_name": None,
        "reason": "",
        "confidence": "low",
    }

    live_suggestions: list[dict] = []
    for suggestion in cpt_suggestions[:3]:
        live_suggestions.append(
            {
                "id": f"cpt-{suggestion['code']}",
                "type": "billing",
                "title": f"{'CPT مقترح' if is_arabic(language) else 'Suggested CPT'} {suggestion['code']}",
                "description": (
                    f"تم اكتشاف {translate_cpt_display_name(suggestion['code'], suggestion['display_name'], language)}. {clinician_review(language)}."
                    if is_arabic(language)
                    else f"{suggestion['display_name']} detected. {suggestion['reason']} Requires clinician review."
                ),
                "action_label": apply_label(language),
                "status": "pending",
            }
        )

    for suggestion in icd10_suggestions[:2]:
        live_suggestions.append(
            {
                "id": f"icd-{suggestion['code']}-{normalize_text(suggestion['phrase']).replace(' ', '-')[:24]}",
                "type": "detected",
                "title": f"{'اقتراح ICD بمساعدة الذكاء الاصطناعي' if is_arabic(language) else 'AI-assisted ICD suggestion'} {suggestion['code']}",
                "description": (
                    f"قد تدعم العبارة '{suggestion['phrase']}' الرمز {suggestion['code']}. {clinician_review(language)}."
                    if is_arabic(language)
                    else f"Phrase '{suggestion['phrase']}' may support {suggestion['code']}. Requires clinician review."
                ),
                "action_label": apply_label(language),
                "status": "pending",
            }
        )

    for conflict in ncci_conflicts[:3]:
        live_suggestions.append(
            {
                "id": f"ncci-{conflict['cpt_a']}-{conflict['cpt_b']}",
                "type": "alert",
                "title": modifier59_title(language),
                "description": conflict["explanation"],
                "action_label": apply_label(language),
                "status": "pending",
            }
        )

    for suggestion in cpt_detection.get("modifier59_suggestions", []):
        live_suggestions.append(
            {
                "id": suggestion["id"],
                "type": "modifier",
                "title": suggestion["title"],
                "description": suggestion["description"],
                "action_label": apply_label(language),
                "status": "pending",
                "codes": suggestion["codes"],
                "body_region": suggestion["body_region"],
                "modifier": suggestion["modifier"],
                "requires_clinician_review": True,
            }
        )

    live_suggestions.extend(build_rule_live_suggestions(cpt_suggestions, icd10_suggestions, existing_cpt_records or [], language))

    if symptoms:
        live_suggestions.append(
            {
                "id": f"protocol-review-{normalize_text(symptoms[0]).replace(' ', '-')[:24]}",
                "type": "protocol",
                "title": "سؤال البروتوكول" if is_arabic(language) else "Protocol Ask",
                "description": (
                    f"وضّح الأثر الوظيفي لـ {symptoms[0]} قبل إغلاق الملاحظة."
                    if is_arabic(language)
                    else f"Clarify functional impact for {symptoms[0].lower()} before closing the note."
                ),
                "action_label": apply_label(language),
                "status": "pending",
            }
        )

    if is_arabic(language):
        summary = (
            f"تمت مراجعة المقطع {start_time}-{end_time}: {clean_text[:220]}{'...' if len(clean_text) > 220 else ''}"
            if clean_text
            else "لم يتم التقاط كلام سريري مفيد في هذا المقطع."
        )
        billing_hints = [
            f"راجع متطلبات توثيق {suggestion['code']} {translate_cpt_display_name(suggestion['code'], suggestion.get('display_name'), language)}."
            for suggestion in cpt_suggestions[:4]
        ] or ["لم يتم اكتشاف صلة محددة بـ CPT أو الفوترة في هذا المقطع"]
        symptoms = symptoms or ["لم يتم اكتشاف كلمات أعراض واضحة"]
        impressions = impressions or ["لم يتم اكتشاف انطباع سريري محدد من هذا المقطع"]
        for suggestion in cpt_suggestions:
            suggestion["display_name"] = translate_cpt_display_name(suggestion.get("code"), suggestion.get("display_name"), language)
            suggestion["reason"] = f"تم ربط التفريغ بالرمز {suggestion.get('code')}. {clinician_review(language)}."

    return {
        "summary": summary,
        "possible_clinical_impressions": impressions or ["No specific possible clinical impression detected from this segment"],
        "possible_diagnoses": impressions or ["No specific possible clinical impression detected from this segment"],
        "icd10_suggestions": icd10_suggestions,
        "body_regions": body_regions,
        "cpt_suggestions": cpt_suggestions,
        "ncci_conflicts": ncci_conflicts,
        "symptoms": symptoms or ["No clear symptom keywords detected"],
        "soap_update": (
            {
                "subjective": "تمت مراجعة تفاصيل المريض المبلغ عنها في هذا المقطع.",
                "objective": "تمت مراجعة مراجع الحركة أو العلاج المكتشفة من الكلام.",
                "assessment": "انطباعات سريرية محتملة لمراجعة الطبيب.",
                "plan": "ينبغي للطبيب مراجعة اقتراحات ICD/CPT وتحذيرات NCCI قبل الاستخدام.",
            }
            if is_arabic(language)
            else _soap_update(symptoms, impressions, cpt_suggestions, body_regions)
        ),
        "billing_hints": billing_hints or ["No specific CPT or billing relevance detected in this segment"],
        "confidence": confidence,
        "disclaimer": "الاقتراحات المدعومة بالذكاء الاصطناعي تتطلب مراجعة الطبيب." if is_arabic(language) else DISCLAIMER,
        "cpt_timer_suggestion": cpt_timer_suggestion,
        "cpt_timer_suggestions": cpt_timer_suggestions,
        "modifier59_suggestions": cpt_detection.get("modifier59_suggestions", []),
        "live_suggestions": live_suggestions,
        "rule_warnings": rule_warnings,
        "rules_loaded": any(bool(rules.get(key)) for key in RULE_FILE_NAMES),
    }


def enrich_billing_payload(payload: dict) -> dict:
    next_payload = {
        **payload,
        "cptCodes": [item.copy() for item in payload.get("cptCodes", [])],
    }

    for item in next_payload["cptCodes"]:
        code = str(item.get("code") or "")
        if not code:
            continue

        billing_rule = _billing_rule_for_code(code)
        mue = _mue_rule_for_code(code).get("mue", {})
        addon_rule = _addon_rule_for_code(code)
        warnings = []
        units = int(item.get("units") or 0)
        mue_limit = int(mue.get("limit") or 0) if isinstance(mue, dict) else 0

        if billing_rule:
            item.setdefault("description", billing_rule.get("description", item.get("title", "")))
            item["isEightMinuteRule"] = bool(billing_rule.get("isEightMinuteRule", False))

        if mue:
            item["mue"] = mue
        if mue_limit and units > mue_limit:
            warnings.append(f"Units exceed MUE limit {mue_limit}.")

        if addon_rule:
            item["addonRule"] = addon_rule
            parent_code = str(addon_rule.get("parentCode") or "")
            existing_codes = {str(cpt.get("code") or "") for cpt in next_payload["cptCodes"]}
            if addon_rule.get("isAddonCode") and parent_code and parent_code not in existing_codes:
                warnings.append(f"Add-on code requires parent CPT {parent_code}.")

        if warnings:
            item["ruleWarnings"] = warnings
            item["warning"] = item.get("warning") or warnings[0]

    return next_payload

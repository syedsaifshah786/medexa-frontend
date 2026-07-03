from fastapi import APIRouter, Query

from app.services.rule_engine import RULE_FILE_NAMES, RULES_DIR, analyze_transcript_chunk, load_rules

router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/rules-health")
def rules_health() -> dict:
    files: dict[str, dict] = {}

    for file_name in RULE_FILE_NAMES.values():
        path = RULES_DIR / file_name
        count = 0
        if path.exists():
            try:
                import json

                with path.open("r", encoding="utf-8") as rule_file:
                    data = json.load(rule_file)
                count = len(data) if hasattr(data, "__len__") else 0
            except (OSError, json.JSONDecodeError) as exc:
                files[file_name] = {"exists": True, "count": 0, "error": str(exc)}
                continue

        files[file_name] = {
            "exists": path.exists(),
            "count": count,
        }

    sample = analyze_transcript_chunk(
        "Patient is doing therapeutic exercise, range of motion and strengthening. Now gait training and manual therapy.",
        "00:00",
        "00:10",
    )

    return {
        "rules_dir": str(RULES_DIR),
        "files": files,
        "sample_cpt_detection": [
            {
                "code": suggestion["code"],
                "matched_phrase": (suggestion.get("matched_phrases") or [""])[0],
            }
            for suggestion in sample.get("cpt_suggestions", [])
        ],
    }


@router.get("/cpt-lookup-health")
def cpt_lookup_health() -> dict:
    rules, warnings = load_rules()
    sample = analyze_transcript_chunk(
        "we did manual therapy and soft tissue mobilization. we are working on neuromuscular reeducation and balance training.",
        "00:00",
        "00:05",
    )

    def count(key: str) -> int:
        value = rules.get(key, {})
        return len(value) if hasattr(value, "__len__") else 0

    def exists(key: str) -> bool:
        return (RULES_DIR / RULE_FILE_NAMES[key]).exists()

    return {
        "medexa_cpt_lookup_exists": exists("medexa_cpt_lookup"),
        "medexa_cpt_lookup_count": count("medexa_cpt_lookup"),
        "medexa_icd10_lookup_exists": exists("medexa_icd10_lookup"),
        "medexa_icd10_lookup_count": count("medexa_icd10_lookup"),
        "cpt_billing_rules_exists": exists("cpt_billing_rules"),
        "cpt_billing_rules_count": count("cpt_billing_rules"),
        "cpt_icd10_rules_exists": exists("cpt_icd10_rules"),
        "cpt_icd10_rules_count": count("cpt_icd10_rules"),
        "cpt_mue_rules_exists": exists("cpt_mue_rules"),
        "cpt_mue_rules_count": count("cpt_mue_rules"),
        "cpt_ptp_rules_exists": exists("cpt_ptp_rules"),
        "cpt_ptp_rules_count": count("cpt_ptp_rules"),
        "cpt_addon_rules_exists": exists("cpt_addon_rules"),
        "cpt_addon_rules_count": count("cpt_addon_rules"),
        "warnings": warnings,
        "sample_detection": sample.get("cpt_timer_suggestions", []),
    }


@router.get("/cpt-detect")
def debug_cpt_detect(text: str = Query(..., min_length=1), language: str = "en") -> dict:
    analysis = analyze_transcript_chunk(
        text,
        "00:00",
        "00:05",
        full_transcript=text,
        language=language,
    )

    return {
        "text": text,
        "cpt_timer_suggestions": analysis.get("cpt_timer_suggestions", []),
        "cpt_suggestions": analysis.get("cpt_suggestions", []),
        "live_suggestions": analysis.get("live_suggestions", []),
    }

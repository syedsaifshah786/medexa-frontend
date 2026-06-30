from fastapi import APIRouter

from app.services.rule_engine import RULE_FILE_NAMES, RULES_DIR, analyze_transcript_chunk

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

from fastapi import APIRouter

from app import data
from app.schemas import TranscriptChunkAnalysisRequest
from app.services.localization import apply_label, modifier59_title
from app.services.rule_engine import analyze_transcript_chunk, detect_ncci_conflicts

router = APIRouter(prefix="/sessions", tags=["session-transcript-analysis"])


@router.post("/{session_id}/analyze-transcript-chunk")
def analyze_session_transcript_chunk(session_id: str, payload: TranscriptChunkAnalysisRequest) -> dict:
    data.ensure_session(session_id)
    print("[Analyze] chunk_text:", payload.chunk_text)
    print("[Analyze] full_transcript length:", len(payload.full_transcript or ""))
    analysis = analyze_transcript_chunk(
        payload.chunk_text,
        payload.start_time,
        payload.end_time,
        payload.cpt_records,
        payload.full_transcript,
        payload.language,
    )
    print("[Analyze] CPT suggestions:", analysis.get("cpt_timer_suggestions", []))
    print("[Analyze] Modifier 59 suggestions:", analysis.get("modifier59_suggestions", []))
    detected_codes = [item.get("code") for item in analysis.get("cpt_suggestions", []) if item.get("code")]
    all_codes = [
        {"code": code}
        for code in dict.fromkeys([*payload.existing_cpt_codes, payload.active_cpt_code, *detected_codes])
        if code
    ]
    if len(all_codes) > 1:
        analysis["ncci_conflicts"] = detect_ncci_conflicts(all_codes, analysis.get("body_regions", []))
        existing_live_ids = {item.get("id") for item in analysis.get("live_suggestions", [])}
        for conflict in analysis["ncci_conflicts"]:
            suggestion_id = f"ncci-{conflict['cpt_a']}-{conflict['cpt_b']}"
            if suggestion_id in existing_live_ids:
                continue
            analysis.setdefault("live_suggestions", []).append(
                {
                    "id": suggestion_id,
                    "type": "alert",
                    "title": modifier59_title(payload.language),
                    "description": conflict["explanation"],
                    "action_label": apply_label(payload.language),
                    "status": "pending",
                }
            )
    if analysis.get("live_suggestions"):
        existing_by_id = {item["id"]: item for item in data.suggestions_by_session[session_id]}
        for suggestion in analysis["live_suggestions"]:
            existing_by_id[suggestion["id"]] = {
                "id": suggestion["id"],
                "title": suggestion["title"],
                "text": suggestion["description"],
                "applied": existing_by_id.get(suggestion["id"], {}).get("applied", False),
            }
        data.suggestions_by_session[session_id] = list(existing_by_id.values())
    return analysis

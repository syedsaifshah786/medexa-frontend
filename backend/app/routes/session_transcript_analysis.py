from fastapi import APIRouter

from app import data
from app.schemas import TranscriptChunkAnalysisRequest
from app.services.rule_engine import analyze_transcript_chunk

router = APIRouter(prefix="/sessions", tags=["session-transcript-analysis"])


@router.post("/{session_id}/analyze-transcript-chunk")
def analyze_session_transcript_chunk(session_id: str, payload: TranscriptChunkAnalysisRequest) -> dict:
    data.ensure_session(session_id)
    analysis = analyze_transcript_chunk(payload.chunk_text, payload.start_time, payload.end_time)
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

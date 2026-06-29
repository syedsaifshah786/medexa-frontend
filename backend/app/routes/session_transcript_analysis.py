from fastapi import APIRouter

from app import data
from app.schemas import TranscriptChunkAnalysisRequest
from app.services.rule_engine import analyze_transcript_chunk

router = APIRouter(prefix="/sessions", tags=["session-transcript-analysis"])


@router.post("/{session_id}/analyze-transcript-chunk")
def analyze_session_transcript_chunk(session_id: str, payload: TranscriptChunkAnalysisRequest) -> dict:
    data.ensure_session(session_id)
    return analyze_transcript_chunk(payload.chunk_text, payload.start_time, payload.end_time)

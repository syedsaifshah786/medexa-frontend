from fastapi import APIRouter

from app import data
from app.routes.transcripts import analyze_text
from app.schemas import TranscriptChunkAnalysisRequest

router = APIRouter(prefix="/sessions", tags=["session-transcript-analysis"])


@router.post("/{session_id}/analyze-transcript-chunk")
def analyze_session_transcript_chunk(session_id: str, payload: TranscriptChunkAnalysisRequest) -> dict:
    data.ensure_session(session_id)
    return analyze_text(payload.chunk_text)

from fastapi import APIRouter, HTTPException

from app import data

router = APIRouter(prefix="/transcripts", tags=["transcripts"])


@router.get("")
def list_transcripts() -> list[dict]:
    return data.transcripts


@router.get("/{transcript_id}")
def transcript_detail(transcript_id: str) -> dict:
    for transcript in data.transcripts:
        if transcript["id"] == transcript_id:
            return transcript
    raise HTTPException(status_code=404, detail="Transcript not found")


@router.post("/{transcript_id}/generate-summary")
def generate_summary(transcript_id: str) -> dict:
    for transcript in data.transcripts:
        if transcript["id"] == transcript_id:
            transcript["status"] = "SUMMARIZED"
            transcript["summary"] = f"{transcript['patientName']}'s session summary was generated from the transcript and is ready for review."
            return transcript
    raise HTTPException(status_code=404, detail="Transcript not found")

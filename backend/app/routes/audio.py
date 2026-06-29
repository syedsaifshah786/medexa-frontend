from __future__ import annotations

import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from app import data
from app.services.audio_transcription import transcribe_audio_file
from app.services.rule_engine import analyze_transcript_chunk

router = APIRouter(prefix="/sessions", tags=["audio"])

ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".webm", ".mp4", ".ogg"}
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "tmp" / "audio_uploads"


@router.post("/{session_id}/transcribe-audio")
def transcribe_session_audio(session_id: str, file: UploadFile = File(...)) -> dict:
    data.ensure_session(session_id)
    original_name = file.filename or ""
    extension = Path(original_name).suffix.lower()

    if extension not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported audio format.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    upload_path = UPLOAD_DIR / f"{uuid4().hex}{extension}"

    try:
        with upload_path.open("wb") as destination:
            shutil.copyfileobj(file.file, destination)

        transcription = transcribe_audio_file(str(upload_path))
        if transcription.get("error"):
            raise HTTPException(status_code=500, detail=transcription["error"])

        transcript = str(transcription.get("transcript", "")).strip()
        if not transcript:
            raise HTTPException(status_code=422, detail="No speech transcript was detected in this audio file.")

        audio_segments = transcription.get("segments", [])
        start_time = "00:00"
        end_seconds = 0
        if audio_segments:
            end_seconds = int(max(float(segment.get("end", 0)) for segment in audio_segments))
        end_time = f"{end_seconds // 60:02d}:{end_seconds % 60:02d}"
        analysis = analyze_transcript_chunk(transcript, start_time, end_time)

        return {
            "transcript": transcript,
            "audio_segments": audio_segments,
            **analysis,
        }
    finally:
        file.file.close()
        try:
            upload_path.unlink(missing_ok=True)
        except OSError:
            pass

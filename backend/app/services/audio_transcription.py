from __future__ import annotations

from functools import lru_cache
from typing import Any


@lru_cache(maxsize=1)
def _load_model():
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise RuntimeError(
            "faster-whisper is not installed. Install backend requirements before transcribing audio."
        ) from exc

    return WhisperModel("tiny.en", device="cpu", compute_type="int8")


def transcribe_audio_file(file_path: str) -> dict[str, Any]:
    try:
        model = _load_model()
        segments, info = model.transcribe(file_path, language="en")
        audio_segments = [
            {
                "start": float(segment.start),
                "end": float(segment.end),
                "text": segment.text.strip(),
            }
            for segment in segments
            if segment.text.strip()
        ]
        transcript = " ".join(segment["text"] for segment in audio_segments).strip()

        return {
            "transcript": transcript,
            "segments": audio_segments,
            "language": getattr(info, "language", "en") or "en",
        }
    except RuntimeError as exc:
        return {"transcript": "", "segments": [], "language": "en", "error": str(exc)}
    except Exception as exc:
        return {
            "transcript": "",
            "segments": [],
            "language": "en",
            "error": f"Audio could not be decoded or transcribed: {exc}",
        }

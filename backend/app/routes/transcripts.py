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


def analyze_text(text: str) -> dict:
    normalized = text.lower()
    diagnoses: list[str] = []
    symptoms: list[str] = []
    billing_hints: list[str] = []

    def has_any(*terms: str) -> bool:
        return any(term in normalized for term in terms)

    if has_any("back pain", "lower back", "lumbar"):
        diagnoses.append("Low back pain / musculoskeletal pain")
        symptoms.append("Back pain")
        billing_hints.append("Therapeutic exercise or activity may be relevant if skilled minutes are documented.")

    if has_any("knee pain", "knee stiffness"):
        diagnoses.append("Knee pain / possible mobility limitation")
        symptoms.append("Knee pain")

    if has_any("shoulder pain", "shoulder stiffness"):
        diagnoses.append("Shoulder pain / possible range of motion limitation")
        symptoms.append("Shoulder pain")

    if has_any("anxiety", "panic", "worried"):
        diagnoses.append("Anxiety-related symptoms")
        symptoms.append("Anxiety")

    if has_any("depression", "depressed", "low mood"):
        diagnoses.append("Depressive symptoms")
        symptoms.append("Low mood")

    if "headache" in normalized:
        diagnoses.append("Headache symptoms")
        symptoms.append("Headache")

    if "fever" in normalized:
        symptoms.append("Fever")

    if "cough" in normalized:
        symptoms.append("Cough")

    if "cough" in normalized and "fever" in normalized:
        diagnoses.append("Possible respiratory infection symptoms")

    if "dizziness" in normalized:
        diagnoses.append("Dizziness / balance-related symptoms")
        symptoms.append("Dizziness")

    if "numbness" in normalized:
        diagnoses.append("Possible sensory change")
        symptoms.append("Numbness")

    if "weakness" in normalized:
        diagnoses.append("Weakness / functional limitation")
        symptoms.append("Weakness")

    if has_any("sleep issues", "trouble sleeping", "poor sleep", "insomnia"):
        diagnoses.append("Sleep disturbance symptoms")
        symptoms.append("Sleep issues")

    if has_any("trauma", "fall", "injury"):
        diagnoses.append("Possible injury or trauma-related symptoms")
        symptoms.append("Trauma or injury history")

    if has_any("therapy", "mobility", "range of motion", "rom", "pain scale"):
        billing_hints.append("Document skilled therapy minutes, findings, and patient response.")

    diagnoses = list(dict.fromkeys(diagnoses))
    symptoms = list(dict.fromkeys(symptoms))
    billing_hints = list(dict.fromkeys(billing_hints))
    clean_text = " ".join(text.split())

    return {
        "summary": f"Conversation segment reviewed: {clean_text[:220]}{'...' if len(clean_text) > 220 else ''}" if clean_text else "No clinically meaningful speech was captured in this segment.",
        "possible_diagnoses": diagnoses or ["No specific possible diagnosis detected from this segment"],
        "symptoms": symptoms or ["No clear symptom keywords detected"],
        "soap_update": {
            "subjective": f"Patient discussed {', '.join(symptoms).lower()} during this segment." if symptoms else "No additional subjective symptom details detected in this segment.",
            "objective": "Consider documenting mobility, strength, and range of motion findings." if has_any("mobility", "range of motion", "weakness") else "No new objective findings detected from speech alone.",
            "assessment": f"Possible clinical impressions to review: {'; '.join(diagnoses)}." if diagnoses else "No new assessment impression suggested by this segment.",
            "plan": "Review therapy plan, skilled minutes, and documentation support for detected treatment themes." if billing_hints else "Continue clinician review before adding generated suggestions to the note.",
        },
        "billing_hints": billing_hints or ["No specific CPT or billing relevance detected in this segment"],
        "confidence": "low" if len(clean_text) < 20 else "high" if len(diagnoses) + len(symptoms) >= 4 else "medium",
    }

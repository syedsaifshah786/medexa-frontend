from typing import Literal

from pydantic import BaseModel, Field


class StartSessionRequest(BaseModel):
    session_id: str | None = None
    patient_id: str | None = None
    patientName: str | None = None
    therapist_id: str | None = None
    session_type: str | None = None


class SessionStateUpdate(BaseModel):
    status: Literal["idle", "recording", "paused", "stopped"]
    elapsedSeconds: int | None = None


class CptTimerStartRequest(BaseModel):
    code: str
    source: Literal["manual", "ai_suggested"] = "manual"
    reason: str = ""


class FinalizeCptTimerPayload(BaseModel):
    active: bool = False
    code: str | None = None
    seconds: int = 0
    units: int = 0


class FinalizeCptRecordPayload(BaseModel):
    code: str
    displayName: str = ""
    seconds: int = 0
    units: int = 0
    status: Literal["running", "paused", "stopped"] = "stopped"
    source: Literal["manual", "ai_suggested"] = "manual"
    intervals: list[dict] = Field(default_factory=list)
    reason: str = ""


class FinalizeSessionRequest(BaseModel):
    transcript: str = ""
    total_seconds: int = 0
    cpt_timer: FinalizeCptTimerPayload = Field(default_factory=FinalizeCptTimerPayload)
    cpt_records: list[FinalizeCptRecordPayload] = Field(default_factory=list)
    applied_suggestions: list[str] = Field(default_factory=list)
    approved_insights: list[str] = Field(default_factory=list)
    detected_cpt_suggestions: list[dict] = Field(default_factory=list)
    detected_icd10_suggestions: list[dict] = Field(default_factory=list)
    ncci_conflicts: list[dict] = Field(default_factory=list)
    soap_draft: dict = Field(default_factory=dict)


class SoapNotesPayload(BaseModel):
    subjective: dict
    objective: dict
    assessment: dict
    plan: dict


class CptPayload(BaseModel):
    code: str
    title: str | None = None
    description: str | None = None
    units: str
    duration: str
    warning: str = ""
    note: str | None = None
    modifier: str = ""


class SummaryPayload(BaseModel):
    summary: str


class DiagnosisPayload(BaseModel):
    code: str
    description: str
    type: Literal["Primary", "Secondary"] = "Secondary"


class SessionMetaPayload(BaseModel):
    patient: str
    mrn: str
    provider: str
    session: str
    payor: str


class TranscriptChunkAnalysisRequest(BaseModel):
    chunk_text: str
    full_transcript: str = ""
    start_time: str
    end_time: str
    existing_cpt_codes: list[str] = Field(default_factory=list)
    active_cpt_code: str | None = None


class DebugDetectRequest(BaseModel):
    text: str

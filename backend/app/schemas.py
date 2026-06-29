from typing import Literal

from pydantic import BaseModel


class StartSessionRequest(BaseModel):
    session_id: str | None = None
    patient_id: str | None = None
    patientName: str | None = None
    therapist_id: str | None = None
    session_type: str | None = None


class SessionStateUpdate(BaseModel):
    status: Literal["idle", "recording", "paused", "stopped"]
    elapsedSeconds: int | None = None


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

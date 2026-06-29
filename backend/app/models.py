from typing import Literal

from pydantic import BaseModel


RecordingStatus = Literal["idle", "recording", "paused", "stopped"]
InsightStatus = Literal["pending", "approved", "ignored"]
CptStatus = Literal["pending", "approved", "rejected"]


class SessionModel(BaseModel):
    id: str
    patientName: str
    avatar: str
    ageSex: str
    weight: str
    mrnNumber: str
    payorSource: str
    careType: str
    cpt: str
    icd: str
    sessionTime: str
    status: str
    dateTime: str


class TranscriptModel(BaseModel):
    id: str
    patientName: str
    avatar: str
    time: str
    status: str
    summary: str
    transcript: str

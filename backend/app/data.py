BILLABLE_UNIT_SECONDS = 8 * 60


def cpt_units_from_seconds(elapsed_seconds: int) -> int:
    if elapsed_seconds < 8 * 60:
        return 0
    if elapsed_seconds < 23 * 60:
        return 1
    if elapsed_seconds < 38 * 60:
        return 2
    if elapsed_seconds < 53 * 60:
        return 3
    if elapsed_seconds < 68 * 60:
        return 4
    return 4 + ((elapsed_seconds - 68 * 60) // (15 * 60)) + 1


def next_cpt_unit_at(elapsed_seconds: int) -> int:
    thresholds = [8 * 60, 23 * 60, 38 * 60, 53 * 60, 68 * 60]
    for threshold in thresholds:
        if elapsed_seconds < threshold:
            return threshold
    extra_units = ((elapsed_seconds - 68 * 60) // (15 * 60)) + 1
    return 68 * 60 + extra_units * 15 * 60


def cpt_timer_from_elapsed(
    status: str = "idle",
    elapsed_seconds: int = 0,
    code: str | None = None,
    source: str | None = None,
    reason: str | None = None,
) -> dict:
    next_unit_at_seconds = next_cpt_unit_at(elapsed_seconds)
    return {
        "active": status == "running",
        "code": code,
        "seconds": elapsed_seconds,
        "units": cpt_units_from_seconds(elapsed_seconds),
        "next_unit_at_seconds": next_unit_at_seconds,
        "seconds_left_to_next_unit": max(next_unit_at_seconds - elapsed_seconds, 0),
        "status": status,
        "source": source,
        "reason": reason,
    }


def timer_state_from_elapsed(
    session_id: str,
    recording_status: str = "idle",
    total_seconds: int = 0,
    cpt_timer: dict | None = None,
) -> dict:
    return {
        "session_id": session_id,
        "recording_status": recording_status,
        "total_seconds": total_seconds,
        "cpt_timer": cpt_timer or cpt_timer_from_elapsed(),
    }


def state_from_elapsed(status: str = "idle", elapsed_seconds: int = 0) -> dict:
    units = elapsed_seconds // BILLABLE_UNIT_SECONDS
    next_unit_at = (units + 1) * BILLABLE_UNIT_SECONDS
    return {
        "status": status,
        "elapsedSeconds": elapsed_seconds,
        "units": units,
        "nextUnitAt": next_unit_at,
        "timeLeft": max(next_unit_at - elapsed_seconds, 0),
    }


sessions = [
    {
        "id": "samuel-thompson",
        "patientName": "Samuel Thompson",
        "avatar": "https://i.pravatar.cc/80?img=12",
        "ageSex": "58 / Male",
        "weight": "88 kg",
        "mrnNumber": "220486",
        "payorSource": "Medicare",
        "careType": "Chronic Care MGT",
        "cpt": "99490",
        "icd": "E11.9",
        "sessionTime": "July 05, 12:00 PM",
        "status": "active",
        "dateTime": "2026-07-05T12:00:00",
    },
    {
        "id": "amina-hassan",
        "patientName": "Amina Hassan",
        "avatar": "https://i.pravatar.cc/80?img=32",
        "ageSex": "64 / Female",
        "weight": "72 kg",
        "mrnNumber": "220487",
        "payorSource": "Aetna",
        "careType": "Physical Therapy",
        "cpt": "97110",
        "icd": "M54.5",
        "sessionTime": "July 05, 01:00 PM",
        "status": "Awaiting",
        "dateTime": "2026-07-05T13:00:00",
    },
    {
        "id": "robert-chen",
        "patientName": "Robert Chen",
        "avatar": "https://i.pravatar.cc/80?img=56",
        "ageSex": "71 / Male",
        "weight": "79 kg",
        "mrnNumber": "220488",
        "payorSource": "Medicare",
        "careType": "Neuromuscular Rehab",
        "cpt": "97112",
        "icd": "R26.81",
        "sessionTime": "July 05, 01:30 PM",
        "status": "Awaiting",
        "dateTime": "2026-07-05T13:30:00",
    },
    {
        "id": "elena-morris",
        "patientName": "Elena Morris",
        "avatar": "https://i.pravatar.cc/80?img=49",
        "ageSex": "52 / Female",
        "weight": "68 kg",
        "mrnNumber": "220489",
        "payorSource": "UnitedHealthcare",
        "careType": "Therapeutic Activity",
        "cpt": "97530",
        "icd": "M62.81",
        "sessionTime": "July 05, 02:00 PM",
        "status": "Awaiting",
        "dateTime": "2026-07-05T14:00:00",
    },
    {
        "id": "david-peter",
        "patientName": "David Peter",
        "avatar": "https://i.pravatar.cc/80?img=18",
        "ageSex": "60 / Male",
        "weight": "84 kg",
        "mrnNumber": "220490",
        "payorSource": "Blue Cross",
        "careType": "Chronic Care MGT",
        "cpt": "99439",
        "icd": "I10",
        "sessionTime": "July 05, 02:30 PM",
        "status": "Awaiting",
        "dateTime": "2026-07-05T14:30:00",
    },
    {
        "id": "lina-patel",
        "patientName": "Lina Patel",
        "avatar": "https://i.pravatar.cc/80?img=29",
        "ageSex": "67 / Female",
        "weight": "63 kg",
        "mrnNumber": "220491",
        "payorSource": "Medicare",
        "careType": "Balance Training",
        "cpt": "97116",
        "icd": "R26.89",
        "sessionTime": "July 05, 03:00 PM",
        "status": "Awaiting",
        "dateTime": "2026-07-05T15:00:00",
    },
    {
        "id": "omar-reed",
        "patientName": "Omar Reed",
        "avatar": "https://i.pravatar.cc/80?img=61",
        "ageSex": "49 / Male",
        "weight": "91 kg",
        "mrnNumber": "220492",
        "payorSource": "Cigna",
        "careType": "Therapeutic Exercise",
        "cpt": "97110",
        "icd": "M25.561",
        "sessionTime": "July 05, 03:30 PM",
        "status": "Awaiting",
        "dateTime": "2026-07-05T15:30:00",
    },
    {
        "id": "grace-wilson",
        "patientName": "Grace Wilson",
        "avatar": "https://i.pravatar.cc/80?img=36",
        "ageSex": "73 / Female",
        "weight": "70 kg",
        "mrnNumber": "220493",
        "payorSource": "Humana",
        "careType": "Care Coordination",
        "cpt": "99490",
        "icd": "E78.5",
        "sessionTime": "July 05, 04:00 PM",
        "status": "Awaiting",
        "dateTime": "2026-07-05T16:00:00",
    },
]

transcripts = [
    {
        "id": "jameson-locke",
        "patientName": "Jameson Locke",
        "avatar": "https://i.pravatar.cc/80?img=14",
        "time": "OCT 23, 11:45 AM",
        "status": "SUMMARIZED",
        "summary": "Jameson reported improved sleep and lower pain intensity after completing the home mobility plan.",
        "transcript": "Patient described steady improvement with fewer nighttime interruptions. Discussed continued stretching, medication adherence, and a follow-up mobility review.",
    },
    {
        "id": "sarah-palmer",
        "patientName": "Sarah Palmer",
        "avatar": "https://i.pravatar.cc/80?img=24",
        "time": "OCT 23, 09:20 AM",
        "status": "SUMMARY PENDING",
        "summary": "Summary has not been generated yet. Session notes include fatigue, balance concerns, and therapy adherence.",
        "transcript": "Patient noted moderate fatigue after activity and asked about pacing exercises. Provider reviewed fall prevention cues and recommended shorter activity intervals.",
    },
    {
        "id": "michael-chen",
        "patientName": "Michael Chen",
        "avatar": "https://i.pravatar.cc/80?img=8",
        "time": "OCT 23, 09:45 AM",
        "status": "SUMMARIZED",
        "summary": "Michael tolerated therapeutic exercises well and demonstrated improved confidence with gait training.",
        "transcript": "Patient completed the planned exercise sequence with minimal prompting. Reviewed balance work, pain scale, and next session goals.",
    },
    {
        "id": "aisha-khan",
        "patientName": "Aisha Khan",
        "avatar": "https://i.pravatar.cc/80?img=45",
        "time": "OCT 23, 10:05 AM",
        "status": "SUMMARY PENDING",
        "summary": "Summary has not been generated yet. Transcript includes medication questions and mobility updates.",
        "transcript": "Patient asked whether morning stiffness is expected after therapy. Provider discussed hydration, warm-up movements, and documenting symptoms.",
    },
    {
        "id": "david-lopez",
        "patientName": "David Lopez",
        "avatar": "https://i.pravatar.cc/80?img=18",
        "time": "OCT 23, 10:30 AM",
        "status": "SUMMARY PENDING",
        "summary": "Summary has not been generated yet. Session focused on lower back discomfort and activity pacing.",
        "transcript": "Patient reported lower back tightness after prolonged sitting. Provider reviewed posture changes, home exercises, and when to pause activity.",
    },
]

default_insights = [
    {
        "id": "family-history",
        "type": "protocol",
        "label": "Detected",
        "question": "Does anyone in your family have diabetes or vascular issues?",
        "description": "Patient reports persistent fatigue and lower back pain for 3 weeks.",
        "status": "pending",
    },
    {
        "id": "therapeutic-activity",
        "type": "billing",
        "label": "Billing",
        "question": "97530 - Therapeutic Act. detected add CPT for the session?",
        "description": "Therapeutic activity timing crossed a billable threshold.",
        "status": "pending",
    },
    {
        "id": "activity-level",
        "type": "protocol",
        "label": "Billing",
        "question": "How often do you engage in physical activity each week?",
        "description": "Prompt patient for weekly activity level before closing intake.",
        "status": "pending",
    },
    {
        "id": "manual-techniques",
        "type": "billing",
        "label": "Billing",
        "question": "Manual techniques detected, add CPT 97140 for the session?",
        "description": "Manual therapy techniques were detected during the session.",
        "status": "pending",
    },
]

default_suggestions = [
    {"id": "unit-recorded", "title": "Unit Recorded", "text": "1 unit recorded for 97110 - Therapeutic Ex. at 8:04", "applied": False},
    {"id": "modifier-59", "title": "Modifier 59 Required", "text": "Potential Bundle conflict detected for 97112 with 97110. Apply modifier?", "applied": False},
    {"id": "snf-validation", "title": "SNF Validation Alert", "text": "Section GG mobility scores differ from nursing log", "applied": False},
]

default_soap_notes = {
    "subjective": {
        "chiefComplaint": "Patient reports persistent discomfort in the lower back over the last 14 days, particularly after prolonged sitting. Mentions difficulty with mobility and occasional sharp pains. States: I feel like my back is always tight and stiff.",
        "painScale": "6",
        "duration": "14 days",
    },
    "objective": {
        "observationNotes": "Observed limited range of motion in lumbar flexion (40 deg) and slight guarding behavior on palpation of L4-L5 region. Patient ambulates with mild antalgic gait. Vital signs within normal limits: BP 118/76, HR 72 bpm. Affect is mildly anxious. Arrived on time.",
        "rangeOfMotion": "Lumbar Flexion 40 deg",
        "affect": "Mildly Anxious",
        "vitalSigns": "BP 118/76, HR 72",
    },
    "assessment": {
        "diagnosisSummary": "Chronic Lower Back Pain (M54.5) secondary to postural dysfunction and muscle deconditioning. Patient demonstrates functional limitations consistent with moderate severity. Focus on stretching and strengthening exercises for lumbar support. Follow-up scheduled.",
        "primaryDiagnosisCode": "M54.5",
        "severity": "Moderate",
    },
    "plan": {
        "followUpPlan": "Continue therapeutic exercise and activity training with lumbar mobility work. Reassess pain response and functional tolerance at the next visit.",
    },
}

default_billing = {
    "sessionTime": "52:22",
    "units": "4",
    "threshold": "+ 1 Threshold  $11,091/$2,330",
    "cptCodes": [
        {"id": "cpt-97110", "code": "97110", "title": "Therapeutic Ex.", "units": "1", "duration": "08:04", "warning": "", "status": "pending"},
        {"id": "cpt-97112", "code": "97112", "title": "Neuromusc. Ed.", "units": "1", "duration": "15:56", "warning": "Modifier 59 Required", "note": "Potential Bundle conflict detected with 97110. Apply modifier?", "status": "pending"},
        {"id": "cpt-97530", "code": "97530", "title": "Therapeutic Act.", "units": "2", "duration": "28:22", "warning": "", "status": "pending"},
    ],
    "snfFunctionalLogic": {"section": "Section GG - Patient Assist Level (MDS 3.0)", "level": "3 - Partial"},
}

default_summary = {
    "summary": "On June 18, 2026, Samuel completed session 4 of 12 with Dr. Sarah Miller, focusing on gait training and therapeutic exercises to support lower back pain, reduce fatigue, and improve strength and balance. He performed well and needed some movement assistance, which is normal at this stage of care. His knee flexibility improved by 15 deg compared with the baseline session. Next steps include a lipid panel follow-up with the primary care physician due in December 2026, continuing therapy sessions on Monday, Wednesday, and Friday, tracking pain daily in the pain diary, and completing home exercises including seated marches and heel raises.",
    "sent": False,
}

default_claim = {
    "patientMeta": {
        "patient": "Samuel T. (58/M)",
        "mrn": "220486",
        "provider": "Dr. Sarah Miller",
        "session": "June 18, 52 min",
        "payor": "Medicare",
    },
    "cptItems": [
        {"id": "cpt-97110", "code": "97110", "description": "Therapeutic Ex.", "units": "1", "duration": "08:04", "modifier": ""},
        {"id": "cpt-97112", "code": "97112", "description": "Neuromusc. Ed.", "units": "1", "duration": "15:56", "modifier": "MODIFIER 59"},
        {"id": "cpt-97530", "code": "97530", "description": "Therapeutic Act.", "units": "2", "duration": "28:00", "modifier": ""},
    ],
    "diagnosisCodes": [
        {"id": "dx-e119", "code": "E11.9", "description": "Type 2 Diabetes Mellitus without complications", "type": "Primary"},
        {"id": "dx-m545", "code": "M54.5", "description": "Low Back Pain", "type": "Secondary"},
        {"id": "dx-r5383", "code": "R53.83", "description": "Other Fatigue (Chronic)", "type": "Secondary"},
    ],
    "claimStatus": "draft",
}

session_states = {session["id"]: state_from_elapsed() for session in sessions}
timer_states = {session["id"]: timer_state_from_elapsed(session["id"]) for session in sessions}
cpt_records_by_session = {session["id"]: {} for session in sessions}
insights_by_session = {session["id"]: [item.copy() for item in default_insights] for session in sessions}
suggestions_by_session = {session["id"]: [item.copy() for item in default_suggestions] for session in sessions}
soap_notes_by_session = {session["id"]: default_soap_notes.copy() for session in sessions}
generated_soap_session_ids: set[str] = set()
billing_by_session = {session["id"]: {"sessionTime": default_billing["sessionTime"], "units": default_billing["units"], "threshold": default_billing["threshold"], "cptCodes": [item.copy() for item in default_billing["cptCodes"]], "snfFunctionalLogic": default_billing["snfFunctionalLogic"].copy()} for session in sessions}
summaries_by_session = {session["id"]: default_summary.copy() for session in sessions}
claims_by_session = {session["id"]: {"patientMeta": default_claim["patientMeta"].copy(), "cptItems": [item.copy() for item in default_claim["cptItems"]], "diagnosisCodes": [item.copy() for item in default_claim["diagnosisCodes"]], "claimStatus": default_claim["claimStatus"]} for session in sessions}


def get_session(session_id: str) -> dict:
    return next((session for session in sessions if session["id"] == session_id), sessions[0])


def ensure_session(session_id: str) -> None:
    if session_id in session_states:
        return
    base = sessions[0].copy()
    base["id"] = session_id
    base["patientName"] = "New Session"
    base["status"] = "active"
    sessions.append(base)
    session_states[session_id] = state_from_elapsed()
    timer_states[session_id] = timer_state_from_elapsed(session_id)
    cpt_records_by_session[session_id] = {}
    insights_by_session[session_id] = [item.copy() for item in default_insights]
    suggestions_by_session[session_id] = [item.copy() for item in default_suggestions]
    soap_notes_by_session[session_id] = default_soap_notes.copy()
    billing_by_session[session_id] = {"sessionTime": default_billing["sessionTime"], "units": default_billing["units"], "threshold": default_billing["threshold"], "cptCodes": [item.copy() for item in default_billing["cptCodes"]], "snfFunctionalLogic": default_billing["snfFunctionalLogic"].copy()}
    summaries_by_session[session_id] = default_summary.copy()
    claims_by_session[session_id] = {"patientMeta": default_claim["patientMeta"].copy(), "cptItems": [item.copy() for item in default_claim["cptItems"]], "diagnosisCodes": [item.copy() for item in default_claim["diagnosisCodes"]], "claimStatus": default_claim["claimStatus"]}

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

BASE_URL = "http://127.0.0.1:8000"
SESSION_ID = "samuel-thompson"


@dataclass
class SmokeCheck:
    name: str
    method: str
    path: str
    body: dict[str, Any] | None = None
    expect_keys: tuple[str, ...] = ()


def _request(check: SmokeCheck) -> tuple[int, Any]:
    data = None
    headers = {"Accept": "application/json"}
    if check.body is not None:
        data = json.dumps(check.body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(
        f"{BASE_URL}{check.path}",
        data=data,
        headers=headers,
        method=check.method,
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read().decode("utf-8")
        parsed = json.loads(raw) if raw else {}
        return response.status, parsed


def _checks() -> list[SmokeCheck]:
    cpt_text = "we did manual therapy and soft tissue mobilization"
    encoded_text = urllib.parse.urlencode({"text": cpt_text})
    transcript = (
        "Patient reports lower back pain. We did manual therapy and soft tissue "
        "mobilization, then reviewed the home exercise plan."
    )

    return [
        SmokeCheck("GET /health", "GET", "/health", expect_keys=("status",)),
        SmokeCheck(
            "GET /debug/team-backend-integration",
            "GET",
            "/debug/team-backend-integration",
            expect_keys=("team_backend_repo_reviewed",),
        ),
        SmokeCheck(
            "GET /debug/cpt-lookup-health",
            "GET",
            "/debug/cpt-lookup-health",
            expect_keys=("medexa_cpt_lookup_exists", "sample_detection"),
        ),
        SmokeCheck(
            "GET /debug/cpt-detect",
            "GET",
            f"/debug/cpt-detect?{encoded_text}",
            expect_keys=("cpt_timer_suggestions", "cpt_suggestions"),
        ),
        SmokeCheck(
            "GET /debug/eight-minute-rule-test",
            "GET",
            "/debug/eight-minute-rule-test",
            expect_keys=("single_cpt", "mixed_cpt_largest_remainder"),
        ),
        SmokeCheck(
            "POST /sessions/{session_id}/analyze-transcript-chunk",
            "POST",
            f"/sessions/{SESSION_ID}/analyze-transcript-chunk",
            {
                "chunk_text": cpt_text,
                "full_transcript": transcript,
                "start_time": "00:00",
                "end_time": "00:10",
                "language": "en",
                "existing_cpt_codes": [],
                "active_cpt_code": None,
                "cpt_records": [],
                "approved_insights": [],
                "applied_suggestions": [],
            },
            expect_keys=("summary", "cpt_suggestions", "soap_update"),
        ),
        SmokeCheck(
            "POST /sessions/{session_id}/finalize-session",
            "POST",
            f"/sessions/{SESSION_ID}/finalize-session",
            {
                "transcript": transcript,
                "full_transcript": transcript,
                "total_seconds": 484,
                "session_timer": {"status": "stopped", "total_seconds": 484},
                "language": "en",
                "cpt_timer": {
                    "active": False,
                    "code": "97140",
                    "seconds": 484,
                    "units": 1,
                },
                "cpt_records": [
                    {
                        "code": "97140",
                        "displayName": "Manual therapy techniques",
                        "seconds": 484,
                        "units": 1,
                        "status": "stopped",
                        "source": "manual",
                        "intervals": [{"startSecond": 0, "endSecond": 484}],
                        "reason": "Smoke test CPT record.",
                    }
                ],
                "active_cpt_code": None,
                "applied_suggestions": [],
                "approved_insights": [],
                "detected_cpt_suggestions": [],
                "detected_icd10_suggestions": [],
                "ncci_conflicts": [],
                "modifier59_suggestions": [],
                "soap_draft": {},
                "force_regenerate": False,
            },
            expect_keys=("session_id", "soap_note", "saved_to_store"),
        ),
        SmokeCheck(
            "GET /soap-notes/{session_id}",
            "GET",
            f"/soap-notes/{SESSION_ID}",
            expect_keys=("soap_note",),
        ),
        SmokeCheck(
            "GET /sessions/{session_id}/claim-document",
            "GET",
            f"/sessions/{SESSION_ID}/claim-document?language=en",
            expect_keys=("session_id", "claim_status", "draft_837p"),
        ),
        SmokeCheck(
            "POST /sessions/{session_id}/claim-document/verify",
            "POST",
            f"/sessions/{SESSION_ID}/claim-document/verify?language=en",
            expect_keys=("session_id", "validation"),
        ),
        SmokeCheck(
            "GET /sessions/{session_id}/claim-document/837p-draft",
            "GET",
            f"/sessions/{SESSION_ID}/claim-document/837p-draft?language=en",
            expect_keys=("claimType", "sessionId", "serviceLines"),
        ),
        SmokeCheck(
            "GET /claims/{session_id}",
            "GET",
            f"/claims/{SESSION_ID}",
            expect_keys=("patientMeta", "cptItems", "diagnosisCodes"),
        ),
    ]


def main() -> int:
    failures = 0
    for check in _checks():
        try:
            status, payload = _request(check)
            missing = [key for key in check.expect_keys if key not in payload]
            if 200 <= status < 300 and not missing:
                print(f"PASS {check.name}")
                continue

            failures += 1
            print(f"FAIL {check.name}: status={status} missing={missing}")
        except urllib.error.HTTPError as error:
            failures += 1
            body = error.read().decode("utf-8", errors="replace")
            print(f"FAIL {check.name}: HTTP {error.code} {body[:300]}")
        except Exception as error:
            failures += 1
            print(f"FAIL {check.name}: {error}")

    if failures:
        print(f"Smoke test failed: {failures} endpoint(s) failed.")
        return 1

    print("Smoke test passed: all protected endpoints responded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

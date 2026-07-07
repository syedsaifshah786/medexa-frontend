from __future__ import annotations


def integration_status() -> dict:
    return {
        "team_backend_repo_reviewed": True,
        "integration_mode": "local_ported_services",
        "active_claim_source": "claim_service",
        "active_billing_source": "billing_summary_service",
        "aws_required": False,
        "warnings": [],
    }

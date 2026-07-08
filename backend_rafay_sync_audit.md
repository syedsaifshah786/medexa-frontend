# Medexa Rafay Backend Sync Audit

Date: 2026-07-08

Scope:
- Current backend: `C:\Users\DELL\medexa-ui-prototype\backend`
- Rafay/team backend: `C:\Users\DELL\medexa-team-backend`
- Audit only. No merge performed.

Note: `git status` inside `C:\Users\DELL\medexa-team-backend` was blocked by Git safe-directory ownership. I did not change global Git config. The comparison below is based on source/config inspection.

## Executive Summary

Do not replace our backend wholesale with Rafay's backend.

Rafay's backend is a cleaner packaged FastAPI service with useful domain/core layers, deterministic rules engines, region-aware config, optional AWS storage/transcription/Bedrock hooks, SSE/WebSocket live streams, and better test coverage. However, it is not contract-compatible with our current deployed frontend/backend in several important places.

Highest-value integration targets:
- Pure timer/billing logic: `billing_timer_engine.py`, `eight_minute_rule.py`, `billing_summary_builder.py`
- Rules extraction/suggestion logic: `entity_extractor.py`, `suggestion_generator.py`, `path_a_processor.py`, `path_a_clinical_snapshot.py`
- Region/config loaders: `regions/*`, `loaders/*`
- Optional realtime event shape: `stream.py`, `adapters/realtime/*`
- Tests around billing, NCCI, state, and API contracts

Highest-risk areas:
- Session state model replacement
- Timer response contract differences
- `finalize-session` response shape
- SOAP storage/envelope differences
- Missing claim-document/837P routes in Rafay backend
- Missing debug endpoints required by our current backend
- Config file naming/shape mismatch

## Files Present/Changed In Rafay Backend

Because the two backends use different project structures, "changed" here means files present in Rafay's backend that do not map 1:1 to our current `backend/app` structure.

Core package:
- `src/medexa/config.py`
- `src/medexa/logging_setup.py`
- `src/medexa/schemas.py`
- `src/medexa/api/server.py`
- `src/medexa/api/contracts.py`
- `src/medexa/api/mappers.py`
- `src/medexa/api/dependencies.py`
- `src/medexa/api/models.py`
- `src/medexa/api/sse.py`

Routers:
- `src/medexa/api/routers/health.py`
- `src/medexa/api/routers/sessions.py`
- `src/medexa/api/routers/timers.py`
- `src/medexa/api/routers/live.py`
- `src/medexa/api/routers/stream.py`
- `src/medexa/api/routers/transcripts.py`
- `src/medexa/api/routers/documentation.py`
- `src/medexa/api/routers/billing.py`
- `src/medexa/api/routers/claims.py`
- `src/medexa/api/routers/legacy.py`

Useful service/core layers:
- `src/medexa/core/billing_timer_engine.py`
- `src/medexa/core/eight_minute_rule.py`
- `src/medexa/core/billing_summary_builder.py`
- `src/medexa/core/entity_extractor.py`
- `src/medexa/core/insights_builder.py`
- `src/medexa/core/ncci_conflict_checker.py`
- `src/medexa/core/suggestion_generator.py`
- `src/medexa/core/transcript_processor.py`
- `src/medexa/application/chunk_ingest_service.py`
- `src/medexa/application/path_a_processor.py`
- `src/medexa/application/path_a_clinical_snapshot.py`
- `src/medexa/application/path_b_trigger_evaluator.py`
- `src/medexa/application/event_handlers.py`

State, ports, adapters:
- `src/medexa/state/session_state_repository.py`
- `src/medexa/ports/*`
- `src/medexa/adapters/realtime/*`
- `src/medexa/adapters/events/*`
- `src/medexa/adapters/guardrails/local_guardrails.py`
- `src/medexa/adapters/aws/s3_storage.py`

Region/config system:
- `src/medexa/regions/*`
- `src/medexa/regions/us/loaders/*`
- `src/medexa/loaders/*`
- `config/activity_synonyms.json`
- `config/body_regions.json`
- `config/cpt_lookup.json`
- `config/cpt_metadata.json`
- `config/icd_lookup.json`
- `config/ncci_rules.json`
- `config/regions/us/*`
- `config/regions/sa/region_profile.json`
- `config/regions/ae/region_profile.json`

AWS/deployment/test additions:
- `src/medexa/aws/*`
- `Dockerfile`
- `Procfile`
- `pyproject.toml`
- `scripts/*`
- `tests/*`

## Route/Endpoint Comparison

### Endpoints Rafay adds or exposes that we do not currently expose

Risk: Medium if added as optional, High if they alter existing state flow.

- `GET /`
- `GET /health/aws`
- `GET /sessions/{session_id}/live/stream`
- `WEBSOCKET /sessions/{session_id}/live/ws`
- `GET /sessions/{session_id}/stream`
- `POST /sessions/{session_id}/transcript-chunk`
- `GET /sessions/{session_id}/insights-panel`
- `GET /sessions/{session_id}/billing-summary`
- `GET /sessions/{session_id}/alerts`
- `POST /sessions/{session_id}/timer/start`
- `POST /sessions/{session_id}/timer/stop`
- `POST /sessions/{session_id}/timer/switch`
- `POST /sessions/{session_id}/pause`
- `POST /sessions/{session_id}/resume`
- `POST /sessions/{session_id}/alerts/{alert_id}/approve`
- `POST /sessions/{session_id}/alerts/{alert_id}/reject`
- `POST /sessions/{session_id}/end`
- `POST /sessions/{session_id}/suggestions/{suggestion_id}/dismiss`
- `POST /patient-summary/{session_id}/generate`

### Required endpoints our backend must keep

Current backend provides these and they should be protected during any integration:

- `GET /health`
- `GET /debug/team-backend-integration`
- `GET /debug/cpt-lookup-health`
- `GET /debug/cpt-detect`
- `POST /sessions/{session_id}/analyze-transcript-chunk`
- `POST /sessions/{session_id}/finalize-session`
- `GET /soap-notes/{session_id}`
- `GET /sessions/{session_id}/claim-document`
- `POST /sessions/{session_id}/claim-document/verify`
- `POST /sessions/{session_id}/claim-document/draft`
- `GET /sessions/{session_id}/claim-document/837p-draft`
- `GET /claims/{session_id}`

Rafay backend does not directly include:
- `/debug/team-backend-integration`
- `/debug/cpt-lookup-health`
- `/debug/cpt-detect`
- `/sessions/{session_id}/claim-document`
- `/sessions/{session_id}/claim-document/verify`
- `/sessions/{session_id}/claim-document/draft`
- `/sessions/{session_id}/claim-document/837p-draft`

Manual adaptation required before any route migration.

## Session Logic

Rafay:
- Uses `SessionState` domain model in `src/medexa/schemas.py`.
- Uses `SessionStateRepository` protocol with in-memory and optional DynamoDB implementations.
- `POST /sessions/start` creates UUID sessions and supports `billing_region` (`US`, `SA`, `AE`).
- Session status uses domain values like `active`, `paused`, `ended`.
- `update_state` stops running timers on pause/stop and re-arms active CPT on resume.

Current:
- Uses `backend/app/data.py` in-memory dictionaries plus `session_repository.py` wrapper.
- Keeps seeded demo sessions and current frontend-friendly session shape.
- Must preserve `setActiveSessionId` frontend assumptions and seeded fallback behavior.

Useful:
- Repository protocol pattern.
- Region-aware session field.
- Stronger state machine for pause/resume/end.

Ignore for now:
- Wholesale `SessionState` replacement.
- DynamoDB repository as default.

Risk:
- High if replacing our `data.py`/`session_repository.py`.
- Medium if adding an adapter around Rafay's state engine.
- Low if only borrowing patterns/tests.

## Timer Logic

Rafay:
- `BillingTimerEngine` stores segments with `start_time`, `stop_time`, accumulated seconds, CPT, body region, and billable flag.
- `EightMinuteRuleCalculator` implements CMS 8-minute rule with largest remainder allocation.
- `BillingSummaryBuilder` separates timed and untimed CPTs.
- Timer endpoints are split into `timers.py`.

Current:
- Uses `timer_states` and `cpt_records_by_session` dicts.
- Frontend expects `ApiTimerState` with `cpt_records`.
- Current finalize flow depends on `cpt_records` in payload and localStorage.

Useful:
- Port `EightMinuteRuleCalculator` and its tests.
- Consider adapting `BillingTimerEngine.seconds_by_cpt`.
- Use segment aggregation ideas to improve CPT interval handling.

Needs manual adaptation:
- Rafay `ApiTimerState` does not include `cpt_records`; our frontend expects it optionally.
- Rafay `stop_session_timer` sets `state.status = "paused"` rather than ended/stopped.
- Rafay time is wall-clock based; ours is client elapsed-second based.

Risk:
- High if replacing timer endpoints directly.
- Medium if porting segment model behind our response contract.
- Low if porting only unit calculation and tests.

## CPT/ICD Logic

Rafay:
- Uses hybrid config: `activity_synonyms.json`, `cpt_lookup.json`, `cpt_metadata.json`, `icd_lookup.json`, `ncci_rules.json`.
- Has region loaders and US bundle.
- `EntityExtractor` detects clinical activities, body region, timing phrase, negation, and possible CPT.
- `PathAProcessor` creates events, insights, documentation gap events, and timeline events.
- `PathAClinicalSnapshotBuilder` returns rules-only `ApiTranscriptAnalysis`.

Current:
- Uses `backend/data/rules/*` with different file names and shapes:
  - `cpt_phrase_map.json`
  - `cpt_rules.json`
  - `icd10_phrase_map.json`
  - `ncci_conflicts.json`
  - `cpt_ptp_rules.json`
  - `cpt_mue_rules.json`
  - `cpt_icd10_rules.json`
  - `medexa_cpt_lookup.json`
  - `medexa_icd10_lookup.json`
- Current `analyze-transcript-chunk` response includes frontend-specific fields such as CPT timer suggestions, modifier 59 suggestions, body regions, live suggestions, and debug-compatible structures.

Useful:
- Entity extraction and negation handling.
- Suggestion cooldown logic.
- Region-aware loaders.
- NCCI conflict checker identity/dedupe.
- Tests: `test_hybrid_cpt_rule_index.py`, `test_ncci_conflict_checker.py`, `test_suggestion_generator.py`, `test_path_a_dispatcher.py`.

Needs manual adaptation:
- Either convert Rafay config into our rule file shapes or add compatibility loaders.
- Preserve our `AnalyzeTranscriptChunkRequest` fields: `full_transcript`, `existing_cpt_codes`, `active_cpt_code`, `cpt_records`, `approved_insights`, `applied_suggestions`, `language`.
- Preserve our response fields used by live CPT, modifier 59, Billing Intelligence, and Claim Document.

Risk:
- High if replacing `rule_engine.py`.
- Medium if adding Rafay entity extraction behind `rule_engine.analyze_transcript_for_cpt`.
- Low if importing tests/fixtures and adapting gradually.

## Claim/Billing Logic

Rafay:
- Billing routes are contract-shaped and use `billing_to_contract`.
- Claim routes support `/claims/{session_id}`, CPT add, diagnosis add, session data update, draft/verify/submit.
- Claim data derives from `SessionState`, timer summary, explicit claim diagnoses, and latest analysis.

Current:
- Has richer claim-document service:
  - `/sessions/{session_id}/claim-document`
  - `/sessions/{session_id}/claim-document/verify`
  - `/sessions/{session_id}/claim-document/draft`
  - `/sessions/{session_id}/claim-document/837p-draft`
- Builds 837P draft, validation results, cpt_lines, diagnoses, SOAP availability checks, and draft status.

Useful:
- `billing_to_contract` modifier logic.
- Derived claim diagnosis from latest analysis.
- Manual review item model.
- Billing unit tests.

Should be ignored:
- Direct replacement of `claim_service.py`.
- Direct replacement of claim routes, because Rafay lacks claim-document and 837P endpoints.

Needs manual adaptation:
- Port billing summary calculation into `billing_summary_service.py`.
- Keep current claim-document routes and response shape.
- If adding Rafay claim model fields, map them into our `patientMeta`, `cptItems`, `diagnosisCodes`, and `claimStatus`.

Risk:
- High for replacing claim service.
- Medium for replacing billing summary service.
- Low for adding tests and selective helper functions.

## SOAP/Documentation Logic

Rafay:
- `documentation.py` exposes `/soap-notes/{session_id}`, PUT, generate, patient-summary GET/PUT/generate/send.
- `RulesSoapGenerator` builds deterministic SOAP from latest analysis and transcript.
- Optional `BedrockSoapGenerator` falls back to rules on error.
- `finalize-session` saves generated SOAP to session state and returns `session_id`, `soap_note`, `summary`, `billing_summary`, `redirect_url`.

Current:
- `finalize-session` now must return an envelope with:
  - `session_id`
  - `saved_to_store: true`
  - `soap_note`
  - `llm_used`
  - optional `llm_fallback_reason`
- Current SOAP store can return stored finalize wrappers.
- Current frontend loads `localStorage medexa_soap_note_<sessionId>` first, then backend `/soap-notes/{session_id}`.

Useful:
- `RulesSoapGenerator` deterministic fallback.
- `SummaryGenerator` pattern.
- Bedrock fallback concept, but not as default.

Needs manual adaptation:
- Rafay `FinalizeSessionResponse` must gain `saved_to_store`, `llm_used`, `llm_fallback_reason`, and possibly `billing_summary.cpt_records`.
- Rafay `/soap-notes/{session_id}` returns raw SOAP DTO, not our stored wrapper. Our normalizer handles both, but backend compatibility should remain deliberate.
- Keep current OpenAI fallback behavior unless intentionally replacing with rules/Bedrock.

Risk:
- High if replacing `sessions.finalize_session`.
- Medium if adding `RulesSoapGenerator` as fallback inside current `llm_service.py`.
- Low if using only SOAP generation logic as an internal helper.

## Dependencies

Current `backend/requirements.txt`:
- `fastapi`
- `uvicorn`
- `pydantic`
- `python-multipart`
- `faster-whisper`

Rafay `pyproject.toml`:
- `fastapi>=0.115`
- `uvicorn[standard]>=0.30`
- `pydantic>=2.0`
- `pydantic-settings>=2.2`
- `python-multipart>=0.0.9`
- Optional AWS: `boto3>=1.34`, `mangum>=0.17`
- Dev: `pytest`, `pytest-asyncio`, `ruff`, `mypy`

Useful:
- Add `pydantic-settings` only if importing Rafay `config.py`.
- Add `pytest` only if bringing tests into our repo.

Should be ignored for now:
- `boto3`, `mangum`, AWS extras unless deploying AWS path.
- Switching to packaged `pyproject.toml` immediately.

Risk:
- Medium if `uvicorn[standard]` changes production environment footprint.
- Medium if optional AWS dependencies are installed unnecessarily.
- Low for adding `pydantic-settings` with no behavior change.

## Config/Env Requirements

Rafay env prefix: `MEDEXA_`

Notable env/settings:
- `MEDEXA_CONFIG_DIR`
- `MEDEXA_CPT_FILES_DIR`
- `MEDEXA_SUGGESTION_COOLDOWN_SECONDS`
- `MEDEXA_MAX_SESSION_DURATION_MINUTES`
- `MEDEXA_USE_SSE`
- `MEDEXA_REALTIME_TRANSPORT`
- `MEDEXA_ENABLE_ACTION_SUGGESTIONS`
- `MEDEXA_CORS_ALLOW_ORIGINS`
- `MEDEXA_PATH_B_ENABLED`
- `MEDEXA_PATH_B_MODEL_ID`
- `MEDEXA_PATH_B_INTERVAL_SECONDS`
- `MEDEXA_CLINICAL_ANALYZER`
- `MEDEXA_SOAP_GENERATOR`
- `MEDEXA_SUMMARY_GENERATOR`
- `MEDEXA_PATH_C_MODEL_ID`
- `MEDEXA_TRANSCRIPTION_PROVIDER`
- `MEDEXA_BEDROCK_MODEL_ID`
- `MEDEXA_TRANSCRIBE_S3_BUCKET`
- `MEDEXA_HOST`
- `MEDEXA_PORT`
- `MEDEXA_RELOAD`
- `MEDEXA_LOG_LEVEL`
- `MEDEXA_USE_DYNAMODB`
- `MEDEXA_DYNAMODB_TABLE_NAME`
- `MEDEXA_AWS_REGION`
- `MEDEXA_AWS_ENVIRONMENT`
- `MEDEXA_S3_BUCKET`
- `MEDEXA_CONFIG_SOURCE`

Current env:
- `OPENAI_API_KEY`
- `LLM_PROVIDER`
- `OPENAI_MODEL`
- CORS is hard-coded in `app/main.py`.
- Rule files are hard-coded under `backend/data/rules`.

Needs manual adaptation:
- Do not require `MEDEXA_*` env vars for current backend boot.
- If porting config, default to current behavior when env is absent.
- Keep current Hugging Face/OpenAI env support until intentionally replaced.

Risk:
- High if current backend starts requiring `MEDEXA_CONFIG_DIR` or AWS settings.
- Medium if CORS defaults change.
- Low if config is optional and adapter-based.

## Useful Service/Helper Files

Recommended to port/adapt first:
- `core/eight_minute_rule.py`: low-risk, pure calculation.
- `core/billing_timer_engine.py`: useful, but adapt to our client elapsed timer model.
- `core/billing_summary_builder.py`: useful for Billing Intelligence, with response mapping.
- `core/entity_extractor.py`: useful activity/body-region/negation extraction.
- `core/ncci_conflict_checker.py`: useful body-region-sensitive conflict dedupe.
- `core/suggestion_generator.py`: useful cooldown and dedupe.
- `application/path_a_clinical_snapshot.py`: useful response assembly concept.
- `services/soap_generator.py`: useful deterministic SOAP fallback.
- `api/mappers.py`: useful formatting/mapping patterns.
- `state/session_state_repository.py`: useful repository interface pattern, not direct store replacement.
- `tests/test_eight_minute_rule.py`
- `tests/test_billing_timer_engine.py`
- `tests/test_billing_summary_builder.py`
- `tests/test_ncci_conflict_checker.py`
- `tests/test_api_contract.py`

## What Should Be Ignored For Now

- Full package restructure from `backend/app/*` to `src/medexa/*`.
- Direct `create_app()` replacement from Rafay `api/server.py`.
- Direct `SessionState` replacement.
- Direct DynamoDB/S3/AWS Transcribe/Bedrock enablement.
- Direct route replacement for `/sessions/{id}/finalize-session`.
- Direct SOAP route replacement without stored wrapper compatibility.
- Direct claims route replacement because it would remove claim-document and 837P support.
- `legacy.py` internal endpoints unless we intentionally add them under clearly documented compatibility routes.
- Global exception handler returning traceback in production. Useful during dev, risky for deployed backend.

## Manual Adaptation Needed

1. Response contract adapters:
   - Add mapping from Rafay domain outputs to our `src/lib/api.ts` expectations.
   - Preserve snake_case/camelCase fields exactly where frontend expects them.

2. Timer adapter:
   - Convert segment-based timers to our `cpt_records` shape.
   - Preserve `ApiTimerState.cpt_records`.
   - Preserve current stop/finalize semantics.

3. Rule/config adapter:
   - Either convert Rafay config files to our `backend/data/rules` schema or create dual loaders.
   - Keep `/debug/cpt-lookup-health` and `/debug/cpt-detect` working.

4. Finalize/SOAP adapter:
   - Keep `saved_to_store: true`.
   - Keep deterministic fallback on generation failure.
   - Keep `medexa_soap_note_<sessionId>` frontend compatibility.

5. Claim-document adapter:
   - Keep our `claim_service.py` as source of truth.
   - Optionally use Rafay billing/diagnosis helpers internally.

6. Config/env adapter:
   - Add `MEDEXA_*` support only as optional.
   - Do not remove `OPENAI_API_KEY`, `LLM_PROVIDER`, `OPENAI_MODEL`.

## Exact Integration Plan

Phase 0 - Safety baseline:
- Add backend tests or smoke scripts for protected endpoints:
  - `/health`
  - `/debug/team-backend-integration`
  - `/debug/cpt-lookup-health`
  - `/debug/cpt-detect`
  - `/sessions/{session_id}/analyze-transcript-chunk`
  - `/sessions/{session_id}/finalize-session`
  - `/soap-notes/{session_id}`
  - claim-document and `/claims/{session_id}` endpoints
- Capture current response fixtures for one seeded session and one new live session.

Phase 1 - Low-risk pure helpers:
- Port/adapt `EightMinuteRuleCalculator`.
- Port relevant tests.
- Wire only into `billing_summary_service.py` behind current response shape.
- Risk: Low.

Phase 2 - Billing timer internals:
- Adapt `BillingTimerEngine` concepts to current `cpt_records_by_session`.
- Keep endpoint bodies/responses unchanged.
- Add conversion helpers between segment totals and `ApiCptRecord`.
- Risk: Medium.

Phase 3 - CPT/ICD rules:
- Add Rafay config loaders as optional helpers.
- Keep current `rule_engine.py` public functions.
- Gradually use `EntityExtractor`, `NcciConflictChecker`, and `SuggestionGenerator` inside current analyze flow.
- Confirm Modifier 59, body region, live CPT suggestions, and Arabic mode still work.
- Risk: Medium to High.

Phase 4 - SOAP fallback:
- Adapt `RulesSoapGenerator` as a fallback in current finalize path.
- Keep OpenAI path and current response envelope.
- Ensure finalize always saves before returning.
- Risk: Medium.

Phase 5 - Realtime optional endpoints:
- Add `/sessions/{session_id}/live/stream` and/or `/live/ws` only if frontend needs them.
- Keep browser WebSpeech flow unchanged.
- Risk: Medium.

Phase 6 - Region support:
- Add optional `billing_region` metadata without changing default US behavior.
- Add SA/AE placeholders only after route/claim contracts are stable.
- Risk: Medium.

Phase 7 - AWS/deployment:
- Consider DynamoDB/S3/Bedrock only as a separate deployment project.
- Never make AWS required for local or Hugging Face backend boot.
- Risk: High.

## Risk Matrix

| Area | Rafay change | Usefulness | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| App factory | Packaged `medexa.api.server` | Medium | High | Do not replace current `app/main.py` |
| Health | Adds `/` and `/health/aws` | Medium | Low | Add optional `/health/aws` only |
| Debug routes | Missing our debug routes | N/A | High | Preserve ours |
| Sessions | Domain `SessionState` repository | High | High | Adapter only |
| Timers | Segment-based timer engine | High | Medium/High | Port internals, keep contract |
| 8-minute rule | Largest remainder allocation | High | Low | Port first |
| CPT extraction | Hybrid entity extractor | High | Medium/High | Integrate gradually |
| ICD lookup | Region-aware loaders | Medium | Medium | Add optional loaders |
| NCCI | Conflict checker with region sensitivity | High | Medium | Port with Modifier 59 tests |
| Suggestions | Cooldown/dedupe generator | High | Medium | Adapt to current popups |
| Live streams | SSE/WebSocket event broker | Medium | Medium | Optional feature |
| Finalize SOAP | Session-state SOAP generation | Medium | High | Do not replace endpoint |
| SOAP generator | Rules/Bedrock fallback | High | Medium | Use as fallback helper |
| Billing routes | Cleaner mappers | Medium | Medium | Borrow mapping logic |
| Claims routes | Basic claim CRUD | Low/Medium | High | Keep current claim service |
| Claim document | Missing in Rafay | N/A | High | Preserve current endpoints |
| 837P draft | Missing in Rafay | N/A | High | Preserve current service |
| Config | `MEDEXA_*`, pydantic-settings | Medium | Medium | Optional only |
| AWS | DynamoDB/S3/Bedrock/Transcribe | Future value | High | Separate deployment track |
| Tests | Good unit/API tests | High | Low | Port/adapt tests |

## Final Recommendation

Use Rafay's backend as a source of tested domain logic, not as a replacement backend.

The safest path is to keep our current FastAPI routes and response contracts, then selectively port pure helpers and tests. The first concrete integration should be the 8-minute billing calculation, followed by billing summary/timer internals, then CPT/NCCI extraction. SOAP and claims should remain under our current route contracts until adapter tests prove parity.

Do not touch deployment config or AWS paths until the protected endpoints have automated contract coverage.

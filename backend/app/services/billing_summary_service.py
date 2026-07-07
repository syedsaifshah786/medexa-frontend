from __future__ import annotations

from copy import deepcopy
from typing import Any

from app import data
from app.services.localization import normalize_language, translate_cpt_display_name
from app.services.rule_engine import enrich_billing_payload, load_rules

FIFTEEN_MINUTES_SECONDS = 15 * 60


def units_from_seconds(elapsed_seconds: int) -> int:
    safe_seconds = max(int(elapsed_seconds or 0), 0)
    if safe_seconds < 8 * 60:
        return 0
    if safe_seconds < 23 * 60:
        return 1
    if safe_seconds < 38 * 60:
        return 2
    if safe_seconds < 53 * 60:
        return 3
    if safe_seconds < 68 * 60:
        return 4
    return 5 + ((safe_seconds - 68 * 60) // FIFTEEN_MINUTES_SECONDS)


def next_unit_at_seconds(elapsed_seconds: int) -> int:
    safe_seconds = max(int(elapsed_seconds or 0), 0)
    for threshold in [8 * 60, 23 * 60, 38 * 60, 53 * 60, 68 * 60]:
        if safe_seconds < threshold:
            return threshold
    extra_units = ((safe_seconds - 68 * 60) // FIFTEEN_MINUTES_SECONDS) + 1
    return 68 * 60 + extra_units * FIFTEEN_MINUTES_SECONDS


def allocate_timed_units(seconds_by_cpt: dict[str, int]) -> dict[str, Any]:
    clean_seconds = {
        str(code): max(int(seconds or 0), 0)
        for code, seconds in seconds_by_cpt.items()
        if str(code).strip()
    }
    total_seconds = sum(clean_seconds.values())
    total_units = units_from_seconds(total_seconds)
    units_by_cpt = {code: 0 for code in clean_seconds}
    remainders: dict[str, int] = {}
    allocated_units = 0

    for code, seconds in clean_seconds.items():
        base_units = seconds // FIFTEEN_MINUTES_SECONDS
        units_by_cpt[code] = base_units
        allocated_units += base_units
        remainders[code] = seconds % FIFTEEN_MINUTES_SECONDS

    units_remaining = max(total_units - allocated_units, 0)
    remainder_assigned_to: str | None = None
    if units_remaining and remainders:
        ordered = sorted(remainders.items(), key=lambda item: (-item[1], item[0]))
        index = 0
        while units_remaining > 0:
            code, _remainder = ordered[index % len(ordered)]
            units_by_cpt[code] += 1
            remainder_assigned_to = remainder_assigned_to or code
            units_remaining -= 1
            index += 1

    return {
        "total_seconds": total_seconds,
        "total_minutes": total_seconds // 60,
        "total_units": total_units,
        "units_by_cpt": units_by_cpt,
        "seconds_by_cpt": clean_seconds,
        "remainder_seconds": sum(remainders.values()),
        "remainder_assigned_to": remainder_assigned_to,
        "seconds_to_next_unit": max(next_unit_at_seconds(total_seconds) - total_seconds, 0),
    }


def duration_display(seconds: int) -> str:
    safe_seconds = max(int(seconds or 0), 0)
    return f"{safe_seconds // 60:02d}:{safe_seconds % 60:02d}"


def duration_seconds(value: str | None) -> int:
    if not value:
        return 0
    parts = str(value).split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
    except ValueError:
        return 0
    return 0


def _rule_record(lookup: object, code: str, code_field: str = "code") -> dict[str, Any]:
    if isinstance(lookup, dict):
        record = lookup.get(code)
        if isinstance(record, dict):
            return record
        for value in lookup.values():
            if isinstance(value, dict) and str(value.get(code_field) or "") == code:
                return value
    if isinstance(lookup, list):
        for value in lookup:
            if isinstance(value, dict) and str(value.get(code_field) or "") == code:
                return value
    return {}


def cpt_display(code: str, fallback: str = "", language: str = "en", rules: dict[str, Any] | None = None) -> str:
    active_rules = rules if rules is not None else load_rules()[0]
    lookup_record = _rule_record(active_rules.get("medexa_cpt_lookup", {}), code)
    billing_record = _rule_record(active_rules.get("cpt_billing_rules", {}), code, "cpt_code")
    label = lookup_record.get("label") or billing_record.get("description") or fallback or code
    return translate_cpt_display_name(code, str(label), normalize_language(language))


def _is_timed_cpt(code: str, rules: dict[str, Any]) -> bool:
    billing_record = _rule_record(rules.get("cpt_billing_rules", {}), code, "cpt_code")
    if "isEightMinuteRule" in billing_record:
        return bool(billing_record.get("isEightMinuteRule"))
    if "timed" in billing_record:
        return bool(billing_record.get("timed"))
    return str(code).startswith("97")


def _records_from_cpt_store(session_id: str) -> list[dict[str, Any]]:
    return [deepcopy(item) for item in data.cpt_records_by_session.get(session_id, {}).values()]


def _records_from_soap_store(session_id: str, language: str) -> list[dict[str, Any]]:
    soap_note = data.get_soap_note(session_id, language)
    billing_summary = soap_note.get("billing_summary", {}) if isinstance(soap_note, dict) else {}
    if not isinstance(billing_summary, dict):
        return []
    return [deepcopy(item) for item in billing_summary.get("cpt_records", []) if isinstance(item, dict)]


def aggregate_cpt_record_seconds(records: list[dict[str, Any]]) -> dict[str, int]:
    totals: dict[str, int] = {}
    for record in records:
        code = str(record.get("code") or "").strip()
        if not code:
            continue
        seconds = int(record.get("seconds") or 0)
        if seconds <= 0 and isinstance(record.get("intervals"), list):
            for interval in record["intervals"]:
                if not isinstance(interval, dict):
                    continue
                start = interval.get("startSecond")
                end = interval.get("endSecond")
                if start is None or end is None:
                    continue
                try:
                    seconds += max(int(end) - int(start), 0)
                except (TypeError, ValueError):
                    continue
        totals[code] = totals.get(code, 0) + max(seconds, 0)
    return totals


def build_billing_summary(session_id: str, language: str = "en") -> dict[str, Any]:
    normalized_language = normalize_language(language)
    rules, rule_warnings = load_rules()
    records = _records_from_cpt_store(session_id) or _records_from_soap_store(session_id, normalized_language)
    billing_seed = enrich_billing_payload(data.billing_by_session.get(session_id, {}))

    if not records:
        cpt_codes = [deepcopy(item) for item in billing_seed.get("cptCodes", [])]
        seconds_by_cpt = {
            str(item.get("code")): duration_seconds(str(item.get("duration") or ""))
            for item in cpt_codes
            if item.get("code")
        }
    else:
        seconds_by_cpt = aggregate_cpt_record_seconds(records)
        cpt_codes = []
        for record in records:
            code = str(record.get("code") or "").strip()
            if not code:
                continue
            seconds = seconds_by_cpt.get(code, int(record.get("seconds") or 0))
            cpt_codes.append(
                {
                    "id": f"cpt-{code}",
                    "code": code,
                    "title": cpt_display(code, str(record.get("displayName") or record.get("reason") or code), normalized_language, rules),
                    "duration": duration_display(seconds),
                    "warning": record.get("warning", ""),
                    "note": record.get("note"),
                    "status": record.get("status", "pending"),
                    "modifier": record.get("modifier", ""),
                    "bodyRegion": record.get("bodyRegion") or record.get("body_region"),
                    "source": record.get("source"),
                }
            )

    timed_seconds = {
        code: seconds
        for code, seconds in seconds_by_cpt.items()
        if _is_timed_cpt(code, rules)
    }
    eight_minute_rule = allocate_timed_units(timed_seconds) if timed_seconds else None
    total_units = 0

    for item in cpt_codes:
        code = str(item.get("code") or "")
        seconds = seconds_by_cpt.get(code, duration_seconds(str(item.get("duration") or "")))
        item["duration"] = item.get("duration") or duration_display(seconds)
        item["title"] = item.get("title") or cpt_display(code, str(item.get("description") or code), normalized_language, rules)
        if _is_timed_cpt(code, rules):
            units = eight_minute_rule["units_by_cpt"].get(code, 0) if eight_minute_rule else 0
        else:
            units = 1 if seconds > 0 else int(item.get("units") or 0)
        item["units"] = str(units)
        item["isEightMinuteRule"] = _is_timed_cpt(code, rules)
        total_units += units

    total_seconds = sum(seconds_by_cpt.values())
    seconds_to_next = eight_minute_rule["seconds_to_next_unit"] if eight_minute_rule else 0
    threshold = (
        f"{duration_display(seconds_to_next)} to next unit (CMS 8-Minute Rule)"
        if eight_minute_rule
        else billing_seed.get("threshold", "No timed units accrued yet")
    )

    return {
        "sessionTime": duration_display(total_seconds) if total_seconds else billing_seed.get("sessionTime", "00:00"),
        "units": str(total_units),
        "threshold": threshold,
        "cptCodes": cpt_codes,
        "snfFunctionalLogic": deepcopy(billing_seed.get("snfFunctionalLogic", {})),
        "eightMinuteRule": eight_minute_rule,
        "ruleWarnings": rule_warnings,
    }

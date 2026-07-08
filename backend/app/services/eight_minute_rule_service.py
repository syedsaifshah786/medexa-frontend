from __future__ import annotations

from typing import Any

FIFTEEN_MINUTES_SECONDS = 15 * 60

_UNIT_THRESHOLDS_SECONDS = [
    (8 * 60, 1),
    (23 * 60, 2),
    (38 * 60, 3),
    (53 * 60, 4),
    (68 * 60, 5),
]


def units_from_seconds(elapsed_seconds: int) -> int:
    safe_seconds = max(int(elapsed_seconds or 0), 0)
    if safe_seconds < _UNIT_THRESHOLDS_SECONDS[0][0]:
        return 0

    for index, (threshold, units) in enumerate(_UNIT_THRESHOLDS_SECONDS):
        next_threshold = (
            _UNIT_THRESHOLDS_SECONDS[index + 1][0]
            if index + 1 < len(_UNIT_THRESHOLDS_SECONDS)
            else None
        )
        if next_threshold is None or safe_seconds < next_threshold:
            return units

    return 5 + ((safe_seconds - 68 * 60) // FIFTEEN_MINUTES_SECONDS)


def next_unit_at_seconds(elapsed_seconds: int) -> int:
    safe_seconds = max(int(elapsed_seconds or 0), 0)
    for threshold, _units in _UNIT_THRESHOLDS_SECONDS:
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


def sample_eight_minute_rule_cases() -> dict[str, Any]:
    mixed_seconds = {
        "97110": 7 * 60,
        "97112": 7 * 60,
        "97530": 14 * 60,
    }
    return {
        "single_cpt": {
            "484_seconds": allocate_timed_units({"97140": 484}),
            "956_seconds": allocate_timed_units({"97140": 956}),
            "1680_seconds": allocate_timed_units({"97140": 1680}),
        },
        "mixed_cpt_largest_remainder": allocate_timed_units(mixed_seconds),
    }

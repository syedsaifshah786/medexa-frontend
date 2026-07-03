import json
import shutil
from pathlib import Path
import re

new_dir = Path(r"C:\Users\DELL\medexa-new-jsons")
target_dir = Path(r"C:\Users\DELL\medexa-ui-prototype\backend\data\rules")

target_dir.mkdir(parents=True, exist_ok=True)

def load_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))

def is_cpt_code_key(k):
    return bool(re.match(r"^(?:\d{5}|G\d{4}|\d{4}T)$", str(k)))

def is_icd_code_key(k):
    return bool(re.match(r"^[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]+)?$", str(k), re.I))

mapping = []

for p in sorted(new_dir.glob("*.json")):
    data = load_json(p)
    target_name = None
    reason = ""

    if isinstance(data, dict):
        keys = list(data.keys())
        non_meta_keys = [k for k in keys if k != "_meta"]

        if any(is_cpt_code_key(k) for k in non_meta_keys):
            sample_values = [data[k] for k in non_meta_keys[:5] if isinstance(data.get(k), dict)]
            if any("trigger_phrases" in v or "required_context" in v or "exclude_if_present" in v for v in sample_values):
                target_name = "medexa_cpt_lookup.json"
                reason = "Main CPT lookup with trigger phrases, labels, context, conflicts"

        if target_name is None and any(is_icd_code_key(k) for k in non_meta_keys):
            target_name = "medexa_icd10_lookup.json"
            reason = "Main ICD10 lookup"

    elif isinstance(data, list) and data and isinstance(data[0], dict):
        first_keys = set(data[0].keys())

        if {"cpt_code", "addonCodesAllowed"}.issubset(first_keys) or {"cpt_code", "isAddonCode", "parentCode"}.issubset(first_keys):
            target_name = "cpt_addon_rules.json"
            reason = "CPT add-on code relationship rules"

        elif {"cpt_code", "description", "isEightMinuteRule"}.issubset(first_keys):
            target_name = "cpt_billing_rules.json"
            reason = "CPT description and 8 minute rule metadata"

        elif {"cpt_code", "valid_icd10_codes"}.issubset(first_keys):
            target_name = "cpt_icd10_rules.json"
            reason = "Valid ICD10 codes per CPT"

        elif {"cpt_code", "mue"}.issubset(first_keys):
            target_name = "cpt_mue_rules.json"
            reason = "MUE / max unit rules"

        elif {"cpt_code", "ptp"}.issubset(first_keys):
            target_name = "cpt_ptp_rules.json"
            reason = "PTP / NCCI conflict rules"

    if target_name:
        dest = target_dir / target_name
        shutil.copy2(p, dest)
        mapping.append((p.name, target_name, reason))
    else:
        mapping.append((p.name, "NOT_COPIED_NEEDS_MANUAL_CHECK", "Could not identify safely"))

print("\nFinal mapping:")
for src, tgt, reason in mapping:
    print(f"{src}  ->  {tgt}  |  {reason}")

print("\nDone.")

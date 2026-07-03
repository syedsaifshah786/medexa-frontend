import json
import re
from pathlib import Path

new_dir = Path(r"C:\Users\DELL\medexa-new-jsons")

if not new_dir.exists():
    print("Folder not found:", new_dir)
    raise SystemExit

def load_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))

def text_of(data):
    return json.dumps(data, ensure_ascii=False).lower()

for p in sorted(new_dir.glob("*.json")):
    print("\n==============================")
    print("FILE:", p.name)

    try:
        data = load_json(p)
    except Exception as e:
        print("INVALID JSON:", e)
        continue

    text = text_of(data)

    guesses = []

    if isinstance(data, dict) and "_meta" in data and "medexa_cpt_lookup" in text:
        guesses.append("medexa_cpt_lookup.json")

    if "trigger_phrases" in text and "required_context" in text and "exclude_if_present" in text:
        guesses.append("medexa_cpt_lookup.json")

    if "addonCodesAllowed".lower() in text.lower() or ("isaddoncode" in text and "parentcode" in text):
        guesses.append("cpt_addon_rules.json")

    if "icd" in text or re.search(r"\b[a-tv-z][0-9][0-9ab](?:\.[0-9a-z]+)?\b", text, re.I):
        guesses.append("icd10_phrase_map.json")

    if any(x in text for x in ["lower back", "lumbar", "knee", "shoulder", "hip", "ankle", "body_region", "body region", "lower extremity"]):
        guesses.append("body_region_map.json")

    if any(x in text for x in ["modifier_59", "modifier 59", "ncci", "cpt_a", "cpt_b", "conflict_type", "modifier_59_possible"]):
        guesses.append("ncci_conflicts.json")

    if any(x in text for x in ["billing_category", "billing category", "time based", "procedure category", "unit_conversion", "8 minute"]):
        guesses.append("billing_category_map.json / cpt_rules.json")

    if any(x in text for x in ["display_name", "documentation_requirements", "billing_caveats", "clinical_rationale", "descriptor"]):
        guesses.append("cpt_rules.json")

    print("Top-level type:", type(data).__name__)

    if isinstance(data, dict):
        print("Sample keys:", list(data.keys())[:10])
    elif isinstance(data, list):
        print("List length:", len(data))
        print("First item keys:", list(data[0].keys()) if data and isinstance(data[0], dict) else "N/A")

    print("Guesses:", ", ".join(dict.fromkeys(guesses)) if guesses else "Need manual check")

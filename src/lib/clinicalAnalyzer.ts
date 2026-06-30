export type Icd10Suggestion = {
  phrase: string;
  code: string;
  reason: string;
  confidence: "low" | "medium" | "high";
};

export type BodyRegionSuggestion = {
  phrase: string;
  region: string;
};

export type CptSuggestion = {
  code: string;
  label: string;
  displayName: string;
  descriptor: string;
  matchedPhrases: string[];
  documentationRequirements: string[];
  billingCaveats: Record<string, unknown>;
  reason: string;
  confidence: "low" | "medium" | "high";
};

export type NcciConflict = {
  cptA: string;
  cptB: string;
  conflictType: string;
  bodyRegionSensitive: boolean;
  modifier59Possible: boolean;
  explanation: string;
  severity: "info" | "warning";
};

export type ClinicalAnalysis = {
  summary: string;
  possibleDiagnoses: string[];
  icd10Suggestions: Icd10Suggestion[];
  bodyRegions: BodyRegionSuggestion[];
  cptSuggestions: CptSuggestion[];
  ncciConflicts: NcciConflict[];
  symptoms: string[];
  soapUpdate: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  billingHints: string[];
  confidence: "low" | "medium" | "high";
  disclaimer: string;
};

const unique = (items: string[]) => Array.from(new Set(items));

const hasAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));

export function analyzeClinicalTranscript(transcript: string): ClinicalAnalysis {
  const normalized = transcript.toLowerCase();
  const possibleDiagnoses: string[] = [];
  const symptoms: string[] = [];
  const billingHints: string[] = [];

  if (hasAny(normalized, ["back pain", "lower back", "lumbar"])) {
    possibleDiagnoses.push("Low back pain / musculoskeletal pain");
    symptoms.push("Back pain");
    billingHints.push("Therapeutic activity or therapeutic exercise may be relevant if skilled intervention is documented.");
  }

  if (hasAny(normalized, ["knee pain", "knee stiffness"])) {
    possibleDiagnoses.push("Knee pain / possible mobility limitation");
    symptoms.push("Knee pain");
    billingHints.push("Gait training, therapeutic exercise, or neuromuscular re-education may be relevant based on treatment performed.");
  }

  if (hasAny(normalized, ["shoulder pain", "shoulder stiffness"])) {
    possibleDiagnoses.push("Shoulder pain / possible range of motion limitation");
    symptoms.push("Shoulder pain");
  }

  if (hasAny(normalized, ["anxiety", "panic", "worried"])) {
    possibleDiagnoses.push("Anxiety-related symptoms");
    symptoms.push("Anxiety");
  }

  if (hasAny(normalized, ["depression", "depressed", "low mood"])) {
    possibleDiagnoses.push("Depressive symptoms");
    symptoms.push("Low mood");
  }

  if (normalized.includes("headache")) {
    possibleDiagnoses.push("Headache symptoms");
    symptoms.push("Headache");
  }

  if (normalized.includes("fever")) {
    symptoms.push("Fever");
  }

  if (normalized.includes("cough")) {
    symptoms.push("Cough");
  }

  if (normalized.includes("cough") && normalized.includes("fever")) {
    possibleDiagnoses.push("Possible respiratory infection symptoms");
  }

  if (normalized.includes("dizziness")) {
    possibleDiagnoses.push("Dizziness symptoms");
    symptoms.push("Dizziness");
  }

  if (normalized.includes("numbness")) {
    possibleDiagnoses.push("Possible neurological sensory symptoms");
    symptoms.push("Numbness");
  }

  if (normalized.includes("weakness")) {
    possibleDiagnoses.push("Weakness / reduced strength symptoms");
    symptoms.push("Weakness");
  }

  if (hasAny(normalized, ["sleep", "sleep issues", "trouble sleeping", "poor sleep", "insomnia"])) {
    possibleDiagnoses.push("Sleep disturbance");
    symptoms.push("Sleep disturbance");
  }

  if (hasAny(normalized, ["trauma", "fall", "injury"])) {
    possibleDiagnoses.push("Possible injury or trauma-related symptoms");
    symptoms.push("Trauma or injury history");
  }

  if (hasAny(normalized, ["therapy", "mobility", "range of motion", "rom", "difficulty walking"])) {
    billingHints.push("Document skilled therapy minutes, functional goals, and response to treatment.");
  }

  if (hasAny(normalized, ["pain scale", "pain is", "pain level"])) {
    symptoms.push("Pain severity reported");
    billingHints.push("Pain scale documentation may support medical necessity and response tracking.");
  }

  if (hasAny(normalized, ["range of motion", "rom"])) {
    symptoms.push("Limited range of motion");
    billingHints.push("Range of motion findings may support therapeutic exercise or activity documentation.");
  }

  if (normalized.includes("difficulty walking")) {
    symptoms.push("Difficulty walking");
    possibleDiagnoses.push("Possible mobility limitation");
  }

  const cleanTranscript = transcript.trim().replace(/\s+/g, " ");
  const summary =
    cleanTranscript.length > 0
      ? `Conversation segment reviewed: ${cleanTranscript.slice(0, 220)}${cleanTranscript.length > 220 ? "..." : ""}`
      : "No clinically meaningful speech was captured in this segment.";
  const detectedSymptoms = unique(symptoms);
  const diagnoses = unique(possibleDiagnoses);
  const hints = unique(billingHints);
  const confidence: ClinicalAnalysis["confidence"] =
    cleanTranscript.length < 20 ? "low" : diagnoses.length + detectedSymptoms.length >= 4 ? "high" : "medium";

  return {
    summary,
    possibleDiagnoses: diagnoses.length > 0 ? diagnoses : ["No specific possible diagnosis detected from this segment"],
    icd10Suggestions: [],
    bodyRegions: [],
    cptSuggestions: [],
    ncciConflicts: [],
    symptoms: detectedSymptoms.length > 0 ? detectedSymptoms : ["No clear symptom keywords detected"],
    soapUpdate: {
      subjective:
        detectedSymptoms.length > 0
          ? `Patient discussed ${detectedSymptoms.join(", ").toLowerCase()} during this segment.`
          : "No additional subjective symptom details detected in this segment.",
      objective:
        hasAny(normalized, ["mobility", "range of motion", "weakness"])
          ? "Consider documenting observed mobility, strength, and range of motion findings."
          : "No new objective findings detected from speech alone.",
      assessment:
        diagnoses.length > 0
          ? `Possible clinical impressions to review: ${diagnoses.join("; ")}.`
          : "No new assessment impression suggested by this segment.",
      plan:
        hints.length > 0
          ? "Review therapy plan, skilled minutes, and documentation support for the detected treatment themes."
          : "Continue clinician review before adding generated suggestions to the note.",
    },
    billingHints: hints.length > 0 ? hints : ["No specific CPT or billing relevance detected in this segment"],
    confidence,
    disclaimer: "AI-assisted suggestions require clinician review.",
  };
}

import type { ApiCptTimerSuggestion } from "@/lib/api";

export type CptTimerSuggestion = ApiCptTimerSuggestion;

const cptPhraseMap = [
  {
    code: "97110",
    displayName: "Therapeutic Exercise",
    phrases: [
      "therapeutic exercise",
      "therapeutic exercises",
      "ther ex",
      "therex",
      "range of motion",
      "range motion",
      "rom",
      "arom",
      "prom",
      "aarom",
      "strengthening",
      "strength training",
      "resistance training",
      "stretching",
      "theraband",
      "resistive exercise",
    ],
  },
  {
    code: "97116",
    displayName: "Gait Training",
    phrases: [
      "gait training",
      "gate training",
      "walking training",
      "walking practice",
      "stair training",
      "stairs training",
      "ambulation",
      "treadmill walking",
    ],
  },
  {
    code: "97140",
    displayName: "Manual Therapy",
    phrases: [
      "manual therapy",
      "manual techniques",
      "joint mobilization",
      "soft tissue mobilization",
      "soft tissue work",
      "myofascial release",
      "manual traction",
    ],
  },
  {
    code: "97112",
    displayName: "Neuromuscular Reeducation",
    phrases: [
      "neuromuscular reeducation",
      "neuromuscular re-education",
      "neuro reeducation",
      "neuro re-education",
      "neuro reed",
      "neuro re-ed",
      "neuromuscular rehab",
      "nmr",
      "balance training",
      "balance exercise",
      "balance exercises",
      "proprioception",
      "proprioceptive training",
      "postural training",
      "coordination training",
    ],
  },
  {
    code: "97530",
    displayName: "Therapeutic Activity",
    phrases: [
      "therapeutic activity",
      "therapeutic activities",
      "functional activity",
      "functional activities",
      "functional task",
      "functional tasks",
      "therapeutic task",
      "therapeutic tasks",
      "transfer training",
      "sit to stand",
      "bed mobility",
      "functional mobility",
    ],
  },
  {
    code: "97535",
    displayName: "Self-Care / ADL",
    phrases: [
      "self care",
      "self-care",
      "self care training",
      "self-care training",
      "adl training",
      "adls",
      "activities of daily living",
      "dressing training",
      "grooming training",
      "bathing training",
    ],
  },
];

const normalizeCptText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const bodyRegionPhrases = [
  { region: "lower back", phrases: ["lower back", "low back", "lumbar", "lumbar spine", "back pain"] },
  { region: "lower extremity", phrases: ["lower extremity", "leg", "gait", "walking", "stair"] },
  { region: "knee", phrases: ["knee", "left knee", "right knee"] },
  { region: "shoulder", phrases: ["shoulder", "left shoulder", "right shoulder"] },
  { region: "hip", phrases: ["hip", "left hip", "right hip"] },
  { region: "ankle", phrases: ["ankle", "left ankle", "right ankle"] },
];

const phraseMatches = (normalizedText: string, phrase: string) => {
  const normalizedPhrase = normalizeCptText(phrase);
  return new RegExp(`(^|\\s)${normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(normalizedText);
};

export function detectCptFromText(text: string): CptTimerSuggestion[] {
  const normalizedText = normalizeCptText(text);
  const suggestionsByCode = new Map<string, CptTimerSuggestion>();
  const bodyRegion = bodyRegionPhrases.find((entry) =>
    entry.phrases.some((phrase) => phraseMatches(normalizedText, phrase)),
  )?.region;

  if (!normalizedText) {
    return [];
  }

  cptPhraseMap
    .flatMap((entry) => entry.phrases.map((phrase) => ({ ...entry, phrase })))
    .sort((a, b) => normalizeCptText(b.phrase).length - normalizeCptText(a.phrase).length)
    .forEach((entry) => {
      if (!phraseMatches(normalizedText, entry.phrase) || suggestionsByCode.has(entry.code)) {
        return;
      }

      suggestionsByCode.set(entry.code, {
        should_start: true,
        code: entry.code,
        display_name: entry.displayName,
        matched_phrase: entry.phrase,
        body_region: bodyRegion ?? "unspecified",
        reason: `Detected phrase from live transcript: ${entry.phrase}`,
        confidence: "high",
      });
    });

  return Array.from(suggestionsByCode.values());
}

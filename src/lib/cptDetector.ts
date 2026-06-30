import type { ApiCptTimerSuggestion } from "@/lib/api";

const cptPhraseMap = [
  {
    code: "97110",
    displayName: "Therapeutic Exercise",
    phrases: [
      "therapeutic exercise",
      "therapeutic exercises",
      "therapy exercise",
      "ther ex",
      "therex",
      "range of motion",
      "range motion",
      "rom",
      "strengthening",
      "strength training",
      "stretching",
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
      "neuro reeducation",
      "balance training",
      "balance exercise",
      "proprioception",
      "postural training",
    ],
  },
  {
    code: "97530",
    displayName: "Therapeutic Activity",
    phrases: [
      "therapeutic activity",
      "therapeutic activities",
      "functional activity",
      "transfer training",
      "sit to stand",
    ],
  },
  {
    code: "97535",
    displayName: "Self-Care / ADL",
    phrases: ["self care", "adl training", "activities of daily living"],
  },
];

const normalizeCptText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function detectCptFromText(text: string): ApiCptTimerSuggestion[] {
  const normalizedText = normalizeCptText(text);
  const suggestionsByCode = new Map<string, ApiCptTimerSuggestion>();

  cptPhraseMap.forEach((entry) => {
    const matchedPhrase = entry.phrases.find((phrase) => normalizedText.includes(phrase));

    if (!matchedPhrase || suggestionsByCode.has(entry.code)) {
      return;
    }

    suggestionsByCode.set(entry.code, {
      should_start: true,
      code: entry.code,
      display_name: entry.displayName,
      reason: `Detected phrase from live transcript: ${matchedPhrase}`,
      confidence: "high",
    });
  });

  return Array.from(suggestionsByCode.values());
}

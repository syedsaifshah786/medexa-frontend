export type MedexaCommand =
  | "start_session"
  | "start_recording"
  | "stop_recording"
  | "pause"
  | "resume"
  | "start_cpt"
  | "none";

export type MedexaCommandDetection = {
  wakeWordDetected: boolean;
  command: MedexaCommand;
  phrase: string;
  confidence: "low" | "medium" | "high";
};

const wakeWordPatterns = [
  "medexa",
  "hey medexa",
  "hi medexa",
  "okay medexa",
  "ok medexa",
  "madexa",
  "med exa",
  "medix",
  "medics",
  "medicsa",
  "mede xa",
  "med ex",
  "med extra",
];

const commandPatterns: Array<{ command: Exclude<MedexaCommand, "none">; phrases: string[] }> = [
  {
    command: "start_session",
    phrases: [
      "hey medexa start a session",
      "medexa start a session",
      "hey medexa start session",
      "medexa start session",
      "start a new session",
    ],
  },
  {
    command: "start_recording",
    phrases: ["medexa start recording", "hey medexa start recording", "medexa begin session", "medexa start session", "start recording"],
  },
  {
    command: "stop_recording",
    phrases: ["medexa stop recording", "medexa stop session", "stop recording"],
  },
  {
    command: "pause",
    phrases: ["medexa pause", "pause recording"],
  },
  {
    command: "resume",
    phrases: ["medexa resume", "resume recording"],
  },
  {
    command: "start_cpt",
    phrases: ["medexa start cpt", "start cpt timer", "start procedure timer", "start procedure"],
  },
];

export const normalizeSpeechText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function detectMedexaCommand(text: string): MedexaCommandDetection {
  const phrase = normalizeSpeechText(text);
  const wakeWordDetected = wakeWordPatterns.some((wakeWord) => phrase.includes(wakeWord));
  const commandMatch = commandPatterns.find(({ phrases }) =>
    phrases.some((commandPhrase) => phrase.includes(commandPhrase)),
  );

  if (commandMatch) {
    return {
      wakeWordDetected: true,
      command: commandMatch.command,
      phrase,
      confidence: wakeWordDetected ? "high" : "medium",
    };
  }

  return {
    wakeWordDetected,
    command: "none",
    phrase,
    confidence: wakeWordDetected ? "medium" : "low",
  };
}

import en from "./en.json";
import ar from "./ar.json";
import he from "./he.json";

export type Language = "en" | "ar" | "he";
export type TranslationKey = string;
export type TranslationParams = Record<string, string | number | null | undefined>;

export const translations: Record<Language, Record<string, string>> = {
  en,
  ar: { ...en, ...ar },
  he: { ...en, ...he },
};

const rtlLanguages = new Set<Language>(["ar", "he"]);

export function getDirection(language: Language) {
  return rtlLanguages.has(language) ? "rtl" : "ltr";
}

export function translate(language: Language, key: string, params: TranslationParams = {}) {
  const template = translations[language][key] ?? translations.en[key] ?? key;

  if (process.env.NODE_ENV === "development" && template === key && !translations.en[key]) {
    console.warn(`Missing translation key: ${key}`);
  }

  return template.replace(/\{(\w+)\}/g, (_, paramKey: string) => {
    const value = params[paramKey];
    return value === null || value === undefined ? "" : String(value);
  });
}

const cptDisplayNames: Record<string, Record<Language, string>> = {
  "97110": {
    en: "Therapeutic Exercise",
    ar: "التمارين العلاجية",
    he: "Therapeutic Exercise",
  },
  "97112": {
    en: "Neuromuscular Reeducation",
    ar: "إعادة التأهيل العصبي العضلي",
    he: "Neuromuscular Reeducation",
  },
  "97116": {
    en: "Gait Training",
    ar: "تدريب المشي",
    he: "Gait Training",
  },
  "97140": {
    en: "Manual Therapy",
    ar: "العلاج اليدوي",
    he: "Manual Therapy",
  },
  "97530": {
    en: "Therapeutic Activity",
    ar: "النشاط العلاجي",
    he: "Therapeutic Activity",
  },
  "97535": {
    en: "Self-Care / ADL",
    ar: "العناية الذاتية / أنشطة الحياة اليومية",
    he: "Self-Care / ADL",
  },
};

export function translateCptDisplayName(code: string | null | undefined, fallbackName: string | null | undefined, language: Language) {
  if (!code) {
    return fallbackName ?? "";
  }

  return cptDisplayNames[code]?.[language] ?? fallbackName ?? code;
}

export function formatUnits(count: number, language: Language) {
  const formatter = new Intl.NumberFormat(language);
  const unitLabel = translate(language, count === 1 ? "unit.one" : "unit.other");
  return `${formatter.format(count)} ${unitLabel}`;
}

export function formatDurationLabel(seconds: number, language: Language) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const formatter = new Intl.NumberFormat(language);
  const minuteLabel = translate(language, minutes === 1 ? "time.minute.one" : "time.minute.other");
  const secondLabel = translate(language, remainingSeconds === 1 ? "time.second.one" : "time.second.other");

  if (minutes <= 0) {
    return `${formatter.format(remainingSeconds)} ${secondLabel}`;
  }

  if (remainingSeconds <= 0) {
    return `${formatter.format(minutes)} ${minuteLabel}`;
  }

  return `${formatter.format(minutes)} ${minuteLabel} ${formatter.format(remainingSeconds)} ${secondLabel}`;
}

export function formatDateTime(value: string | Date, language: Language) {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(language, {
    month: "long",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

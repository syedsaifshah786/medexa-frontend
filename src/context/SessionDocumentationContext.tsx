"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type SectionKey = "subjective" | "objective" | "assessment" | "plan";

export type SoapData = {
  subjective: {
    chiefComplaint: string;
    painScale: string;
    duration: string;
  };
  objective: {
    observationNotes: string;
    rangeOfMotion: string;
    affect: string;
    vitalSigns: string;
  };
  assessment: {
    diagnosisSummary: string;
    primaryDiagnosisCode: string;
    severity: string;
  };
  plan: {
    followUpPlan: string;
  };
};

type SessionDocumentationContextValue = {
  soapData: SoapData;
  hasGeneratedDocumentation: boolean;
  updateSoapData: (data: SoapData) => void;
};

const STORAGE_KEY = "medexa-session-documentation";

export const defaultSoapData: SoapData = {
  subjective: {
    chiefComplaint:
      "Patient reports persistent discomfort in the lower back over the last 14 days, particularly after prolonged sitting. Mentions difficulty with mobility and occasional sharp pains. States: I feel like my back is always tight and stiff.",
    painScale: "6",
    duration: "14 days",
  },
  objective: {
    observationNotes:
      "Observed limited range of motion in lumbar flexion (40 deg) and slight guarding behavior on palpation of L4-L5 region. Patient ambulates with mild antalgic gait. Vital signs within normal limits: BP 118/76, HR 72 bpm. Affect is mildly anxious. Arrived on time.",
    rangeOfMotion: "Lumbar Flexion 40 deg",
    affect: "Mildly Anxious",
    vitalSigns: "BP 118/76, HR 72",
  },
  assessment: {
    diagnosisSummary:
      "Chronic Lower Back Pain (M54.5) secondary to postural dysfunction and muscle deconditioning. Patient demonstrates functional limitations consistent with moderate severity. Focus on stretching and strengthening exercises for lumbar support. Follow-up scheduled.",
    primaryDiagnosisCode: "M54.5",
    severity: "Moderate",
  },
  plan: {
    followUpPlan:
      "Continue therapeutic exercise and activity training with lumbar mobility work. Reassess pain response and functional tolerance at the next visit.",
  },
};

const SessionDocumentationContext = createContext<SessionDocumentationContextValue | null>(null);

export function SessionDocumentationProvider({ children }: { children: React.ReactNode }) {
  const [soapData, setSoapData] = useState<SoapData>(defaultSoapData);
  const [hasGeneratedDocumentation, setHasGeneratedDocumentation] = useState(false);

  useEffect(() => {
    const storedDocumentation = window.localStorage.getItem(STORAGE_KEY);

    if (!storedDocumentation) {
      return;
    }

    try {
      const parsed = JSON.parse(storedDocumentation) as {
        soapData?: SoapData;
        hasGeneratedDocumentation?: boolean;
      };

      if (parsed.soapData) {
        setSoapData(parsed.soapData);
        setHasGeneratedDocumentation(Boolean(parsed.hasGeneratedDocumentation));
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const updateSoapData = (data: SoapData) => {
    setSoapData(data);
    setHasGeneratedDocumentation(true);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ soapData: data, hasGeneratedDocumentation: true }),
    );
  };

  return (
    <SessionDocumentationContext.Provider
      value={{ soapData, hasGeneratedDocumentation, updateSoapData }}
    >
      {children}
    </SessionDocumentationContext.Provider>
  );
}

export function useSessionDocumentation() {
  const context = useContext(SessionDocumentationContext);

  if (!context) {
    throw new Error("useSessionDocumentation must be used within SessionDocumentationProvider");
  }

  return context;
}

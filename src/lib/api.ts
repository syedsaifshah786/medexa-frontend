"use client";

import type { SoapData } from "@/context/SessionDocumentationContext";
import type {
  ClinicalAnalysis,
  CptSuggestion,
  Icd10Suggestion,
  NcciConflict,
} from "@/lib/clinicalAnalyzer";
import type { UpcomingSession } from "@/lib/sessions";

export type ApiSession = {
  id: string;
  patientName: string;
  avatar: string;
  ageSex: string;
  weight: string;
  mrnNumber: string;
  payorSource: string;
  careType: string;
  cpt: string;
  icd: string;
  sessionTime: string;
  status: UpcomingSession["status"];
  dateTime: string;
};

export type ApiTranscript = {
  id: string;
  patientName: string;
  avatar: string;
  time: string;
  status: "SUMMARIZED" | "SUMMARY PENDING";
  summary: string;
  transcript: string;
};

export type ApiInsight = {
  id: string;
  type: "protocol" | "detected" | "billing";
  label: string;
  question: string;
  description: string;
  status: "pending" | "approved" | "ignored";
};

export type ApiSuggestion = {
  id: string;
  title: string;
  text: string;
  applied: boolean;
};

export type ApiRecordingState = {
  status: "idle" | "recording" | "paused" | "stopped";
  elapsedSeconds: number;
  units: number;
  nextUnitAt: number;
  timeLeft: number;
};

export type ApiTranscriptAnalysis = {
  summary: string;
  possible_clinical_impressions?: string[];
  possible_diagnoses: string[];
  icd10_suggestions?: Array<{
    phrase: string;
    code: string;
    reason: string;
    confidence: Icd10Suggestion["confidence"];
  }>;
  body_regions?: Array<{
    phrase: string;
    region: string;
  }>;
  cpt_suggestions?: Array<{
    code: string;
    label: string;
    display_name: string;
    descriptor: string;
    matched_phrases: string[];
    documentation_requirements: string[];
    billing_caveats: Record<string, unknown>;
    reason: string;
    confidence: CptSuggestion["confidence"];
  }>;
  ncci_conflicts?: Array<{
    cpt_a: string;
    cpt_b: string;
    conflict_type: string;
    body_region_sensitive: boolean;
    modifier_59_possible: boolean;
    explanation: string;
    severity: NcciConflict["severity"];
  }>;
  symptoms: string[];
  soap_update: ClinicalAnalysis["soapUpdate"];
  billing_hints: string[];
  confidence: ClinicalAnalysis["confidence"];
  disclaimer?: string;
};

export type ApiAudioTranscriptionAnalysis = ApiTranscriptAnalysis & {
  transcript: string;
  audio_segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
};

export type ApiBilling = {
  sessionTime: string;
  units: string;
  threshold: string;
  cptCodes: Array<{
    id: string;
    code: string;
    title: string;
    units: string;
    duration: string;
    warning: string;
    note?: string;
    status: "pending" | "approved" | "rejected";
  }>;
  snfFunctionalLogic: {
    section: string;
    level: string;
  };
};

export type ApiClaim = {
  patientMeta: {
    patient: string;
    mrn: string;
    provider: string;
    session: string;
    payor: string;
  };
  cptItems: Array<{
    id: string;
    code: string;
    description: string;
    units: string;
    duration: string;
    modifier: string;
  }>;
  diagnosisCodes: Array<{
    id: string;
    code: string;
    description: string;
    type: "Primary" | "Secondary";
  }>;
  claimStatus: "draft" | "verified" | "submitted";
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const isDevelopment = process.env.NODE_ENV === "development";

function endpoint(path: string) {
  const base = API_BASE_URL.replace(/\/+$/g, "");
  const nextPath = path.replace(/^\/+/g, "");
  return base ? `${base}/${nextPath}` : `/${nextPath}`;
}

async function request<T>(
  path: string,
  { body, headers, ...options }: RequestOptions = {},
): Promise<T | null> {
  if (!API_BASE_URL) {
    return null;
  }

  try {
    const response = await fetch(endpoint(path), {
      ...options,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (isDevelopment) {
      console.warn("[Medexa API] Falling back to local mock data.", path, error);
    }
    return null;
  }
}

export const medexaApi = {
  sessions: () => request<ApiSession[]>("/sessions"),
  session: (sessionId: string) => request<ApiSession>(`/sessions/${encodeURIComponent(sessionId)}`),
  startSession: (body: Record<string, unknown>) =>
    request<{ session: ApiSession; state: ApiRecordingState }>("/sessions/start", {
      method: "POST",
      body,
    }),
  transcripts: () => request<ApiTranscript[]>("/transcripts"),
  generateTranscriptSummary: (transcriptId: string) =>
    request<ApiTranscript>(`/transcripts/${encodeURIComponent(transcriptId)}/generate-summary`, {
      method: "POST",
    }),
  sessionState: (sessionId: string) =>
    request<ApiRecordingState>(`/sessions/${encodeURIComponent(sessionId)}/state`),
  updateSessionState: (sessionId: string, body: Pick<ApiRecordingState, "status"> & { elapsedSeconds?: number }) =>
    request<ApiRecordingState>(`/sessions/${encodeURIComponent(sessionId)}/state`, {
      method: "POST",
      body,
    }),
  analyzeTranscriptChunk: (
    sessionId: string,
    body: {
      chunk_text: string;
      start_time: string;
      end_time: string;
    },
  ) =>
    request<ApiTranscriptAnalysis>(`/sessions/${encodeURIComponent(sessionId)}/analyze-transcript-chunk`, {
      method: "POST",
      body,
    }),
  transcribeAudio: async (sessionId: string, file: File) => {
    if (!API_BASE_URL) {
      return null;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(endpoint(`/sessions/${encodeURIComponent(sessionId)}/transcribe-audio`), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      return (await response.json()) as ApiAudioTranscriptionAnalysis;
    } catch (error) {
      if (isDevelopment) {
        console.warn("[Medexa API] Audio transcription failed.", error);
      }
      return null;
    }
  },
  insights: (sessionId: string) =>
    request<ApiInsight[]>(`/sessions/${encodeURIComponent(sessionId)}/insights`),
  approveInsight: (sessionId: string, insightId: string) =>
    request<ApiInsight>(`/sessions/${encodeURIComponent(sessionId)}/insights/${encodeURIComponent(insightId)}/approve`, {
      method: "POST",
    }),
  ignoreInsight: (sessionId: string, insightId: string) =>
    request<ApiInsight>(`/sessions/${encodeURIComponent(sessionId)}/insights/${encodeURIComponent(insightId)}/ignore`, {
      method: "POST",
    }),
  suggestions: (sessionId: string) =>
    request<ApiSuggestion[]>(`/sessions/${encodeURIComponent(sessionId)}/suggestions`),
  applySuggestion: (sessionId: string, suggestionId: string) =>
    request<ApiSuggestion>(`/sessions/${encodeURIComponent(sessionId)}/suggestions/${encodeURIComponent(suggestionId)}/apply`, {
      method: "POST",
    }),
  soapNotes: (sessionId: string) =>
    request<SoapData>(`/soap-notes/${encodeURIComponent(sessionId)}`),
  updateSoapNotes: (sessionId: string, body: SoapData) =>
    request<SoapData>(`/soap-notes/${encodeURIComponent(sessionId)}`, {
      method: "PUT",
      body,
    }),
  generateSoapNotes: (sessionId: string) =>
    request<SoapData>(`/soap-notes/${encodeURIComponent(sessionId)}/generate`, {
      method: "POST",
    }),
  billing: (sessionId: string) => request<ApiBilling>(`/billing/${encodeURIComponent(sessionId)}`),
  addBillingCpt: (sessionId: string, body: Record<string, unknown>) =>
    request<ApiBilling["cptCodes"][number]>(`/billing/${encodeURIComponent(sessionId)}/cpt`, {
      method: "POST",
      body,
    }),
  editBillingCpt: (sessionId: string, cptId: string, body: Record<string, unknown>) =>
    request<ApiBilling["cptCodes"][number]>(`/billing/${encodeURIComponent(sessionId)}/cpt/${encodeURIComponent(cptId)}`, {
      method: "PUT",
      body,
    }),
  approveBillingCpt: (sessionId: string, cptId: string) =>
    request<ApiBilling["cptCodes"][number]>(`/billing/${encodeURIComponent(sessionId)}/cpt/${encodeURIComponent(cptId)}/approve`, {
      method: "POST",
    }),
  rejectBillingCpt: (sessionId: string, cptId: string) =>
    request<ApiBilling["cptCodes"][number]>(`/billing/${encodeURIComponent(sessionId)}/cpt/${encodeURIComponent(cptId)}/reject`, {
      method: "POST",
    }),
  patientSummary: (sessionId: string) =>
    request<{ summary: string; sent: boolean }>(`/patient-summary/${encodeURIComponent(sessionId)}`),
  updatePatientSummary: (sessionId: string, summary: string) =>
    request<{ summary: string; sent: boolean }>(`/patient-summary/${encodeURIComponent(sessionId)}`, {
      method: "PUT",
      body: { summary },
    }),
  sendPatientSummary: (sessionId: string) =>
    request<{ summary: string; sent: boolean }>(`/patient-summary/${encodeURIComponent(sessionId)}/send`, {
      method: "POST",
    }),
  claim: (sessionId: string) => request<ApiClaim>(`/claims/${encodeURIComponent(sessionId)}`),
  addClaimCpt: (sessionId: string, body: Record<string, unknown>) =>
    request<ApiClaim["cptItems"][number]>(`/claims/${encodeURIComponent(sessionId)}/cpt`, {
      method: "POST",
      body,
    }),
  addClaimDiagnosis: (sessionId: string, body: Record<string, unknown>) =>
    request<ApiClaim["diagnosisCodes"][number]>(`/claims/${encodeURIComponent(sessionId)}/diagnosis`, {
      method: "POST",
      body,
    }),
  updateClaimSessionData: (sessionId: string, body: ApiClaim["patientMeta"]) =>
    request<ApiClaim>(`/claims/${encodeURIComponent(sessionId)}/session-data`, {
      method: "PUT",
      body,
    }),
  saveClaimDraft: (sessionId: string) =>
    request<ApiClaim>(`/claims/${encodeURIComponent(sessionId)}/save-draft`, { method: "POST" }),
  verifyClaim: (sessionId: string) =>
    request<ApiClaim>(`/claims/${encodeURIComponent(sessionId)}/verify`, { method: "POST" }),
  submitClaim: (sessionId: string) =>
    request<ApiClaim>(`/claims/${encodeURIComponent(sessionId)}/submit`, { method: "POST" }),
};

export function apiSessionToUpcomingSession(session: ApiSession): UpcomingSession {
  return {
    id: session.id,
    name: session.patientName,
    status: session.status,
    careType: session.careType,
    cpt: session.cpt,
    icd: session.icd,
    time: session.sessionTime,
    img: session.avatar,
    ageSex: session.ageSex,
    weight: session.weight,
    mrn: session.mrnNumber,
    payor: session.payorSource,
  };
}

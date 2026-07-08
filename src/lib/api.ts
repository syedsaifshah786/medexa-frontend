"use client";

import type { SoapData } from "@/context/SessionDocumentationContext";
import type {
  ClinicalAnalysis,
  CptSuggestion,
  Icd10Suggestion,
  NcciConflict,
} from "@/lib/clinicalAnalyzer";
import type { UpcomingSession } from "@/lib/sessions";
import type { Language } from "@/lib/translations";

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

export type ApiCptTimerState = {
  active: boolean;
  code: string | null;
  seconds: number;
  units: number;
  next_unit_at_seconds: number;
  seconds_left_to_next_unit: number;
  status: "idle" | "running" | "paused" | "stopped";
  source?: "manual" | "ai_suggested" | null;
  reason?: string | null;
};

export type ApiTimerState = {
  session_id: string;
  recording_status: ApiRecordingState["status"];
  total_seconds: number;
  cpt_timer: ApiCptTimerState;
  cpt_records?: ApiCptRecord[];
};

export type ApiCptTimerSuggestion = {
  should_start: boolean;
  code: string | null;
  display_name: string | null;
  matched_phrase?: string | null;
  matched_phrases?: string[];
  body_region?: string | null;
  body_region_code?: string | null;
  billing_category?: string | null;
  reason: string;
  confidence: CptSuggestion["confidence"] | "low" | "medium" | "high";
};

export type ApiModifier59Suggestion = {
  id: string;
  type: "modifier";
  title: string;
  description: string;
  codes: string[];
  body_region: string;
  modifier: "59";
  status: "pending" | "applied" | "ignored";
  requires_clinician_review: boolean;
};

export type ApiLiveSuggestion = {
  id: string;
  type: "billing" | "protocol" | "detected" | "alert" | "modifier";
  title: string;
  description: string;
  action_label: string;
  status: "pending" | "applied" | "ignored";
  codes?: string[];
  body_region?: string;
  modifier?: "59";
  requires_clinician_review?: boolean;
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
  cpt_timer_suggestion?: ApiCptTimerSuggestion;
  cpt_timer_suggestions?: ApiCptTimerSuggestion[];
  modifier59_suggestions?: ApiModifier59Suggestion[];
  live_suggestions?: ApiLiveSuggestion[];
};

export type ApiCptRecord = {
  code: string;
  displayName: string;
  seconds: number;
  units: number;
  status: "running" | "paused" | "stopped";
  source: "manual" | "ai_suggested";
  intervals: Array<{
    startSecond: number;
    endSecond?: number;
  }>;
  reason?: string;
  bodyRegion?: string | null;
  bodyRegionCode?: string | null;
  matchedPhrase?: string | null;
  billingCategory?: string | null;
};

export type ApiFinalizeSessionPayload = {
  transcript: string;
  full_transcript?: string;
  total_seconds: number;
  session_timer?: {
    status: ApiRecordingState["status"];
    total_seconds: number;
  };
  language?: Language;
  cpt_timer?: {
    active: boolean;
    code: string | null;
    seconds: number;
    units: number;
  };
  cpt_records?: ApiCptRecord[];
  active_cpt_code?: string | null;
  applied_suggestions: string[];
  approved_insights?: string[];
  detected_cpt_suggestions: ApiTranscriptAnalysis["cpt_suggestions"];
  detected_icd10_suggestions: ApiTranscriptAnalysis["icd10_suggestions"];
  ncci_conflicts: ApiTranscriptAnalysis["ncci_conflicts"];
  modifier59_suggestions?: ApiModifier59Suggestion[];
  soap_draft?: unknown;
  force_regenerate?: boolean;
};

export type ApiFinalizeSessionResponse = {
  session_id: string;
  soap_note: SoapData;
  summary: string;
  billing_summary: {
    total_seconds: number;
    cpt_code?: string | null;
    cpt_seconds?: number;
    units?: number;
    cpt_records?: ApiCptRecord[];
  };
  redirect_url: string;
  saved_to_store?: boolean;
  llm_used?: boolean;
  llm_fallback_reason?: string;
  active_route_marker?: string;
  store_keys_after_save?: string[];
};

export type ApiSoapNoteResponse = Partial<SoapData> & {
  session_id?: string;
  soap_note?: SoapData;
  chief_complaint?: string;
  pain_scale?: string;
  duration?: string;
  subjective?: SoapData["subjective"] | string;
  objective?: SoapData["objective"] | string;
  assessment?: SoapData["assessment"] | string;
  plan?: SoapData["plan"] | string;
  diagnosis_summary?: string;
  observation_notes?: string;
  range_of_motion?: string;
  affect?: string;
  vital_signs?: string;
  summary?: string;
  billing_summary?: ApiFinalizeSessionResponse["billing_summary"];
  saved_to_store?: boolean;
  llm_used?: boolean;
  llm_fallback_reason?: string;
  active_route_marker?: string;
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

export type Claim837PDiagnosis = {
  pointer: "A" | "B" | "C" | "D";
  code: string;
  description: string;
  priority: "primary" | "secondary";
  source: "AI" | "clinician" | "review";
};

export type Claim837PServiceLine = {
  lineNumber: number;
  dateOfService: string;
  cptCode: string;
  description: string;
  units: number;
  duration: string;
  modifier: string | null;
  diagnosisPointer: string;
  charge: number | null;
  validationStatus: "ready" | "passed" | "missing_units" | "needs_review";
};

export type Claim837PValidationResult = {
  field: string;
  status: "pass" | "missing" | "needs_review";
  message: string;
};

export type Claim837PDraft = {
  claimType: "837P_DRAFT";
  sessionId: string;
  patient: {
    name: string;
    mrn: string;
  };
  subscriber: {
    name: string;
    relationship: string;
  };
  payer: {
    name: string;
  };
  provider: {
    orderingProvider: string;
  };
  diagnoses: Claim837PDiagnosis[];
  serviceLines: Claim837PServiceLine[];
  validationResults: Claim837PValidationResult[] | Record<string, unknown>;
  generatedAt: string;
};

export type ApiClaimDocument = {
  session_id: string;
  claim_status: "draft" | "needs_review" | "ready_for_review";
  patient: {
    name: string;
    display_name: string;
    mrn: string;
    patient_id: string | null;
    age: number | null;
    gender: string | null;
    payer: string;
    member_id: string | null;
  };
  provider: {
    ordering_provider: string;
    rendering_provider: string;
  };
  session: {
    date_of_service: string | null;
    display_meta: string;
    duration_seconds: number;
    care_type: string;
  };
  summary: {
    total_units: number;
    billable_units: number;
    total_cpt_lines: number;
  };
  cpt_lines: Array<{
    line_number: number;
    cpt_code: string;
    description: string;
    display_name: string;
    units: number;
    duration_seconds: number;
    duration_display: string;
    modifier: string | null;
    diagnosis_pointer: string;
    validation_status: "passed" | "needs_review" | "missing_units" | string;
    body_region: string | null;
  }>;
  diagnoses: Array<{
    pointer: "A" | "B" | "C" | "D";
    code: string;
    description: string;
    priority: "primary" | "secondary";
    source: string;
    review_required: boolean;
  }>;
  validation: {
    patient_present: boolean;
    provider_present: boolean;
    payer_present: boolean;
    cpt_lines_present: boolean;
    diagnoses_present: boolean;
    units_present: boolean;
    modifier_review_required: boolean;
    soap_note_available?: boolean;
    warnings: string[];
    missing: string[];
  };
  draft_837p: Claim837PDraft;
};

export type ApiClaimDocumentDraftResponse = {
  saved: boolean;
  claim_document: ApiClaimDocument;
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const isDevelopment = process.env.NODE_ENV === "development";
const apiBaseUrl = API_BASE_URL.replace(/\/+$/g, "");

function endpoint(path: string) {
  const nextPath = path.replace(/^\/+/g, "");
  return apiBaseUrl ? `${apiBaseUrl}/${nextPath}` : `/${nextPath}`;
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

export async function getClaimDocument(sessionId: string, language: Language = "en") {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const url =
    `${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/claim-document?language=${encodeURIComponent(language)}`;

  if (isDevelopment) {
    console.log("[ClaimDocument] fetching", url);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch claim document: ${response.status}`);
  }

  return (await response.json()) as ApiClaimDocument;
}

export async function verifyClaimDocument(sessionId: string, language: Language = "en") {
  if (!sessionId) {
    throw new Error("sessionId is required to verify claim document");
  }

  const url =
    `${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/claim-document/verify?language=${encodeURIComponent(language)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to verify claim document: ${res.status}`);
  }

  return (await res.json()) as ApiClaimDocument;
}

export async function saveClaimDraft(sessionId: string, payload: Record<string, unknown>) {
  if (!sessionId) {
    throw new Error("sessionId is required to save claim draft");
  }

  const url = `${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/claim-document/draft`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to save claim draft: ${res.status}`);
  }

  return (await res.json()) as ApiClaimDocumentDraftResponse;
}

export async function get837PDraft(sessionId: string, language: Language = "en") {
  if (!sessionId) {
    throw new Error("sessionId is required to fetch 837P draft");
  }

  const url =
    `${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/claim-document/837p-draft?language=${encodeURIComponent(language)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch 837P draft: ${res.status}`);
  }

  return (await res.json()) as Claim837PDraft;
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
  getTimerState: (sessionId: string) =>
    request<ApiTimerState>(`/sessions/${encodeURIComponent(sessionId)}/timer-state`),
  startSessionTimer: (sessionId: string) =>
    request<ApiTimerState>(`/sessions/${encodeURIComponent(sessionId)}/timer-state/start`, {
      method: "POST",
    }),
  pauseSessionTimer: (sessionId: string) =>
    request<ApiTimerState>(`/sessions/${encodeURIComponent(sessionId)}/timer-state/pause`, {
      method: "POST",
    }),
  resumeSessionTimer: (sessionId: string) =>
    request<ApiTimerState>(`/sessions/${encodeURIComponent(sessionId)}/timer-state/resume`, {
      method: "POST",
    }),
  stopSessionTimer: (sessionId: string) =>
    request<ApiTimerState>(`/sessions/${encodeURIComponent(sessionId)}/timer-state/stop`, {
      method: "POST",
    }),
  startCptTimer: (
    sessionId: string,
    code: string,
    source: "manual" | "ai_suggested",
    reason: string,
  ) =>
    request<ApiTimerState>(`/sessions/${encodeURIComponent(sessionId)}/cpt-timer/start`, {
      method: "POST",
      body: { code, source, reason },
    }),
  pauseCptTimer: (sessionId: string) =>
    request<ApiTimerState>(`/sessions/${encodeURIComponent(sessionId)}/cpt-timer/pause`, {
      method: "POST",
    }),
  resumeCptTimer: (sessionId: string) =>
    request<ApiTimerState>(`/sessions/${encodeURIComponent(sessionId)}/cpt-timer/resume`, {
      method: "POST",
    }),
  stopCptTimer: (sessionId: string) =>
    request<ApiTimerState>(`/sessions/${encodeURIComponent(sessionId)}/cpt-timer/stop`, {
      method: "POST",
    }),
  analyzeTranscriptChunk: (
    sessionId: string,
    body: {
      chunk_text: string;
      full_transcript?: string;
      start_time: string;
      end_time: string;
      existing_cpt_codes?: string[];
      active_cpt_code?: string | null;
      cpt_records?: ApiCptRecord[];
      approved_insights?: string[];
      applied_suggestions?: string[];
      language?: Language;
    },
    language?: Language,
  ) =>
    request<ApiTranscriptAnalysis>(`/sessions/${encodeURIComponent(sessionId)}/analyze-transcript-chunk`, {
      method: "POST",
      body: { ...body, language: language ?? body.language ?? "en" },
    }),
  finalizeSession: (sessionId: string, body: ApiFinalizeSessionPayload, language?: Language) =>
    request<ApiFinalizeSessionResponse>(`/sessions/${encodeURIComponent(sessionId)}/finalize-session`, {
      method: "POST",
      body: { ...body, language: language ?? body.language ?? "en" },
    }),
  getSoapNote: (sessionId: string, language: Language = "en") =>
    request<ApiSoapNoteResponse>(`/soap-notes/${encodeURIComponent(sessionId)}?language=${encodeURIComponent(language)}`),
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
  soapNotes: (sessionId: string, language: Language = "en") =>
    request<ApiSoapNoteResponse>(`/soap-notes/${encodeURIComponent(sessionId)}?language=${encodeURIComponent(language)}`),
  updateSoapNotes: (sessionId: string, body: SoapData, language: Language = "en") =>
    request<SoapData>(`/soap-notes/${encodeURIComponent(sessionId)}?language=${encodeURIComponent(language)}`, {
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
  getClaimDocument: async (sessionId: string, language: Language = "en") => {
    try {
      return await getClaimDocument(sessionId, language);
    } catch (error) {
      if (isDevelopment) {
        console.warn("[Medexa API] Falling back to local claim data.", error);
      }
      return null;
    }
  },
  verifyClaimDocument: async (sessionId: string, language: Language = "en") => {
    try {
      return await verifyClaimDocument(sessionId, language);
    } catch (error) {
      if (isDevelopment) {
        console.warn("[Medexa API] Claim verification failed.", error);
      }
      return null;
    }
  },
  get837PDraft: async (sessionId: string, language: Language = "en") => {
    try {
      return await get837PDraft(sessionId, language);
    } catch (error) {
      if (isDevelopment) {
        console.warn("[Medexa API] 837P draft fetch failed.", error);
      }
      return null;
    }
  },
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
  saveClaimDraft: (sessionId: string, payload?: Record<string, unknown>, language: Language = "en") =>
    payload
      ? saveClaimDraft(sessionId, payload).catch((error) => {
          if (isDevelopment) {
            console.warn("[Medexa API] Claim draft save failed.", error, language);
          }
          return null;
        })
      : request<ApiClaim>(`/claims/${encodeURIComponent(sessionId)}/save-draft`, { method: "POST" }),
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

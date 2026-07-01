"use client";

import { type ChangeEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MedexaHeader from "@/components/MedexaHeader";
import { useLanguage } from "@/context/LanguageContext";
import { type SoapData, useSessionDocumentation } from "@/context/SessionDocumentationContext";
import { useWebSpeechSession } from "@/hooks/useWebSpeechSession";
import {
  apiSessionToUpcomingSession,
  medexaApi,
  type ApiCptRecord,
  type ApiCptTimerSuggestion,
  type ApiInsight,
  type ApiLiveSuggestion,
  type ApiSuggestion,
  type ApiTranscriptAnalysis,
} from "@/lib/api";
import { setActiveSessionId } from "@/lib/activeSession";
import { analyzeClinicalTranscript, type ClinicalAnalysis } from "@/lib/clinicalAnalyzer";
import { detectCptFromText } from "@/lib/cptDetector";
import { getSessionById } from "@/lib/sessions";
import { detectMedexaCommand } from "@/lib/voiceCommands";

/* eslint-disable @next/next/no-img-element -- Prototype uses remote avatar URLs without touching next.config.ts. */

console.log("[Frontend CPT] detector imported");

const defaultInsights = [
  {
    id: "family-history",
    tag: "Protocol Ask",
    text: "Does anyone in your family have diabetes or vascular issues?",
    label: "Detected",
    tone: "protocol",
    note: "Patient reports persistent fatigue and lower back pain for 3 weeks.",
  },
  {
    id: "therapeutic-activity",
    tag: "Billing",
    text: "97530 - Therapeutic Act. detected add CPT for the session?",
    label: "Billing",
    tone: "billing",
    note: "Therapeutic activity timing crossed a billable threshold.",
  },
  {
    id: "activity-level",
    tag: "Protocol Ask",
    text: "How often do you engage in physical activity each week?",
    label: "Billing",
    tone: "protocol",
    note: "Prompt patient for weekly activity level before closing intake.",
  },
  {
    id: "manual-techniques",
    tag: "Protocol Ask",
    text: "Manual techniques detected, add CPT 97140 for the session?",
    label: "Billing",
    tone: "billing",
    note: "Manual therapy techniques were detected during the session.",
  },
];

const defaultSuggestions = [
  {
    id: "unit-recorded",
    title: "Unit Recorded",
    text: "1 unit recorded for 97110 - Therapeutic Ex. at 8:04",
  },
  {
    id: "modifier-59",
    title: "Modifier 59 Required",
    text: "Potential Bundle conflict detected for 97112 with 97110. Apply modifier?",
  },
  {
    id: "snf-validation",
    title: "SNF Validation Alert",
    text: "Section GG mobility scores differ from nursing log",
  },
];

type InsightState = {
  approved?: boolean;
  ignored?: boolean;
  selected?: boolean;
};

type InsightItem = (typeof defaultInsights)[number];
type SuggestionItem = (typeof defaultSuggestions)[number];

type RecordingStatus = "idle" | "recording" | "paused" | "stopped";

type CptTimerStatus = "idle" | "running" | "paused" | "stopped";

type LocalCptTimer = {
  active: boolean;
  code: string | null;
  seconds: number;
  units: number;
  nextUnitAtSeconds: number;
  secondsLeftToNextUnit: number;
  status: CptTimerStatus;
  source?: "manual" | "ai_suggested" | null;
  reason?: string | null;
};

type AiSummarySegment = {
  id: string;
  startTime: string;
  endTime: string;
  transcriptExcerpt: string;
  analysis: ClinicalAnalysis;
  status: "Generated";
};

type CptPopupSuggestion = ApiCptTimerSuggestion & {
  code: string;
  display_name: string | null;
};

const INITIAL_RECORDING_SECONDS = 0;

const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const cptUnitsFromSeconds = (totalSeconds: number) => {
  if (totalSeconds < 8 * 60) {
    return 0;
  }

  if (totalSeconds < 23 * 60) {
    return 1;
  }

  if (totalSeconds < 38 * 60) {
    return 2;
  }

  if (totalSeconds < 53 * 60) {
    return 3;
  }

  if (totalSeconds < 68 * 60) {
    return 4;
  }

  return 5 + Math.floor((totalSeconds - 68 * 60) / (15 * 60));
};

const nextCptUnitAt = (totalSeconds: number) => {
  const thresholds = [8 * 60, 23 * 60, 38 * 60, 53 * 60, 68 * 60];
  const nextThreshold = thresholds.find((threshold) => totalSeconds < threshold);

  if (nextThreshold) {
    return nextThreshold;
  }

  return 68 * 60 + (Math.floor((totalSeconds - 68 * 60) / (15 * 60)) + 1) * 15 * 60;
};

const createLocalCptTimer = (
  status: CptTimerStatus = "idle",
  seconds = 0,
  code: string | null = null,
  source: LocalCptTimer["source"] = null,
  reason: string | null = null,
): LocalCptTimer => {
  const nextUnitAtSeconds = nextCptUnitAt(seconds);

  return {
    active: status === "running",
    code,
    seconds,
    units: cptUnitsFromSeconds(seconds),
    nextUnitAtSeconds,
    secondsLeftToNextUnit: Math.max(nextUnitAtSeconds - seconds, 0),
    status,
    source,
    reason,
  };
};

const summarizeBillingCaveats = (billingCaveats: Record<string, unknown>) =>
  Object.entries(billingCaveats)
    .map(([key, value]) => {
      if (typeof value === "string") {
        return `${key.replace(/_/g, " ")}: ${value}`;
      }

      if (Array.isArray(value)) {
        return `${key.replace(/_/g, " ")}: ${value.join(", ")}`;
      }

      if (value && typeof value === "object") {
        return `${key.replace(/_/g, " ")}: ${Object.values(value as Record<string, unknown>).join("; ")}`;
      }

      return "";
    })
    .filter(Boolean)
    .slice(0, 3);

const apiInsightToInsight = (insight: ApiInsight): InsightItem => ({
  id: insight.id,
  tag: insight.type === "billing" ? "Billing" : insight.type === "protocol" ? "Protocol Ask" : "Detected",
  text: insight.question,
  label: insight.label,
  tone: insight.type === "billing" ? "billing" : "protocol",
  note: insight.description,
});

const apiSuggestionToSuggestion = (suggestion: ApiSuggestion): SuggestionItem => ({
  id: suggestion.id,
  title: suggestion.title,
  text: suggestion.text,
});

const apiLiveSuggestionToSuggestion = (suggestion: ApiLiveSuggestion): SuggestionItem => ({
  id: suggestion.id,
  title: suggestion.title,
  text: suggestion.description,
});

const apiLiveSuggestionToInsight = (suggestion: ApiLiveSuggestion): InsightItem => ({
  id: suggestion.id,
  tag:
    suggestion.type === "billing"
      ? "Billing"
      : suggestion.type === "protocol"
        ? "Protocol Ask"
        : "Detected",
  text: suggestion.description,
  label: suggestion.type === "billing" ? "Billing" : "AI-assisted suggestion",
  tone: suggestion.type === "billing" ? "billing" : "protocol",
  note: `${suggestion.title}. Requires clinician review.`,
});

const mergeWithPrototypeInsights = (items: InsightItem[]) => {
  const prototypeIds = new Set(defaultInsights.map((item) => item.id));
  return [...defaultInsights, ...items.filter((item) => !prototypeIds.has(item.id))];
};

const mergeWithPrototypeSuggestions = (items: SuggestionItem[]) => {
  const prototypeIds = new Set(defaultSuggestions.map((item) => item.id));
  return [...defaultSuggestions, ...items.filter((item) => !prototypeIds.has(item.id))];
};

const mergeItemsById = <T extends { id: string }>(currentItems: T[], nextItems: T[]) => {
  const byId = new Map(currentItems.map((item) => [item.id, item]));
  nextItems.forEach((item) => {
    byId.set(item.id, { ...byId.get(item.id), ...item });
  });
  return Array.from(byId.values());
};

const detectInstantCpt = (text: string): CptPopupSuggestion[] => {
  return detectCptFromText(text).filter((suggestion): suggestion is CptPopupSuggestion =>
    Boolean(suggestion.should_start && suggestion.code),
  );
};

const detectLocalCptSuggestions = detectInstantCpt;

const apiAnalysisToClinicalAnalysis = (backendAnalysis: ApiTranscriptAnalysis): ClinicalAnalysis => ({
  summary: backendAnalysis.summary,
  possibleDiagnoses: backendAnalysis.possible_clinical_impressions ?? backendAnalysis.possible_diagnoses,
  icd10Suggestions: (backendAnalysis.icd10_suggestions ?? []).map((suggestion) => ({
    phrase: suggestion.phrase,
    code: suggestion.code,
    reason: suggestion.reason,
    confidence: suggestion.confidence,
  })),
  bodyRegions: (backendAnalysis.body_regions ?? []).map((region) => ({
    phrase: region.phrase,
    region: region.region,
  })),
  cptSuggestions: (backendAnalysis.cpt_suggestions ?? []).map((suggestion) => ({
    code: suggestion.code,
    label: suggestion.label,
    displayName: suggestion.display_name,
    descriptor: suggestion.descriptor,
    matchedPhrases: suggestion.matched_phrases,
    documentationRequirements: suggestion.documentation_requirements,
    billingCaveats: suggestion.billing_caveats,
    reason: suggestion.reason,
    confidence: suggestion.confidence,
  })),
  ncciConflicts: (backendAnalysis.ncci_conflicts ?? []).map((conflict) => ({
    cptA: conflict.cpt_a,
    cptB: conflict.cpt_b,
    conflictType: conflict.conflict_type,
    bodyRegionSensitive: conflict.body_region_sensitive,
    modifier59Possible: conflict.modifier_59_possible,
    explanation: conflict.explanation,
    severity: conflict.severity,
  })),
  symptoms: backendAnalysis.symptoms,
  soapUpdate: backendAnalysis.soap_update,
  billingHints: backendAnalysis.billing_hints,
  confidence: backendAnalysis.confidence,
  disclaimer: backendAnalysis.disclaimer ?? "AI-assisted suggestions require clinician review.",
});

function SlideToApprove({
  approved,
  onApprove,
  label,
  approvedLabel,
}: {
  approved: boolean;
  onApprove: () => void;
  label: string;
  approvedLabel: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStartXRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const [progress, setProgress] = useState(approved ? 1 : 0);
  const [handleTravel, setHandleTravel] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const updateHandleTravel = () => {
      const track = trackRef.current;

      if (!track) {
        return;
      }

      const handleSize = 24;
      const sideOffset = 5;
      setHandleTravel(Math.max(track.getBoundingClientRect().width - handleSize - sideOffset * 2, 1));
    };

    updateHandleTravel();
    window.addEventListener("resize", updateHandleTravel);

    return () => {
      window.removeEventListener("resize", updateHandleTravel);
    };
  }, []);

  useEffect(() => {
    setProgress(approved ? 1 : 0);
  }, [approved]);

  const updateProgressFromClientX = (clientX: number) => {
    const track = trackRef.current;

    if (!track) {
      return 0;
    }

    const rect = track.getBoundingClientRect();
    const handleSize = 24;
    const sideOffset = 5;
    const maxTravel = Math.max(rect.width - handleSize - sideOffset * 2, 1);
    setHandleTravel(maxTravel);
    const nextProgress = Math.min(
      Math.max((clientX - rect.left - sideOffset - handleSize / 2) / maxTravel, 0),
      1,
    );

    setProgress(nextProgress);
    return nextProgress;
  };

  const completeApproval = () => {
    setProgress(1);
    onApprove();
  };

  const finishDrag = (nextProgress = progress) => {
    setIsDragging(false);

    if (approved) {
      setProgress(1);
      return;
    }

    if (nextProgress >= 0.8) {
      completeApproval();
      return;
    }

    setProgress(0);
  };

  return (
    <div
      ref={trackRef}
      className={`approve-slider ${approved ? "is-approved" : ""} ${isDragging ? "is-dragging" : ""}`}
      role="slider"
      tabIndex={approved ? -1 : 0}
      aria-label={approved ? approvedLabel : label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-disabled={approved}
      onPointerDown={(event) => {
        if (approved) {
          return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        dragStartXRef.current = event.clientX;
        hasDraggedRef.current = false;
        setIsDragging(true);
      }}
      onPointerMove={(event) => {
        if (!isDragging || approved) {
          return;
        }

        if (Math.abs(event.clientX - dragStartXRef.current) < 4 && !hasDraggedRef.current) {
          return;
        }

        hasDraggedRef.current = true;
        updateProgressFromClientX(event.clientX);
      }}
      onPointerUp={(event) => {
        if (!isDragging || approved) {
          return;
        }

        if (!hasDraggedRef.current) {
          finishDrag(0);
          return;
        }

        finishDrag(updateProgressFromClientX(event.clientX));
      }}
      onPointerCancel={() => finishDrag(0)}
      onKeyDown={(event) => {
        if (approved) {
          return;
        }

        if (event.key === "ArrowRight" || event.key === "End") {
          event.preventDefault();
          completeApproval();
        }

        if (event.key === "ArrowLeft" || event.key === "Home") {
          event.preventDefault();
          setProgress(0);
        }
      }}
    >
      <span
        className="approve-slider-handle"
        style={{ transform: `translateX(${progress * handleTravel}px)` }}
      >
        {approved ? "✓" : "›"}
      </span>
      <span className="approve-slider-label">{approved ? approvedLabel : label}</span>
    </div>
  );
}

export default function AmbientSessionPage() {
  return (
    <Suspense fallback={null}>
      <AmbientSessionContent />
    </Suspense>
  );
}

function AmbientSessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [insightStates, setInsightStates] = useState<Record<string, InsightState>>({});
  const [appliedSuggestions, setAppliedSuggestions] = useState<Record<string, boolean>>({});
  const [ignoredSuggestions, setIgnoredSuggestions] = useState<Record<string, boolean>>({});
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(INITIAL_RECORDING_SECONDS);
  const [cptTimer, setCptTimer] = useState<LocalCptTimer>(() => createLocalCptTimer());
  const [cptRecords, setCptRecords] = useState<Record<string, ApiCptRecord>>({});
  const [activeCptCode, setActiveCptCode] = useState<string | null>(null);
  const activeCptCodeRef = useRef<string | null>(null);
  const [cptPopupQueue, setCptPopupQueue] = useState<CptPopupSuggestion[]>([]);
  const [currentCptPopup, setCurrentCptPopup] = useState<CptPopupSuggestion | null>(null);
  const currentCptPopupRef = useRef<CptPopupSuggestion | null>(null);
  const cptPopupQueueRef = useRef<CptPopupSuggestion[]>([]);
  const [manualLiveTranscriptText, setManualLiveTranscriptText] = useState("");
  const [cptDebugText, setCptDebugText] = useState("");
  const [cptDebugMatches, setCptDebugMatches] = useState<CptPopupSuggestion[]>([]);
  const [backendRulesStatus, setBackendRulesStatus] = useState("unchecked");
  const [triggerStatus, setTriggerStatus] = useState<"waiting" | "armed" | "detected">("waiting");
  const [cptDetectionStatus, setCptDetectionStatus] = useState("Waiting");
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const routeSessionId = searchParams.get("sessionId") ?? searchParams.get("id") ?? searchParams.get("session") ?? "";
  const shouldAutoStartRecording = searchParams.get("autoStartRecording") === "1" && searchParams.get("source") === "voice";
  const localRouteSession = getSessionById(routeSessionId);
  const sessionId = routeSessionId || localRouteSession.id;
  const [selectedSession, setSelectedSession] = useState(localRouteSession);
  const [insightItems, setInsightItems] = useState<InsightItem[]>(defaultInsights);
  const [suggestionItems, setSuggestionItems] = useState<SuggestionItem[]>(defaultSuggestions);
  const [aiSummarySegments, setAiSummarySegments] = useState<AiSummarySegment[]>([]);
  const [generatedSoapSuggestions, setGeneratedSoapSuggestions] = useState<string[]>([]);
  const [audioUploadStatus, setAudioUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [audioUploadError, setAudioUploadError] = useState("");
  const [uploadedAudioTranscript, setUploadedAudioTranscript] = useState("");
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lastAnalyzedSecondRef = useRef(0);
  const recordingSecondsRef = useRef(INITIAL_RECORDING_SECONDS);
  const isGeneratingSegmentRef = useRef(false);
  const rejectedCptPopupRef = useRef<Record<string, number>>({});
  const appliedCptCodesRef = useRef<Set<string>>(new Set());
  const lastTriggerAtRef = useRef(0);
  const lastTriggerCommandRef = useRef("");
  const triggerCooldownMs = 3000;
  const latestDetectedCptSuggestionsRef = useRef<ApiTranscriptAnalysis["cpt_suggestions"]>([]);
  const latestDetectedIcdSuggestionsRef = useRef<ApiTranscriptAnalysis["icd10_suggestions"]>([]);
  const latestNcciConflictsRef = useRef<ApiTranscriptAnalysis["ncci_conflicts"]>([]);
  const latestHeardTextRef = useRef("");
  const fullTranscriptRef = useRef("");
  const autoStartHandledRef = useRef(false);
  const { updateSoapData } = useSessionDocumentation();
  const { t } = useLanguage();
  const speechSession = useWebSpeechSession();
  const { consumeCurrentChunkTranscript, getCurrentChunkTranscript } = speechSession;
  const fullTranscript = speechSession.liveTranscript;
  const lastHeardText = speechSession.lastHeardText;
  const currentThirtySecondChunk = speechSession.currentChunkTranscript;
  const aiSegmentsStorageKey = useMemo(
    () => `medexa_session_ai_segments_${sessionId}`,
    [sessionId],
  );

  useEffect(() => {
    speechSession.autoStartTriggerMode();
    setTriggerStatus("armed");
  }, [speechSession.autoStartTriggerMode]);

  useEffect(() => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    if (!apiBaseUrl) {
      setBackendRulesStatus("local fallback");
      return;
    }

    fetch(`${apiBaseUrl.replace(/\/+$/g, "")}/debug/rules-health`)
      .then((response) => (response.ok ? response.json() : null))
      .then((health) => {
        if (!health?.files) {
          setBackendRulesStatus("unavailable");
          return;
        }

        const cptPhraseMap = health.files["cpt_phrase_map.json"];
        const cptRules = health.files["cpt_rules.json"];
        setBackendRulesStatus(
          cptPhraseMap?.exists && cptRules?.exists
            ? `ok (${cptPhraseMap.count}/${cptRules.count})`
            : "missing rules",
        );
      })
      .catch(() => setBackendRulesStatus("unavailable"));
  }, []);

  useEffect(() => {
    const localSession = getSessionById(routeSessionId);
    setSelectedSession(localSession);
    setActiveSessionId(routeSessionId || localSession.id);
  }, [routeSessionId]);

  useEffect(() => {
    lastAnalyzedSecondRef.current = 0;

    try {
      const storedSegments = window.localStorage.getItem(aiSegmentsStorageKey);
      const parsedSegments = storedSegments ? (JSON.parse(storedSegments) as AiSummarySegment[]) : [];
      setAiSummarySegments(Array.isArray(parsedSegments) ? parsedSegments : []);
      setGeneratedSoapSuggestions(
        Array.isArray(parsedSegments)
          ? parsedSegments.map((segment) => segment.analysis.soapUpdate.plan)
          : [],
      );
    } catch {
      window.localStorage.removeItem(aiSegmentsStorageKey);
      setAiSummarySegments([]);
      setGeneratedSoapSuggestions([]);
    }
  }, [aiSegmentsStorageKey]);

  useEffect(() => {
    recordingSecondsRef.current = recordingSeconds;
  }, [recordingSeconds]);

  useEffect(() => {
    activeCptCodeRef.current = activeCptCode;
  }, [activeCptCode]);

  useEffect(() => {
    window.localStorage.setItem(aiSegmentsStorageKey, JSON.stringify(aiSummarySegments));
  }, [aiSegmentsStorageKey, aiSummarySegments]);

  useEffect(() => {
    currentCptPopupRef.current = currentCptPopup;
    console.log("[Medexa CPT] current popup", currentCptPopup);
  }, [currentCptPopup]);

  useEffect(() => {
    cptPopupQueueRef.current = cptPopupQueue;
  }, [cptPopupQueue]);

  useEffect(() => {
    if (currentCptPopup || cptPopupQueue.length === 0) {
      return;
    }

    const [nextPopup, ...remainingQueue] = cptPopupQueue;
    console.log("[Medexa CPT] showing popup", nextPopup.code);
    currentCptPopupRef.current = nextPopup;
    cptPopupQueueRef.current = remainingQueue;
    setCurrentCptPopup(nextPopup);
    setCptPopupQueue(remainingQueue);
  }, [cptPopupQueue, currentCptPopup]);

  // Acceptance flow: therapeutic exercise -> popup 97110 -> Apply; gait training while
  // 97110 is running -> popup 97116 immediately -> Apply; manual therapy while 97116 is
  // running -> popup 97140 immediately.
  const queueOrShowCptPopup = useCallback((suggestion: CptPopupSuggestion) => {
    if (!suggestion?.code) {
      return;
    }

    const now = Date.now();
    const rejectedUntil = rejectedCptPopupRef.current[suggestion.code] || 0;

    if (rejectedUntil > now) {
      console.log("[Medexa CPT DEBUG] rejected cooldown active", suggestion.code);
      return;
    }

    if (suggestion.code === activeCptCodeRef.current) {
      console.log("[Medexa CPT DEBUG] same as active CPT, ignoring duplicate", suggestion.code);
      return;
    }

    console.log("[Medexa CPT DEBUG] activeCptCode", activeCptCodeRef.current);
    console.log("[Medexa CPT DEBUG] current popup", currentCptPopupRef.current);
    console.log("[Medexa CPT DEBUG] show or queue popup", suggestion);

    setCurrentCptPopup((current) => {
      if (current) {
        setCptPopupQueue((queue) => {
          if (queue.some((item) => item.code === suggestion.code)) {
            return queue;
          }

          const nextQueue = [...queue, suggestion];
          cptPopupQueueRef.current = nextQueue;
          console.log("[Medexa CPT DEBUG] queue", nextQueue);
          return nextQueue;
        });
        setCptDetectionStatus(`Detected ${suggestion.code}`);
        return current;
      }

      currentCptPopupRef.current = suggestion;
      console.log("[Medexa CPT DEBUG] showing popup", suggestion.code);
      setCptDetectionStatus(`Detected ${suggestion.code}`);
      return suggestion;
    });
  }, []);

  const enqueueCptPopups = useCallback((suggestions: ApiCptTimerSuggestion[]) => {
    const normalizedSuggestions = suggestions
      .filter((suggestion): suggestion is CptPopupSuggestion =>
        Boolean(suggestion.should_start && suggestion.code),
      )
      .map((suggestion) => ({
        ...suggestion,
        code: suggestion.code,
        display_name: suggestion.display_name ?? null,
      }));

    normalizedSuggestions.forEach((suggestion) => {
      queueOrShowCptPopup(suggestion);
    });
  }, [queueOrShowCptPopup]);

  const showNextQueuedCptPopup = useCallback(() => {
    setCptPopupQueue((queue) => {
      const [nextPopup, ...remainingQueue] = queue;
      cptPopupQueueRef.current = remainingQueue;

      window.setTimeout(() => {
        currentCptPopupRef.current = nextPopup ?? null;
        setCurrentCptPopup(nextPopup ?? null);
        if (nextPopup) {
          console.log("[Medexa CPT DEBUG] showing popup", nextPopup.code);
        }
      }, 0);

      return remainingQueue;
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const [apiSession, apiState, apiTimerState, apiInsights, apiSuggestions] = await Promise.all([
        medexaApi.session(sessionId),
        medexaApi.sessionState(sessionId),
        medexaApi.getTimerState(sessionId),
        medexaApi.insights(sessionId),
        medexaApi.suggestions(sessionId),
      ]);

      if (!isMounted) {
        return;
      }

      if (apiSession) {
        setSelectedSession(apiSessionToUpcomingSession(apiSession));
      }

      if (apiState) {
        const loadedStatus = apiState.status === "recording" || apiState.status === "paused" ? "idle" : apiState.status;
        setRecordingStatus(loadedStatus);
        setRecordingSeconds(loadedStatus === "idle" ? INITIAL_RECORDING_SECONDS : apiState.elapsedSeconds);
      }

      if (apiTimerState) {
        const loadedStatus =
          apiTimerState.recording_status === "recording" || apiTimerState.recording_status === "paused"
            ? "idle"
            : apiTimerState.recording_status;
        setRecordingStatus(loadedStatus);
        setRecordingSeconds(loadedStatus === "idle" ? INITIAL_RECORDING_SECONDS : apiTimerState.total_seconds);
        setCptTimer(
          loadedStatus === "idle"
            ? createLocalCptTimer()
            : createLocalCptTimer(
                apiTimerState.cpt_timer.status,
                apiTimerState.cpt_timer.seconds,
                apiTimerState.cpt_timer.code,
                apiTimerState.cpt_timer.source,
                apiTimerState.cpt_timer.reason,
              ),
        );
        if (loadedStatus === "idle") {
          setActiveCptCode(null);
          setCptRecords({});
        } else if (apiTimerState.cpt_records?.length) {
          setCptRecords(Object.fromEntries(apiTimerState.cpt_records.map((record) => [record.code, record])));
          const runningRecord = apiTimerState.cpt_records.find((record) => record.status === "running");
          setActiveCptCode(runningRecord?.code ?? null);
        } else if (apiTimerState.cpt_timer.code) {
          setActiveCptCode(apiTimerState.cpt_timer.status === "running" ? apiTimerState.cpt_timer.code : null);
          setCptRecords({
            [apiTimerState.cpt_timer.code]: {
              code: apiTimerState.cpt_timer.code,
              displayName: apiTimerState.cpt_timer.code,
              seconds: apiTimerState.cpt_timer.seconds,
              units: apiTimerState.cpt_timer.units,
              status: apiTimerState.cpt_timer.status === "running" ? "running" : "stopped",
              source: apiTimerState.cpt_timer.source ?? "manual",
              intervals: [],
              reason: apiTimerState.cpt_timer.reason ?? "",
            },
          });
        }
      }

      if (apiInsights) {
        setInsightItems(mergeWithPrototypeInsights(apiInsights.map(apiInsightToInsight)));
        setInsightStates({});
      }

      if (apiSuggestions) {
        setSuggestionItems(mergeWithPrototypeSuggestions(apiSuggestions.map(apiSuggestionToSuggestion)));
        setAppliedSuggestions(
          Object.fromEntries(
            apiSuggestions.map((suggestion) => [suggestion.id, suggestion.applied]),
          ),
        );
      }
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const query = searchQuery.trim().toLowerCase();
  const filteredInsights = useMemo(() => {
    const visibleItems = insightItems.filter((item) => !insightStates[item.id]?.ignored);

    if (!query) {
      return visibleItems;
    }

    return visibleItems.filter((item) =>
      [item.tag, item.text, item.label, item.note]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [insightItems, insightStates, query]);

  useEffect(() => {
    if (recordingStatus !== "recording") {
      return;
    }

    const timerId = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
      setCptTimer((timer) =>
        timer.status === "running"
          ? createLocalCptTimer("running", timer.seconds + 1, timer.code, timer.source, timer.reason)
          : timer,
      );
      setCptRecords((records) => {
        if (!activeCptCode || !records[activeCptCode] || records[activeCptCode].status !== "running") {
          return records;
        }

        const activeRecord = records[activeCptCode];
        const nextSeconds = activeRecord.seconds + 1;
        return {
          ...records,
          [activeCptCode]: {
            ...activeRecord,
            seconds: nextSeconds,
            units: cptUnitsFromSeconds(nextSeconds),
          },
        };
      });
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [activeCptCode, recordingStatus]);

  useEffect(() => {
    const transcriptForCptDetection = [
      speechSession.lastHeardText,
      speechSession.interimTranscript,
      speechSession.currentChunkTranscript,
      speechSession.liveTranscript,
      speechSession.finalTranscript,
      latestHeardTextRef.current,
      fullTranscriptRef.current,
      manualLiveTranscriptText,
      lastHeardText,
      fullTranscript,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    latestHeardTextRef.current = speechSession.lastHeardText || speechSession.interimTranscript || lastHeardText;
    fullTranscriptRef.current = speechSession.liveTranscript || fullTranscript;
    setCptDebugText(transcriptForCptDetection);

    if (recordingStatus !== "recording") {
      console.log("[Medexa CPT DEBUG] skipped because recordingStatus:", recordingStatus);
      setCptDebugMatches([]);
      return;
    }

    if (!transcriptForCptDetection.trim()) {
      console.log("[Medexa CPT DEBUG] no transcript available yet");
      setCptDebugMatches([]);
      return;
    }

    const instantCptSuggestions = detectInstantCpt(transcriptForCptDetection);
    setCptDebugMatches(instantCptSuggestions);

    console.log("[Medexa CPT] transcriptForCptDetection", transcriptForCptDetection);
    console.log("[Medexa CPT] matches", instantCptSuggestions);
    console.log("[Frontend CPT] transcript:", transcriptForCptDetection);
    console.log("[Frontend CPT] matches:", instantCptSuggestions);
    console.log("[Medexa CPT DEBUG] transcriptForCptDetection:", transcriptForCptDetection);
    console.log("[Medexa CPT DEBUG] matches:", instantCptSuggestions);

    if (instantCptSuggestions.length > 0) {
      enqueueCptPopups(instantCptSuggestions);
      const localSuggestionItems = instantCptSuggestions.map((suggestion) => ({
        id: `instant-cpt-${suggestion.code}`,
        title: `Suggested CPT ${suggestion.code}`,
        text: `${suggestion.display_name ?? suggestion.code} detected from live speech. ${suggestion.reason} Requires clinician review.`,
      }));
      const localInsightItems = instantCptSuggestions.map((suggestion) => ({
        id: `instant-cpt-${suggestion.code}`,
        tag: "Billing",
        text: `Suggested CPT ${suggestion.code} - ${suggestion.display_name ?? suggestion.code}. Apply to start CPT timer.`,
        label: "Billing",
        tone: "billing",
        note: `${suggestion.reason} Requires clinician review.`,
      }));

      setSuggestionItems((items) =>
        mergeItemsById(
          items.filter((item) => !defaultSuggestions.some((defaultItem) => defaultItem.id === item.id)),
          localSuggestionItems,
        ),
      );
      setInsightItems((items) =>
        mergeItemsById(
          items.filter((item) => !defaultInsights.some((defaultItem) => defaultItem.id === item.id)),
          localInsightItems,
        ),
      );
    }
  }, [
    currentThirtySecondChunk,
    enqueueCptPopups,
    fullTranscript,
    lastHeardText,
    recordingStatus,
    speechSession.currentChunkTranscript,
    speechSession.finalTranscript,
    speechSession.interimTranscript,
    speechSession.lastHeardText,
    speechSession.liveTranscript,
    manualLiveTranscriptText,
  ]);

  const createAiSummarySegment = useCallback(
    async (endSeconds: number, providedChunkText?: string) => {
      if (isGeneratingSegmentRef.current) {
        return;
      }

      isGeneratingSegmentRef.current = true;
      try {
        const chunkText = (providedChunkText ?? consumeCurrentChunkTranscript()).trim();

        if (!chunkText) {
          lastAnalyzedSecondRef.current = endSeconds;
          return;
        }

        const startTime = formatDuration(lastAnalyzedSecondRef.current);
        const endTime = formatDuration(endSeconds);
        const backendAnalysis = await medexaApi.analyzeTranscriptChunk(sessionId, {
          chunk_text: chunkText,
          full_transcript: fullTranscript,
          start_time: startTime,
          end_time: endTime,
          existing_cpt_codes: Object.keys(cptRecords),
          active_cpt_code: activeCptCode,
          approved_insights: insightItems
            .filter((item) => insightStates[item.id]?.approved && !insightStates[item.id]?.ignored)
            .map((item) => item.note || item.text),
          applied_suggestions: suggestionItems
            .filter((item) => appliedSuggestions[item.id])
            .map((item) => item.text),
        });
        console.log("[Medexa] backend analysis", backendAnalysis);
        const analysis: ClinicalAnalysis = backendAnalysis
          ? apiAnalysisToClinicalAnalysis(backendAnalysis)
          : analyzeClinicalTranscript(chunkText);

        const detectedCptSuggestions = backendAnalysis?.cpt_suggestions ?? analysis.cptSuggestions.map((suggestion) => ({
          code: suggestion.code,
          label: suggestion.label,
          display_name: suggestion.displayName,
          descriptor: suggestion.descriptor,
          matched_phrases: suggestion.matchedPhrases,
          documentation_requirements: suggestion.documentationRequirements,
          billing_caveats: suggestion.billingCaveats,
          reason: suggestion.reason,
          confidence: suggestion.confidence,
        }));
        latestDetectedCptSuggestionsRef.current = mergeItemsById(
          (latestDetectedCptSuggestionsRef.current ?? []).map((suggestion) => ({ id: suggestion.code, ...suggestion })),
          detectedCptSuggestions.map((suggestion) => ({ id: suggestion.code, ...suggestion })),
        ).map(({ id: _id, ...suggestion }) => suggestion);

        const detectedIcdSuggestions = backendAnalysis?.icd10_suggestions ?? analysis.icd10Suggestions.map((suggestion) => ({
          phrase: suggestion.phrase,
          code: suggestion.code,
          reason: suggestion.reason,
          confidence: suggestion.confidence,
        }));
        latestDetectedIcdSuggestionsRef.current = mergeItemsById(
          (latestDetectedIcdSuggestionsRef.current ?? []).map((suggestion) => ({ id: `${suggestion.code}-${suggestion.phrase}`, ...suggestion })),
          detectedIcdSuggestions.map((suggestion) => ({ id: `${suggestion.code}-${suggestion.phrase}`, ...suggestion })),
        ).map(({ id: _id, ...suggestion }) => suggestion);

        const detectedNcciConflicts = backendAnalysis?.ncci_conflicts ?? analysis.ncciConflicts.map((conflict) => ({
          cpt_a: conflict.cptA,
          cpt_b: conflict.cptB,
          conflict_type: conflict.conflictType,
          body_region_sensitive: conflict.bodyRegionSensitive,
          modifier_59_possible: conflict.modifier59Possible,
          explanation: conflict.explanation,
          severity: conflict.severity,
        }));
        latestNcciConflictsRef.current = mergeItemsById(
          (latestNcciConflictsRef.current ?? []).map((conflict) => ({ id: `${conflict.cpt_a}-${conflict.cpt_b}`, ...conflict })),
          detectedNcciConflicts.map((conflict) => ({ id: `${conflict.cpt_a}-${conflict.cpt_b}`, ...conflict })),
        ).map(({ id: _id, ...conflict }) => conflict);

        const backendLiveSuggestions = backendAnalysis?.live_suggestions ?? [];
        if (backendLiveSuggestions.length > 0) {
          const nextSuggestions = backendLiveSuggestions.map(apiLiveSuggestionToSuggestion);
          const nextInsightItems = backendLiveSuggestions.map(apiLiveSuggestionToInsight);
          setSuggestionItems((items) =>
            mergeItemsById(
              items.filter((item) => !defaultSuggestions.some((defaultItem) => defaultItem.id === item.id)),
              nextSuggestions,
            ),
          );
          setInsightItems((items) =>
            mergeItemsById(
              items.filter((item) => !defaultInsights.some((defaultItem) => defaultItem.id === item.id)),
              nextInsightItems,
            ),
          );
        } else if (!backendAnalysis && analysis.cptSuggestions.length > 0) {
          const nextSuggestions = analysis.cptSuggestions.slice(0, 3).map((suggestion) => ({
              id: `local-cpt-${suggestion.code}`,
              title: `Suggested CPT ${suggestion.code}`,
              text: `${suggestion.displayName}. ${suggestion.reason} Requires clinician review.`,
            }));
          setSuggestionItems((items) =>
            mergeItemsById(
              items.filter((item) => !defaultSuggestions.some((defaultItem) => defaultItem.id === item.id)),
              nextSuggestions,
            ),
          );
          const nextInsightItems = nextSuggestions
              .filter((suggestion) => suggestion.id.startsWith("local-cpt-"))
              .map((suggestion) => ({
                id: suggestion.id,
                tag: "Billing",
                text: suggestion.text,
                label: "Billing",
                tone: "billing",
                note: "Procedure detected from live speech. Requires clinician review.",
              }));
          setInsightItems((items) =>
            mergeItemsById(
              items.filter((item) => !defaultInsights.some((defaultItem) => defaultItem.id === item.id)),
              nextInsightItems,
            ),
          );
        }

        const backendCptSuggestions = backendAnalysis?.cpt_timer_suggestions?.length
          ? backendAnalysis.cpt_timer_suggestions
          : backendAnalysis?.cpt_timer_suggestion?.should_start
            ? [backendAnalysis.cpt_timer_suggestion]
            : (backendAnalysis?.cpt_suggestions ?? [])
                .filter((suggestion) => suggestion.confidence === "high" || suggestion.confidence === "medium")
                .map((suggestion) => ({
                should_start: true,
                code: suggestion.code,
                display_name: suggestion.display_name,
                reason: suggestion.reason,
                confidence: suggestion.confidence,
              }));
        const localCptSuggestions = !backendAnalysis ? detectLocalCptSuggestions(chunkText) : [];
        const nextCptSuggestions = backendCptSuggestions.length > 0 ? backendCptSuggestions : localCptSuggestions;

        if (recordingStatus === "recording" && nextCptSuggestions.length > 0) {
          enqueueCptPopups(nextCptSuggestions);
        } else if (nextCptSuggestions.length === 0) {
          setCptDetectionStatus("Waiting");
        }

        const segment: AiSummarySegment = {
          id: `${sessionId}-${endSeconds}-${Date.now()}`,
          startTime,
          endTime,
          transcriptExcerpt: chunkText.slice(0, 260),
          analysis,
          status: "Generated",
        };

        setAiSummarySegments((segments) => [...segments, segment]);
        setGeneratedSoapSuggestions((suggestions) => [
          ...suggestions,
          `${analysis.soapUpdate.subjective} ${analysis.soapUpdate.objective} ${analysis.soapUpdate.assessment} ${analysis.soapUpdate.plan}`,
        ]);
        lastAnalyzedSecondRef.current = endSeconds;
      } finally {
        isGeneratingSegmentRef.current = false;
      }
    },
    [
      activeCptCode,
      appliedSuggestions,
      consumeCurrentChunkTranscript,
      cptRecords,
      enqueueCptPopups,
      fullTranscript,
      insightItems,
      insightStates,
      recordingStatus,
      sessionId,
      suggestionItems,
    ],
  );

  useEffect(() => {
    if (recordingStatus !== "recording") {
      return;
    }

    const summaryTimerId = window.setInterval(() => {
      void createAiSummarySegment(Math.max(recordingSecondsRef.current, lastAnalyzedSecondRef.current + 10));
    }, 10000);

    return () => {
      window.clearInterval(summaryTimerId);
    };
  }, [createAiSummarySegment, recordingStatus]);

  const filteredSuggestions = useMemo(() => {
    if (!query) {
      return suggestionItems.filter((item) => !ignoredSuggestions[item.id]);
    }

    return suggestionItems.filter((item) =>
      !ignoredSuggestions[item.id] &&
      [item.title, item.text].join(" ").toLowerCase().includes(query),
    );
  }, [ignoredSuggestions, query, suggestionItems]);

  const saveSoapDocumentation = (
    nextInsightStates = insightStates,
    nextAppliedSuggestions = appliedSuggestions,
  ) => {
    const activeInsights = insightItems.filter(
      (item) =>
        (nextInsightStates[item.id]?.approved || nextInsightStates[item.id]?.selected) &&
        !nextInsightStates[item.id]?.ignored,
    );
    const protocolInsights = activeInsights.filter((item) => item.tone === "protocol");
    const billingInsights = activeInsights.filter(
      (item) => item.tone === "billing" || item.label === "Billing",
    );
    const appliedSuggestionNotes = suggestionItems
      .filter((item) => nextAppliedSuggestions[item.id])
      .map((item) => item.text);
    const protocolSummary = protocolInsights.map((item) => item.note).join(" ");
    const billingSummary = [...billingInsights.map((item) => item.text), ...appliedSuggestionNotes]
      .filter(Boolean)
      .join(" ");
    const sessionDuration = recordingSeconds > 0 ? formatDuration(recordingSeconds) : selectedSession.time;
    const generatedSoapData: SoapData = {
      subjective: {
        chiefComplaint:
          protocolSummary ||
          `${selectedSession.name} reports persistent fatigue with lower back discomfort during the current ${selectedSession.careType.toLowerCase()} encounter.`,
        painScale: selectedSession.icd.startsWith("M") ? "6" : "4",
        duration: protocolSummary ? "3 weeks" : "Current session",
      },
      objective: {
        observationNotes:
          `Live session documentation for ${selectedSession.name}: therapeutic activity and clinical prompts were reviewed over ${sessionDuration}. ` +
          (protocolSummary || "Patient participation and symptom tolerance were monitored during the session."),
        rangeOfMotion: selectedSession.icd.startsWith("M") ? "Lumbar mobility guarded" : "Functional mobility monitored",
        affect: "Alert, cooperative",
        vitalSigns: "Vital signs within normal limits",
      },
      assessment: {
        diagnosisSummary:
          `${selectedSession.careType} encounter associated with ${selectedSession.icd}. ` +
          (billingSummary || "Clinical findings support continued monitoring and skilled intervention."),
        primaryDiagnosisCode: selectedSession.icd,
        severity: selectedSession.icd.startsWith("M") ? "Moderate" : "Stable",
      },
      plan: {
        followUpPlan:
          "Continue skilled session documentation, address protocol prompts, and reassess functional tolerance at the next visit. " +
          (appliedSuggestionNotes.length > 0
            ? `Applied recommendations: ${appliedSuggestionNotes.join(" ")}`
            : "Review billing and diagnosis suggestions before claim creation."),
      },
    };

    updateSoapData(generatedSoapData);
    setStatusMessage(t("session.soapSaved"));
    return generatedSoapData;
  };

  const updateInsight = (id: string, nextState: InsightState, message: string) => {
    const nextInsightStates = {
      ...insightStates,
      [id]: {
        ...insightStates[id],
        ...nextState,
      },
    };

    setInsightStates(nextInsightStates);

    if (nextState.approved) {
      medexaApi.approveInsight(sessionId, id);
      saveSoapDocumentation(nextInsightStates, appliedSuggestions);
    } else {
      if (nextState.ignored) {
        medexaApi.ignoreInsight(sessionId, id);
      }
      setStatusMessage(message);
    }
  };

  const handleSuggestionApply = (id: string) => {
    const nextAppliedSuggestions = {
      ...appliedSuggestions,
      [id]: true,
    };

    setAppliedSuggestions(nextAppliedSuggestions);
    medexaApi.applySuggestion(sessionId, id);
    saveSoapDocumentation(insightStates, nextAppliedSuggestions);
  };

  const handleSuggestionIgnore = (id: string) => {
    setIgnoredSuggestions((suggestions) => ({
      ...suggestions,
      [id]: true,
    }));
    setStatusMessage("Suggestion ignored.");
  };

  const resetAiSession = () => {
    speechSession.resetTranscript();
    setAiSummarySegments([]);
    setGeneratedSoapSuggestions([]);
    setCptPopupQueue([]);
    setCurrentCptPopup(null);
    setCptRecords({});
    setActiveCptCode(null);
    setSuggestionItems([]);
    setInsightItems([]);
    setCptDetectionStatus("Waiting");
    setIgnoredSuggestions({});
    appliedCptCodesRef.current = new Set();
    rejectedCptPopupRef.current = {};
    lastAnalyzedSecondRef.current = 0;
    isGeneratingSegmentRef.current = false;
  };

  const handlePrimaryRecordingControl = async () => {
    setStatusMessage("");

    if (recordingStatus === "recording") {
      setRecordingStatus("paused");
      setCptTimer((timer) =>
        timer.status === "running"
          ? createLocalCptTimer("paused", timer.seconds, timer.code, timer.source, timer.reason)
          : timer,
      );
      setCptRecords((records) => {
        if (!activeCptCode || !records[activeCptCode]) {
          return records;
        }

        return {
          ...records,
          [activeCptCode]: {
            ...records[activeCptCode],
            status: "paused",
            intervals: records[activeCptCode].intervals.map((interval, index, intervals) =>
              index === intervals.length - 1 && interval.endSecond === undefined
                ? { ...interval, endSecond: recordingSecondsRef.current }
                : interval,
            ),
          },
        };
      });
      speechSession.pauseListening();
      medexaApi.pauseSessionTimer(sessionId);
      medexaApi.updateSessionState(sessionId, {
        status: "paused",
        elapsedSeconds: recordingSeconds,
      });
      return;
    }

    if (recordingStatus === "stopped") {
      setRecordingSeconds(INITIAL_RECORDING_SECONDS);
      setCptTimer(createLocalCptTimer());
      resetAiSession();
    }

    if (recordingStatus === "idle") {
      setRecordingSeconds(INITIAL_RECORDING_SECONDS);
      setCptTimer(createLocalCptTimer());
      resetAiSession();
    }

    setRecordingStatus("recording");
    console.log("[Medexa Recording] Start Recording clicked");
    console.log("[Medexa Recording] started");
    console.log("[Medexa Recording] status", "recording");
    setCptTimer((timer) =>
      timer.status === "paused"
        ? createLocalCptTimer("running", timer.seconds, timer.code, timer.source, timer.reason)
        : timer,
    );
    setCptRecords((records) => {
      if (!activeCptCode || !records[activeCptCode] || records[activeCptCode].status !== "paused") {
        return records;
      }

      return {
        ...records,
        [activeCptCode]: {
          ...records[activeCptCode],
          status: "running",
          intervals: [
            ...records[activeCptCode].intervals,
            { startSecond: recordingSecondsRef.current },
          ],
        },
      };
    });
    if (recordingStatus === "idle" || recordingStatus === "stopped") {
      console.log("[Medexa Recording] speechSession.startListening called");
      await speechSession.startListening();
    } else {
      speechSession.resumeListening();
    }
    if (recordingStatus === "idle" || recordingStatus === "stopped") {
      medexaApi.startSessionTimer(sessionId);
    } else {
      medexaApi.resumeSessionTimer(sessionId);
    }
    medexaApi.updateSessionState(sessionId, {
      status: "recording",
      elapsedSeconds: recordingStatus === "stopped" ? INITIAL_RECORDING_SECONDS : recordingSeconds,
    });
  };

  useEffect(() => {
    if (!shouldAutoStartRecording || autoStartHandledRef.current || recordingStatus !== "idle") {
      return;
    }

    autoStartHandledRef.current = true;
    window.setTimeout(() => {
      handlePrimaryRecordingControl();
    }, 250);
  }, [recordingStatus, shouldAutoStartRecording]);

  const requestStop = () => {
    if (recordingStatus === "recording" || recordingStatus === "paused") {
      setShowStopConfirm(true);
    }
  };

  const confirmStop = async () => {
    const finalCptTimer =
      cptTimer.status === "running" || cptTimer.status === "paused"
        ? createLocalCptTimer("stopped", cptTimer.seconds, cptTimer.code, cptTimer.source, cptTimer.reason)
        : cptTimer;
    const appliedSuggestionNotes = suggestionItems
      .filter((item) => appliedSuggestions[item.id])
      .map((item) => item.text);
    const approvedInsightNotes = insightItems
      .filter((item) => insightStates[item.id]?.approved && !insightStates[item.id]?.ignored)
      .map((item) => item.note || item.text);
    const finalizedCptRecordsMap: Record<string, ApiCptRecord> = { ...cptRecords };

    if (finalCptTimer.code) {
      const existingRecord = finalizedCptRecordsMap[finalCptTimer.code];
      const closedIntervals = (existingRecord?.intervals ?? []).map((interval, index, intervals) =>
        index === intervals.length - 1 && interval.endSecond === undefined
          ? { ...interval, endSecond: recordingSecondsRef.current }
          : interval,
      );
      finalizedCptRecordsMap[finalCptTimer.code] = {
        code: finalCptTimer.code,
        displayName: existingRecord?.displayName || finalCptTimer.code,
        seconds: finalCptTimer.seconds,
        units: finalCptTimer.units,
        status: "stopped",
        source: finalCptTimer.source ?? existingRecord?.source ?? "manual",
        intervals: closedIntervals,
        reason: finalCptTimer.reason ?? existingRecord?.reason ?? "",
      };
    }

    const finalizedCptRecords = Object.values(finalizedCptRecordsMap).map((record) => ({
      ...record,
      status: "stopped" as const,
      units: cptUnitsFromSeconds(record.seconds),
    }));

    setRecordingStatus("stopped");
    setCptTimer(finalCptTimer);
    setCptRecords(Object.fromEntries(finalizedCptRecords.map((record) => [record.code, record])));
    setActiveCptCode(null);
    setShowStopConfirm(false);
    speechSession.stopListening();
    await createAiSummarySegment(recordingSecondsRef.current);
    medexaApi.stopSessionTimer(sessionId);
    if (cptTimer.status === "running" || cptTimer.status === "paused") {
      medexaApi.stopCptTimer(sessionId);
    }
    medexaApi.updateSessionState(sessionId, {
      status: "stopped",
      elapsedSeconds: recordingSeconds,
    });
    const localSoapData = saveSoapDocumentation();
    const finalizePayload = {
      transcript: speechSession.finalTranscriptRef.current || fullTranscript,
      total_seconds: recordingSeconds,
      cpt_timer: {
        active: false,
        code: finalCptTimer.code,
        seconds: finalCptTimer.seconds,
        units: finalCptTimer.units,
      },
      cpt_records: finalizedCptRecords,
      active_cpt_code: activeCptCode,
      applied_suggestions: appliedSuggestionNotes,
      approved_insights: approvedInsightNotes,
      detected_cpt_suggestions: latestDetectedCptSuggestionsRef.current ?? [],
      detected_icd10_suggestions: latestDetectedIcdSuggestionsRef.current ?? [],
      ncci_conflicts: latestNcciConflictsRef.current ?? [],
      soap_draft: localSoapData,
    };
    console.log("[Medexa] finalizing SOAP", finalizePayload);
    const finalized = await medexaApi.finalizeSession(sessionId, finalizePayload);
    console.log("[Medexa] SOAP saved", finalized);

    if (finalized?.soap_note) {
      updateSoapData(finalized.soap_note);
      window.localStorage.setItem(
        `medexa_soap_note_${sessionId}`,
        JSON.stringify({
          ...finalized.soap_note,
          billing_summary: finalized.billing_summary,
          summary: finalized.summary,
        }),
      );
      router.push(finalized.redirect_url || `/soap-notes?sessionId=${sessionId}`);
      return;
    }

    window.localStorage.setItem(
      `medexa_soap_note_${sessionId}`,
      JSON.stringify({
        ...localSoapData,
        billing_summary: {
          total_seconds: recordingSeconds,
          cpt_records: finalizedCptRecords,
        },
      }),
    );
    router.push(`/soap-notes?sessionId=${sessionId}`);
  };

  const startCptTimerFromSuggestion = (
    source: "manual" | "ai_suggested" = "manual",
    suggestion = currentCptPopup,
  ) => {
    const suggestedCode = suggestion?.code || selectedSession.cpt || "97110";
    const displayName = suggestion?.display_name || suggestedCode;
    const reason =
      suggestion?.reason ||
      (source === "ai_suggested"
        ? "Transcript indicates a medically billable activity."
        : "Clinician manually started CPT timing.");

    setCptTimer(createLocalCptTimer("running", 0, suggestedCode, source, reason));
    setCptRecords((records) => {
      const nextStartSecond = recordingSecondsRef.current;
      const stoppedRecords = Object.fromEntries(
        Object.entries(records).map(([code, record]) => [
          code,
          record.status === "running"
            ? {
                ...record,
                status: "stopped" as const,
                intervals: record.intervals.map((interval, index, intervals) =>
                  index === intervals.length - 1 && interval.endSecond === undefined
                    ? { ...interval, endSecond: nextStartSecond }
                    : interval,
                ),
              }
            : record,
        ]),
      );
      const existingRecord = stoppedRecords[suggestedCode];

      return {
        ...stoppedRecords,
        [suggestedCode]: {
          code: suggestedCode,
          displayName,
          seconds: 0,
          units: 0,
          status: "running",
          source,
          intervals: [
            ...(existingRecord?.intervals ?? []),
            { startSecond: nextStartSecond },
          ],
          reason,
        },
      };
    });
    setActiveCptCode(suggestedCode);
    appliedCptCodesRef.current.add(suggestedCode);
    currentCptPopupRef.current = null;
    setCurrentCptPopup(null);
    showNextQueuedCptPopup();
    setCptDetectionStatus(`Detected ${suggestedCode}`);
    setStatusMessage(`CPT ${suggestedCode} timer started.`);
    medexaApi.startCptTimer(sessionId, suggestedCode, source, reason);
  };

  const rejectCptSuggestion = () => {
    const rejectedCode = currentCptPopup?.code;
    if (rejectedCode) {
      rejectedCptPopupRef.current[rejectedCode] = Date.now() + 30000;
    }
    currentCptPopupRef.current = null;
    setCurrentCptPopup(null);
    showNextQueuedCptPopup();
    setCptDetectionStatus("Waiting");
    setStatusMessage("Procedure suggestion rejected.");
  };

  const stopCptTimer = () => {
    setCptTimer((timer) => createLocalCptTimer("stopped", timer.seconds, timer.code, timer.source, timer.reason));
    setCptRecords((records) => {
      if (!activeCptCode || !records[activeCptCode]) {
        return records;
      }

      return {
        ...records,
        [activeCptCode]: {
          ...records[activeCptCode],
          status: "stopped",
          intervals: records[activeCptCode].intervals.map((interval, index, intervals) =>
            index === intervals.length - 1 && interval.endSecond === undefined
              ? { ...interval, endSecond: recordingSecondsRef.current }
              : interval,
          ),
        },
      };
    });
    setActiveCptCode(null);
    medexaApi.stopCptTimer(sessionId);
  };

  useEffect(() => {
    if (!lastHeardText || (!speechSession.triggerModeEnabled && recordingStatus === "idle")) {
      return;
    }

    const detection = detectMedexaCommand(lastHeardText);

    if (!detection.wakeWordDetected && detection.command === "none") {
      return;
    }

    if (detection.wakeWordDetected) {
      setTriggerStatus("detected");
    }

    if (detection.command === "none") {
      return;
    }

    const now = Date.now();
    if (
      lastTriggerCommandRef.current === detection.command &&
      now - lastTriggerAtRef.current < triggerCooldownMs
    ) {
      return;
    }

    lastTriggerCommandRef.current = detection.command;
    lastTriggerAtRef.current = now;

    if (detection.command === "start_recording" && recordingStatus !== "recording") {
      handlePrimaryRecordingControl();
      return;
    }

    if (detection.command === "stop_recording" && (recordingStatus === "recording" || recordingStatus === "paused")) {
      void confirmStop();
      return;
    }

    if (detection.command === "pause" && recordingStatus === "recording") {
      handlePrimaryRecordingControl();
      return;
    }

    if (detection.command === "resume" && recordingStatus === "paused") {
      handlePrimaryRecordingControl();
      return;
    }

    if (detection.command === "start_cpt" && recordingStatus === "recording" && cptTimer.status !== "running") {
      startCptTimerFromSuggestion("manual");
    }
  }, [cptTimer.status, lastHeardText, recordingStatus, speechSession.triggerModeEnabled]);

  const handleGenerateTestSummary = () => {
    const chunkText =
      getCurrentChunkTranscript() ||
      "Patient reports lower back pain, difficulty walking, pain scale seven out of ten, limited range of motion, and sleep issues.";

    if (getCurrentChunkTranscript()) {
      void createAiSummarySegment(recordingSecondsRef.current);
      return;
    }

    void createAiSummarySegment(recordingSecondsRef.current, chunkText);
  };

  const handleAudioUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setAudioUploadStatus("uploading");
    setAudioUploadError("");

    try {
      const response = await medexaApi.transcribeAudio(sessionId, file);

      if (!response?.transcript) {
        throw new Error("Audio transcription failed.");
      }

      const analysis = apiAnalysisToClinicalAnalysis(response);
      const finalSegmentEnd = response.audio_segments.length
        ? Math.ceil(Math.max(...response.audio_segments.map((segment) => segment.end)))
        : 0;
      const segment: AiSummarySegment = {
        id: `${sessionId}-uploaded-audio-${Date.now()}`,
        startTime: "Uploaded Audio",
        endTime: finalSegmentEnd > 0 ? formatDuration(finalSegmentEnd) : "Analysis",
        transcriptExcerpt: response.transcript.slice(0, 260),
        analysis,
        status: "Generated",
      };

      setUploadedAudioTranscript(response.transcript);
      setAiSummarySegments((segments) => [...segments, segment]);
      setGeneratedSoapSuggestions((suggestions) => [
        ...suggestions,
        `${analysis.soapUpdate.subjective} ${analysis.soapUpdate.objective} ${analysis.soapUpdate.assessment} ${analysis.soapUpdate.plan}`,
      ]);
      setAudioUploadStatus("success");
    } catch (error) {
      console.warn("Audio transcription failed.", error);
      setAudioUploadStatus("error");
      setAudioUploadError("Audio transcription failed. Please check backend and audio format.");
    } finally {
      event.target.value = "";
    }
  };

  const recordingStatusText =
    recordingStatus === "stopped"
      ? t("session.recordingStopped")
      : recordingStatus === "recording"
        ? t("session.recordingActive")
      : recordingStatus === "paused"
        ? t("session.recordingPaused")
        : t("session.readyToRecord");
  const formattedRecordingDuration = formatDuration(recordingSeconds);
  const sessionUnits = recordingStatus === "idle" ? 0 : cptUnitsFromSeconds(recordingSeconds);
  const cptUnits = cptTimer.units;
  const cptCode = cptTimer.code || currentCptPopup?.code || selectedSession.cpt || "97110";
  const nextCptUnit = cptUnits + 1;
  const primaryBannerTitle =
    cptTimer.status === "running" || cptTimer.status === "paused"
      ? `CPT ${cptCode} ${cptTimer.status === "paused" ? "paused" : "in progress.."}`
      : recordingStatus === "idle"
        ? "Medexa is ready"
      : recordingStatus === "paused"
        ? "Medexa is paused"
        : recordingStatus === "stopped"
          ? "Medexa stopped listening"
          : "Medexa is listening";
  const primaryBannerSubtext =
    cptTimer.status === "running" || cptTimer.status === "paused"
      ? "Say Stop Recording..."
      : recordingStatus === "idle"
        ? "Say Hey Medexa start recording or press Start Recording."
        : "Say Stop Recording...";
  const cptElapsedUnitText = `${formatDuration(cptTimer.seconds)} / ${cptUnits} ${cptUnits === 1 ? "Unit" : "Units"}`;
  const cptNextUnitText =
    cptTimer.status === "running" || cptTimer.status === "paused" || cptTimer.status === "stopped"
      ? `Unit ${nextCptUnit} at ${formatDuration(cptTimer.nextUnitAtSeconds)} • +${formatDuration(cptTimer.secondsLeftToNextUnit)} left`
      : "CPT units: 0";
  const primaryControlLabel =
    recordingStatus === "recording"
      ? t("common.pause")
      : recordingStatus === "paused"
        ? t("common.resume")
        : recordingStatus === "stopped"
          ? "Start Recording"
          : "Start Recording";
  const listeningStatus = !speechSession.isSupported
    ? t("session.unsupported")
    : recordingStatus === "recording" && speechSession.isListening
      ? t("session.listening")
      : recordingStatus === "recording" || recordingStatus === "paused"
        ? t("session.paused")
        : t("common.stopped");
  const showBottomControl = true;
  const voiceTriggerLabel = !speechSession.isSupported
    ? "Web Speech is not supported in this browser. Please use Chrome or Edge."
    : speechSession.triggerPermissionStatus === "required" || speechSession.permissionError
      ? "Voice Trigger: Permission Required"
      : triggerStatus === "detected"
        ? "Voice Trigger: Detected"
        : speechSession.isListening
          ? "Voice Trigger: Listening"
          : "Voice Trigger: Armed";
  const showVoicePermissionMessage =
    speechSession.isSupported && (speechSession.triggerPermissionStatus === "required" || Boolean(speechSession.permissionError));

  return (
    <main className="session-page">
      <MedexaHeader searchValue={searchQuery} onSearchChange={setSearchQuery} />

      <section className="session-content">
        <section className="patient-strip">
          <Link href="/ambient-listening" className="back-link" aria-label="Back to Ambient Listening">
            ‹
          </Link>
          <img className="patient-avatar" src={selectedSession.img} alt="" />
          <div className="patient-info">
            <h1>{selectedSession.name}</h1>
            <div className="patient-meta">
              <p>
                {t("session.ageSex")}
                <strong>{selectedSession.ageSex}</strong>
              </p>
              <p>
                {t("session.weight")}
                <strong>{selectedSession.weight}</strong>
              </p>
              <p>
                {t("session.mrnNumber")}
                <strong>{selectedSession.mrn}</strong>
              </p>
              <p>
                {t("session.payorSource")}
                <strong className="blue-dot">{selectedSession.payor}</strong>
              </p>
              <p>
                {t("session.careType")}
                <strong>{selectedSession.careType}</strong>
              </p>
              <p>
                {t("session.cptIcd")}
                <strong>
                  {selectedSession.cpt} / {selectedSession.icd}
                </strong>
              </p>
              <p>
                {t("session.sessionTime")}
                <strong>{selectedSession.time}</strong>
              </p>
            </div>
          </div>
        </section>

        <section className="recording-card">
          <div className="recording-left">
            <span
              className={`wave-bars ${recordingStatus === "recording" ? "is-animating" : ""}`}
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className={`listening-dot is-${recordingStatus}`} aria-hidden="true" />
            <div>
              <h2>{primaryBannerTitle}</h2>
              <p>{primaryBannerSubtext}</p>
            </div>
          </div>
          <div className="recording-right">
            <p>
              {cptTimer.status === "running" || cptTimer.status === "paused" ? (
                <b dir="ltr">{cptElapsedUnitText}</b>
              ) : (
                <>
                  Session units: <b>{sessionUnits}</b>
                </>
              )}
            </p>
            <strong dir="ltr">{cptNextUnitText}</strong>
          </div>
        </section>

        <div className="cpt-action-row">
          <button
            type="button"
            onClick={() => startCptTimerFromSuggestion("manual")}
            disabled={recordingStatus !== "recording"}
          >
            Start CPT Timer
          </button>
          {cptTimer.status === "running" && (
            <button type="button" className="secondary" onClick={stopCptTimer}>
              Stop CPT Timer
            </button>
          )}
        </div>

        <div className="voice-debug-line" aria-live="polite">
          <span>{voiceTriggerLabel}</span>
          {showVoicePermissionMessage && <span>Microphone permission is required for Medexa voice trigger.</span>}
          <span>CPT Detection: {cptDetectionStatus}</span>
        </div>

        <div className="cpt-debug-strip" aria-live="polite">
          <span>Recording status: {recordingStatus}</span>
          <span>Speech listening: {speechSession.isListening ? "true" : "false"}</span>
          <span>Mic permission: {speechSession.permissionStatus}</span>
          <span>Speech supported: {speechSession.isSupported ? "true" : "false"}</span>
          <span>Speech error: {speechSession.error || "none"}</span>
          <span>Last heard: {speechSession.lastHeardText || "none"}</span>
          <span>Detection text: {cptDebugText.slice(-80) || "none"}</span>
          <span>CPT matches: {cptDebugMatches.map((match) => match.code).join(", ") || "none"}</span>
          <span>Backend rules: {backendRulesStatus}</span>
          <span>Popup: {currentCptPopup?.code || "none"}</span>
          <button
            type="button"
            onClick={() => {
              setStatusMessage("Speak now...");
              void speechSession.startListening();
            }}
          >
            Test Microphone
          </button>
          <button
            type="button"
            onClick={() =>
              queueOrShowCptPopup({
                should_start: true,
                code: "97110",
                display_name: "Therapeutic Exercise",
                reason: "Manual test popup",
                confidence: "high",
              })
            }
          >
            Test CPT Popup
          </button>
          <button
            type="button"
            onClick={() => {
              const testText = "Patient is doing therapeutic exercise and range of motion";
              setManualLiveTranscriptText(testText);
              const matches = detectInstantCpt(testText);
              console.log("[Medexa CPT] Test Live Transcript CPT", testText, matches);
              setCptDebugText(testText);
              setCptDebugMatches(matches);
              matches.forEach((match) => queueOrShowCptPopup(match));
            }}
          >
            Test Live Transcript CPT
          </button>
          <button
            type="button"
            onClick={() =>
              queueOrShowCptPopup({
                should_start: true,
                code: "97116",
                display_name: "Gait Training",
                reason: "Manual test gait popup",
                confidence: "high",
              })
            }
          >
            Test Gait CPT
          </button>
        </div>

        <div className="session-status-row" aria-live="polite">
          <p className={`recording-status is-${recordingStatus}`}>{recordingStatusText}</p>
          {statusMessage && <p className="status-message">{statusMessage}</p>}
        </div>

        <p className="processing-text">{t("session.processingInsights")}</p>

        <section className="session-insights-grid">
          <div className="insights-scroll-area">
            <div className="insight-timeline">
            {filteredInsights.map((item) => {
              const itemState = insightStates[item.id] ?? {};
              const isBilling = item.label === "Billing";

              return (
                <article
                  className={`timeline-item insight-item ${itemState.ignored ? "is-ignored" : ""}`}
                  key={item.id}
                >
                  <div
                    className={`insight-card ${item.tone === "protocol" ? "is-protocol" : ""} ${
                      itemState.approved ? "is-approved" : ""
                    }`}
                  >
                    <span className="insight-tag">{item.tag}</span>
                    <p>{item.text}</p>
                  </div>
                  <div className="insight-actions">
                    <button
                      type="button"
                      className={`insight-label ${itemState.selected ? "is-selected" : ""} ${
                        isBilling ? "is-billing" : ""
                      }`}
                      onClick={() =>
                        updateInsight(
                          item.id,
                          { selected: !itemState.selected },
                          isBilling ? t("session.billingSelected") : t("session.detectedSelected"),
                        )
                      }
                    >
                      {item.label}
                    </button>
                    <button
                      type="button"
                      className="ignore-button"
                      onClick={() =>
                        updateInsight(
                          item.id,
                          { ignored: true, selected: false, approved: false },
                          t("session.insightIgnored"),
                        )
                      }
                    >
                      × {t("common.ignore")}
                    </button>
                  </div>
                  <p className="insight-note">{item.note}</p>
                  <div className="insight-state-row">
                    {itemState.approved && <span className="state-badge approved">{t("common.approved")}</span>}
                    {itemState.ignored && <span className="state-badge ignored">{t("common.ignore")}</span>}
                    {itemState.selected && (
                      <span className="selection-message">
                        {isBilling ? t("session.billingSelected") : t("session.detectedSelected")}
                      </span>
                    )}
                  </div>
                  <SlideToApprove
                    approved={Boolean(itemState.approved)}
                    label={t("session.slideToApprove")}
                    approvedLabel={t("common.approved")}
                    onApprove={() =>
                      updateInsight(
                        item.id,
                        { approved: true, ignored: false },
                        t("session.insightApproved"),
                      )
                    }
                  />
                </article>
              );
            })}

              {filteredInsights.length === 0 && (
                <div className="empty-state">{t("session.noLiveInsights")}</div>
              )}
            </div>
          </div>

          <aside className="suggestions-panel">
            <div className="suggestions-heading">
              <h2>{t("session.suggestions")}</h2>
              <span>{filteredSuggestions.length}</span>
            </div>

            <div className="suggestions-list">
              {filteredSuggestions.map((item) => {
                const isApplied = appliedSuggestions[item.id];

                return (
                  <article
                    className={`suggestion-card ${isApplied ? "is-applied" : ""}`}
                    key={item.id}
                  >
                    <div>
                      <span className="suggestion-dot" />
                      <h3>{item.title}</h3>
                    </div>
                    <p>{item.text}</p>
                    <button
                      type="button"
                      className={isApplied ? "is-applied" : ""}
                      onClick={() => handleSuggestionApply(item.id)}
                    >
                      {isApplied ? `✓ ${t("common.applied")}` : `✓ ${t("common.apply")}`}
                    </button>
                    <button
                      type="button"
                      className="ignore-suggestion"
                      onClick={() => handleSuggestionIgnore(item.id)}
                    >
                      Ignore
                    </button>
                  </article>
                );
              })}

              {filteredSuggestions.length === 0 && (
                <div className="empty-state compact">
                  {recordingStatus === "recording"
                    ? "Listening for clinical and billing suggestions..."
                    : t("session.noSuggestions")}
                </div>
              )}
            </div>
          </aside>
        </section>

        <section className="speech-ai-grid" aria-label="Live transcription and AI summaries">
          <article className="speech-card">
            <div className="speech-card-heading">
              <div>
                <h2>{t("session.liveTranscript")}</h2>
                <p>{t("session.aiDisclaimer")}</p>
              </div>
              <span className={`listening-badge is-${speechSession.isSupported ? recordingStatus : "unsupported"}`}>
                {listeningStatus}
              </span>
            </div>

            {!speechSession.isSupported && (
              <div className="speech-alert">{t("session.webSpeechUnsupported")}</div>
            )}
            {speechSession.permissionError && (
              <div className="speech-alert">{t("session.microphoneRequired")}</div>
            )}

            <div className="speech-debug-line">
              <span>
                {t("session.speechStatus")}: <strong>{listeningStatus}</strong>
              </span>
              <div className="speech-debug-actions">
                <button type="button" onClick={handleGenerateTestSummary}>
                  {t("session.generateTestSummary")}
                </button>
                <button
                  type="button"
                  disabled={audioUploadStatus === "uploading"}
                  onClick={() => audioInputRef.current?.click()}
                >
                  {audioUploadStatus === "uploading" ? "Transcribing audio..." : "Upload Audio for Test"}
                </button>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  className="sr-only"
                  onChange={handleAudioUpload}
                />
              </div>
            </div>

            {audioUploadStatus === "success" && (
              <div className="speech-alert is-success">Audio transcript generated</div>
            )}
            {audioUploadStatus === "error" && (
              <div className="speech-alert">{audioUploadError || "Audio transcription failed. Please check backend."}</div>
            )}

            <div className="transcript-box">
              <h3>{t("session.liveTranscript")}</h3>
              <p>{fullTranscript || t("session.transcriptPlaceholder")}</p>
            </div>

            {uploadedAudioTranscript && (
              <div className="transcript-box">
                <h3>Uploaded Audio Transcript</h3>
                <p>{uploadedAudioTranscript}</p>
              </div>
            )}

            <div className="transcript-box">
              <h3>{t("session.currentChunk")}</h3>
              <p>{currentThirtySecondChunk || t("session.transcriptPlaceholder")}</p>
            </div>

            {generatedSoapSuggestions.length > 0 && (
              <div className="transcript-box">
                <h3>{t("session.soapSuggestions")}</h3>
                <ul>
                  {generatedSoapSuggestions.slice(-3).map((suggestion, index) => (
                    <li key={`${suggestion}-${index}`}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>

          <article className="speech-card">
            <div className="speech-card-heading">
              <div>
                <h2>{t("session.aiSummarySegments")}</h2>
                <p>{t("session.aiDisclaimer")}</p>
              </div>
            </div>

            <div className="summary-segments">
              {aiSummarySegments.length === 0 && (
                <div className="empty-state compact">{t("session.noSummarySegments")}</div>
              )}

              {aiSummarySegments.map((segment) => (
                <article className="summary-segment-card" key={segment.id}>
                  <div className="segment-topline">
                    <strong dir="ltr">
                      {segment.startTime} - {segment.endTime}
                    </strong>
                    <span>{t("session.generated")}</span>
                  </div>

                  <div className="segment-section">
                    <h3>{t("session.transcriptExcerpt")}</h3>
                    <p>{segment.transcriptExcerpt}</p>
                  </div>

                  <div className="segment-section">
                    <h3>{t("ambient.summarized")}</h3>
                    <p>{segment.analysis.summary}</p>
                  </div>

                  <div className="segment-columns">
                    <div className="segment-section">
                      <h3>AI-Assisted Possible Clinical Impressions</h3>
                      <ul>
                        {segment.analysis.possibleDiagnoses.map((diagnosis) => (
                          <li key={diagnosis}>{diagnosis}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="segment-section">
                      <h3>{t("session.symptomsDetected")}</h3>
                      <ul>
                        {segment.analysis.symptoms.map((symptom) => (
                          <li key={symptom}>{symptom}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="segment-section">
                    <h3>ICD-10 Suggestions</h3>
                    {segment.analysis.icd10Suggestions.length > 0 ? (
                      <ul>
                        {segment.analysis.icd10Suggestions.map((suggestion) => (
                          <li key={`${suggestion.code}-${suggestion.phrase}`}>
                            <strong dir="ltr">{suggestion.code}</strong> - {suggestion.phrase}. {suggestion.reason}.{" "}
                            <span>{t("session.confidence")}: {suggestion.confidence}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No ICD-10 suggestions detected.</p>
                    )}
                  </div>

                  <div className="segment-section">
                    <h3>CPT/Billing Suggestions</h3>
                    {segment.analysis.cptSuggestions.length > 0 ? (
                      <ul>
                        {segment.analysis.cptSuggestions.map((suggestion) => {
                          const caveats = summarizeBillingCaveats(suggestion.billingCaveats);

                          return (
                            <li key={suggestion.code}>
                              <strong dir="ltr">{suggestion.code}</strong> - {suggestion.displayName}.{" "}
                              {suggestion.matchedPhrases.length > 0 && (
                                <span>Matched: {suggestion.matchedPhrases.join(", ")}. </span>
                              )}
                              <span>{suggestion.reason} </span>
                              {suggestion.documentationRequirements.length > 0 && (
                                <span>Documentation: {suggestion.documentationRequirements.slice(0, 2).join(" | ")}. </span>
                              )}
                              {caveats.length > 0 && <span>Billing caveats: {caveats.join(" | ")}. </span>}
                              <span>{t("session.confidence")}: {suggestion.confidence}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p>No CPT/Billing suggestions detected.</p>
                    )}
                  </div>

                  <div className="segment-columns">
                    <div className="segment-section">
                      <h3>Body Region Detected</h3>
                      {segment.analysis.bodyRegions.length > 0 ? (
                        <ul>
                          {segment.analysis.bodyRegions.map((bodyRegion) => (
                            <li key={`${bodyRegion.region}-${bodyRegion.phrase}`}>
                              {bodyRegion.phrase}: <strong>{bodyRegion.region}</strong>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No body region detected.</p>
                      )}
                    </div>

                    <div className="segment-section">
                      <h3>NCCI Conflict Warnings</h3>
                      {segment.analysis.ncciConflicts.length > 0 ? (
                        <ul>
                          {segment.analysis.ncciConflicts.map((conflict) => (
                            <li key={`${conflict.cptA}-${conflict.cptB}`}>
                              <strong dir="ltr">
                                {conflict.cptA} / {conflict.cptB}
                              </strong>{" "}
                              - {conflict.conflictType}. {conflict.explanation} Modifier 59 possible:{" "}
                              {conflict.modifier59Possible ? "Yes" : "No"}. Severity: {conflict.severity}.
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No NCCI conflict warnings detected.</p>
                      )}
                    </div>
                  </div>

                  <div className="segment-section">
                    <h3>{t("session.soapSuggestions")}</h3>
                    <p>{segment.analysis.soapUpdate.subjective}</p>
                    <p>{segment.analysis.soapUpdate.objective}</p>
                    <p>{segment.analysis.soapUpdate.assessment}</p>
                    <p>{segment.analysis.soapUpdate.plan}</p>
                  </div>

                  <div className="segment-section">
                    <h3>{t("session.billingHints")}</h3>
                    <ul>
                      {segment.analysis.billingHints.map((hint) => (
                        <li key={hint}>{hint}</li>
                      ))}
                    </ul>
                  </div>

                  <p className="confidence-line">
                    {t("session.confidence")}: <strong>{segment.analysis.confidence}</strong>
                  </p>
                  <p className="confidence-line">{segment.analysis.disclaimer}</p>
                </article>
              ))}
            </div>
          </article>
        </section>
      </section>

      {showBottomControl && <div className="recording-controls" aria-label="Recording controls">
        <div className="control-timer">
          <strong dir="ltr">{formattedRecordingDuration}</strong>
          <span>Total Duration</span>
        </div>
        <button
          type="button"
          className="pause-icon"
          aria-label={primaryControlLabel}
          onClick={handlePrimaryRecordingControl}
        >
          {recordingStatus === "recording" ? "||" : "▶"}
        </button>
        <span className="control-label">{primaryControlLabel}</span>
        <button
          type="button"
          className={`stop-icon ${recordingStatus === "stopped" ? "is-stopped" : ""}`}
          aria-label="Stop"
          disabled={recordingStatus === "idle" || recordingStatus === "stopped"}
          onClick={requestStop}
        >
          <span />
        </button>
        <span className="control-label">{recordingStatus === "stopped" ? t("common.stopped") : t("common.stop")}</span>
      </div>}

      {showStopConfirm && (
        <div className="stop-confirm" role="dialog" aria-modal="true" aria-labelledby="stop-title">
          <div className="stop-confirm-panel">
            <h2 id="stop-title">{t("session.stopRecordingQuestion")}</h2>
            <div className="stop-confirm-actions">
              <button type="button" onClick={confirmStop}>
                {t("session.confirmStop")}
              </button>
              <button type="button" onClick={() => setShowStopConfirm(false)}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {currentCptPopup && (
        <div className="procedure-popup-backdrop" aria-hidden="true" />
      )}

      {currentCptPopup && (
        <section className="procedure-popup cpt-detected-popup" role="dialog" aria-live="polite" aria-label="Procedure Detected">
          <div className="procedure-popup-left">
            <span className="procedure-popup-dot" aria-hidden="true" />
            <div>
              <p>Procedure Detected</p>
              <h2>Starting a therapy procedure?</h2>
              <span>
                Procedure for {currentCptPopup.code || cptCode}
                {currentCptPopup.display_name ? ` - ${currentCptPopup.display_name}` : ""} detected. Start CPT record for the session?
              </span>
              <small>Suggested CPT. Requires clinician review.</small>
            </div>
          </div>
          <div className="procedure-popup-actions">
            <button type="button" onClick={rejectCptSuggestion}>
              Reject
            </button>
            <button type="button" onClick={() => startCptTimerFromSuggestion("ai_suggested", currentCptPopup)}>
              Apply
            </button>
          </div>
        </section>
      )}

      <style>{`
        .session-page {
          min-height: 100vh;
          overflow-x: hidden;
          background: #fbfbfc;
          color: #151820;
          font-family: Arial, Helvetica, sans-serif;
          padding-bottom: 88px;
        }

        .topbar {
          width: 100%;
          box-sizing: border-box;
          height: 64px;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 0 32px;
          background: #ffffff;
          border-bottom: 1px solid #eef1f6;
          box-shadow: 0 1px 8px rgba(15, 23, 42, 0.03);
        }

        button {
          font-family: inherit;
        }

        .menu-button,
        .icon-button,
        .translate-button {
          border: 0;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .menu-button {
          width: 34px;
          height: 34px;
          flex-direction: column;
          gap: 4px;
          border-radius: 8px;
          background: #eef2ff;
        }

        .menu-button span {
          width: 12px;
          height: 2px;
          border-radius: 99px;
          background: #626b80;
        }

        .brand {
          margin-right: 12px;
          color: #001eff;
          font-size: 20px;
          font-weight: 800;
          text-decoration: none;
        }

        .global-search {
          flex: 1 1 auto;
          max-width: 520px;
          height: 34px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 18px;
          border: 1px solid #e4e9f2;
          border-radius: 999px;
          color: #9aa6ba;
          font-size: 12px;
          white-space: nowrap;
        }

        .global-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #172033;
          font: inherit;
        }

        .global-search input::placeholder {
          color: #9aa6ba;
        }

        .search-dot {
          color: #001eff;
          font-size: 12px;
        }

        .bell {
          position: relative;
          width: 30px;
          height: 30px;
          margin-left: auto;
          background: transparent;
        }

        .bell::before {
          content: "";
          width: 11px;
          height: 14px;
          border: 2px solid #001eff;
          border-bottom: 0;
          border-radius: 8px 8px 2px 2px;
        }

        .bell::after {
          content: "";
          position: absolute;
          bottom: 7px;
          width: 16px;
          height: 2px;
          border-radius: 999px;
          background: #001eff;
        }

        .translate-button {
          width: 30px;
          height: 30px;
          border-radius: 6px;
          background: #eef2f7;
          color: #4c5668;
          font-size: 13px;
        }

        .language-button {
          height: 30px;
          padding: 0 12px;
          border: 1px solid #d9e0eb;
          border-radius: 6px;
          background: #fff;
          color: #111827;
          font-size: 12px;
        }

        .profile {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .profile img {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          object-fit: cover;
        }

        .profile strong,
        .profile span {
          display: block;
          line-height: 1.1;
        }

        .profile strong {
          max-width: 150px;
          overflow: hidden;
          color: #172033;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .profile span {
          color: #7a879b;
          font-size: 10px;
        }

        .profile .chevron {
          color: #172033;
          font-size: 11px;
        }

        .session-content {
          box-sizing: border-box;
          width: min(100%, 820px);
          margin: 0 auto;
          padding: 18px 20px 150px;
        }

        .patient-strip {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .back-link {
          width: 20px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #172033;
          font-size: 24px;
          line-height: 1;
          text-decoration: none;
        }

        .patient-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
        }

        .patient-info {
          min-width: 0;
          flex: 1;
        }

        .patient-info h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 500;
          line-height: 1.1;
          color: #172033;
        }

        .patient-meta {
          display: grid;
          grid-template-columns: repeat(4, minmax(120px, 1fr));
          gap: 22px;
          max-width: 760px;
          margin-top: 9px;
        }

        .patient-meta p {
          margin: 0;
          color: #6b768a;
          font-size: 9px;
          line-height: 1.3;
        }

        .patient-meta strong {
          display: block;
          margin-top: 4px;
          color: #172033;
          font-size: 11px;
          font-weight: 800;
        }

        .patient-meta .blue-dot {
          color: #001eff;
        }

        .patient-meta .blue-dot::before {
          content: "";
          width: 6px;
          height: 6px;
          display: inline-block;
          margin-right: 6px;
          border-radius: 50%;
          background: #001eff;
          vertical-align: 1px;
        }

        .recording-card {
          min-height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 16px;
          padding: 14px 20px;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.13);
        }

        .recording-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .wave-bars {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 20px;
        }

        .wave-bars i {
          width: 3px;
          height: 10px;
          border-radius: 999px;
          background: #001eff;
          transform-origin: center;
        }

        .wave-bars i:nth-child(2),
        .wave-bars i:nth-child(4) {
          height: 17px;
        }

        .wave-bars i:nth-child(3) {
          height: 18px;
        }

        .wave-bars.is-animating i {
          animation: wave-pulse 0.78s ease-in-out infinite;
        }

        .wave-bars.is-animating i:nth-child(2) {
          animation-delay: 0.1s;
        }

        .wave-bars.is-animating i:nth-child(3) {
          animation-delay: 0.2s;
        }

        .wave-bars.is-animating i:nth-child(4) {
          animation-delay: 0.3s;
        }

        .wave-bars.is-animating i:nth-child(5) {
          animation-delay: 0.4s;
        }

        @keyframes wave-pulse {
          0%,
          100% {
            transform: scaleY(0.58);
            opacity: 0.62;
          }

          50% {
            transform: scaleY(1.25);
            opacity: 1;
          }
        }

        .listening-dot {
          width: 9px;
          height: 9px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: #11c778;
          box-shadow: 0 0 0 5px rgba(17, 199, 120, 0.12);
        }

        .listening-dot.is-paused {
          background: #f3a409;
          box-shadow: 0 0 0 5px rgba(243, 164, 9, 0.12);
        }

        .listening-dot.is-idle,
        .listening-dot.is-stopped {
          background: #a5adba;
          box-shadow: 0 0 0 5px rgba(165, 173, 186, 0.12);
        }

        .recording-left h2 {
          margin: 0;
          color: #172033;
          font-size: 14px;
          font-weight: 800;
        }

        .timer-line {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }

        .timer-line strong {
          color: #001eff;
          font-size: 32px;
          line-height: 1;
          letter-spacing: -1px;
        }

        .timer-line span {
          color: #172033;
          font-size: 11px;
        }

        .recording-left p,
        .recording-right p {
          margin: 5px 0 0;
          color: #536071;
          font-size: 10px;
        }

        .recording-left b,
        .recording-right b {
          color: #172033;
        }

        .recording-right {
          text-align: right;
        }

        .recording-right strong {
          display: block;
          margin-top: 6px;
          color: #001eff;
          font-size: 12px;
        }

        .cpt-action-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
          flex-wrap: wrap;
        }

        .cpt-action-row > button,
        .cpt-suggestion button {
          border: 0;
          border-radius: 999px;
          background: #0800d8;
          color: #fff;
          padding: 9px 14px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .cpt-action-row > button.secondary {
          border: 1px solid #d8deea;
          background: #fff;
          color: #172033;
        }

        .cpt-action-row > button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .cpt-suggestion {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #cfd8ff;
          border-radius: 999px;
          background: #f7f8ff;
          padding: 5px 6px 5px 12px;
          color: #172033;
          font-size: 11px;
        }

        .voice-debug-line {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
          color: #667085;
          font-size: 10px;
        }

        .voice-debug-line span {
          border: 1px solid #e4e9f2;
          border-radius: 999px;
          background: #fff;
          padding: 4px 8px;
        }

        .cpt-debug-strip {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
          color: #344054;
          font-size: 10px;
        }

        .cpt-debug-strip span,
        .cpt-debug-strip button {
          border: 1px solid #d8deea;
          border-radius: 999px;
          background: #fff;
          padding: 5px 9px;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
        }

        .cpt-debug-strip button {
          color: #001eff;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .processing-text {
          margin: 18px 0 14px;
          color: #b5bfcc;
          font-size: 10px;
        }

        .session-status-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
        }

        .recording-status,
        .status-message {
          margin: 0;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 10px;
          font-weight: 800;
        }

        .recording-status {
          background: #eaf8f1;
          color: #087c4a;
        }

        .recording-status.is-idle {
          background: #eef2ff;
          color: #001eff;
        }

        .recording-status.is-recording {
          background: #eaf8f1;
          color: #087c4a;
        }

        .recording-status.is-paused {
          background: #fff7df;
          color: #8a5b00;
        }

        .recording-status.is-stopped {
          background: #f1f3f6;
          color: #667085;
        }

        .status-message {
          background: #eef2ff;
          color: #001eff;
        }

        .live-grid,
        .session-insights-grid {
          display: grid;
          grid-template-columns: minmax(390px, 1fr) 280px;
          gap: 24px;
          align-items: start;
          min-height: 0;
        }

        .insights-scroll-area {
          min-width: 0;
          min-height: 0;
          max-height: calc(100vh - 300px);
          overflow-y: auto;
          overflow-x: hidden;
          box-sizing: border-box;
          width: 100%;
          padding-right: 8px;
          padding-bottom: 120px;
          scrollbar-width: thin;
          scrollbar-color: #c9d4e5 transparent;
        }

        .insights-scroll-area::-webkit-scrollbar {
          width: 6px;
        }

        .insights-scroll-area::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: #c9d4e5;
        }

        .insight-timeline {
          position: relative;
          box-sizing: border-box;
          width: 100%;
          max-width: 390px;
          padding-left: 38px;
        }

        .insight-timeline::before {
          content: "";
          position: absolute;
          left: 10px;
          top: 2px;
          bottom: 0;
          border-left: 1px dashed #69a7ff;
          z-index: 0;
        }

        .timeline-item,
        .insight-item {
          position: relative;
          display: block;
          margin: 0 0 18px;
          padding: 0;
          z-index: 1;
        }

        .timeline-item::before,
        .insight-item::before {
          content: "";
          position: absolute;
          left: -32px;
          top: 16px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #001eff;
          box-shadow: 0 0 0 4px #eef2ff;
          z-index: 2;
        }

        .timeline-item::after,
        .insight-item::after {
          content: "";
          position: absolute;
          left: -25px;
          top: 19px;
          width: 24px;
          border-top: 1px dashed #69a7ff;
          z-index: 0;
        }

        .insight-item.is-ignored {
          opacity: 0.58;
        }

        .connector {
          display: none;
        }

        .insight-card {
          position: relative;
          width: min(100%, 330px);
          box-sizing: border-box;
          padding: 13px 15px;
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
          z-index: 1;
        }

        .insight-card.is-protocol {
          border: 1px solid #10c978;
          box-shadow: 0 10px 22px rgba(16, 201, 120, 0.14);
        }

        .insight-card.is-approved {
          border: 1px solid #10c978;
          background: #f8fffb;
          box-shadow: 0 10px 22px rgba(16, 201, 120, 0.18);
        }

        .insight-tag {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          background: #0800b8;
          color: #fff;
          padding: 4px 8px;
          font-size: 9px;
          font-weight: 800;
        }

        .insight-card p {
          margin: 10px 0 0;
          color: #172033;
          font-size: 11px;
          line-height: 1.45;
        }

        .insight-actions {
          width: min(100%, 330px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
          gap: 10px;
        }

        .insight-label {
          display: inline-flex;
          align-items: center;
          border: 1px solid #d8deea;
          border-radius: 999px;
          padding: 2px 8px;
          background: #fff;
          color: #7a879b;
          font-size: 9px;
        }

        .insight-label.is-selected {
          border-color: #001eff;
          background: #eef2ff;
          color: #001eff;
          font-weight: 800;
        }

        .insight-label.is-billing.is-selected {
          border-color: #10c978;
          background: #eaf8f1;
          color: #087c4a;
        }

        .ignore-button {
          border: 0;
          background: transparent;
          color: #172033;
          font-size: 11px;
        }

        .insight-note {
          width: min(100%, 330px);
          margin: 8px 0 0;
          color: #172033;
          font-size: 10px;
          line-height: 1.45;
        }

        .insight-state-row {
          width: min(100%, 330px);
          min-height: 18px;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
        }

        .state-badge,
        .selection-message {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 9px;
          font-weight: 800;
        }

        .state-badge.approved {
          background: #eaf8f1;
          color: #087c4a;
        }

        .state-badge.ignored {
          background: #f1f3f6;
          color: #667085;
        }

        .selection-message {
          background: #eef2ff;
          color: #001eff;
        }

        .approve-slider {
          position: relative;
          width: min(100%, 260px);
          height: 34px;
          box-sizing: border-box;
          display: block;
          align-items: center;
          margin-top: 8px;
          padding: 0 14px 0 42px;
          border: 1px solid #9fb4ff;
          border-radius: 999px;
          background: #fff;
          color: #172033;
          font-size: 11px;
          line-height: 32px;
          cursor: grab;
          outline: 0;
          touch-action: none;
          user-select: none;
          transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
        }

        .approve-slider:focus-visible {
          border-color: #001eff;
          box-shadow: 0 0 0 3px rgba(0, 30, 255, 0.12);
        }

        .approve-slider.is-dragging {
          cursor: grabbing;
        }

        .approve-slider-handle {
          position: absolute;
          left: 5px;
          top: 4px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #f0f2ff;
          color: #001eff;
          font-size: 17px;
          transition: transform 0.18s ease, background 0.16s ease, color 0.16s ease;
          will-change: transform;
        }

        .approve-slider.is-dragging .approve-slider-handle {
          transition: none;
        }

        .approve-slider-label {
          display: block;
          overflow: hidden;
          color: inherit;
          font-size: 11px;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .approve-slider.is-approved {
          border-color: #10c978;
          background: #eaf8f1;
          color: #087c4a;
          font-weight: 800;
        }

        .approve-slider.is-approved .approve-slider-handle {
          background: #10c978;
          color: #fff;
          font-size: 12px;
        }

        .suggestions-panel {
          box-sizing: border-box;
          width: 280px;
          align-self: start;
          border-radius: 14px;
          background: #fff;
          padding: 14px;
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.09);
        }

        .suggestions-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .suggestions-heading h2 {
          margin: 0;
          color: #172033;
          font-size: 11px;
          font-weight: 500;
        }

        .suggestions-heading span {
          color: #172033;
          font-size: 10px;
        }

        .suggestions-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .suggestion-card {
          padding: 12px 13px;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
        }

        .suggestion-card.is-applied {
          border: 1px solid #10c978;
          background: #f8fffb;
        }

        .suggestion-card div {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .suggestion-dot {
          width: 6px;
          height: 6px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: #11c778;
        }

        .suggestion-card h3 {
          margin: 0;
          color: #172033;
          font-size: 11px;
          font-weight: 500;
        }

        .suggestion-card p {
          margin: 9px 0 0;
          color: #172033;
          font-size: 10px;
          line-height: 1.45;
        }

        .suggestion-card button {
          display: inline-flex;
          margin: 10px 0 0 auto;
          border: 0;
          background: transparent;
          color: #001eff;
          font-size: 11px;
          font-weight: 800;
        }

        .suggestion-card button.is-applied {
          color: #087c4a;
        }

        .suggestion-card .ignore-suggestion {
          margin-left: 12px;
          color: #667085;
        }

        .empty-state {
          width: min(100%, 330px);
          border: 1px dashed #d8deea;
          border-radius: 14px;
          background: #fff;
          color: #667085;
          padding: 18px;
          text-align: center;
          font-size: 11px;
        }

        .empty-state.compact {
          width: auto;
          padding: 18px;
        }

        .speech-ai-grid {
          display: none;
          grid-template-columns: minmax(280px, 0.9fr) minmax(320px, 1.1fr);
          gap: 18px;
          margin-top: 22px;
          align-items: start;
        }

        .speech-card {
          box-sizing: border-box;
          border-radius: 14px;
          background: #fff;
          padding: 16px;
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.09);
        }

        .speech-card-heading,
        .segment-topline {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .speech-card-heading h2 {
          margin: 0;
          color: #172033;
          font-size: 14px;
          font-weight: 800;
        }

        .speech-card-heading p {
          margin: 5px 0 0;
          color: #667085;
          font-size: 11px;
          line-height: 1.4;
        }

        .listening-badge,
        .segment-topline span {
          flex: 0 0 auto;
          border-radius: 999px;
          background: #eef2ff;
          color: #001eff;
          padding: 5px 9px;
          font-size: 10px;
          font-weight: 800;
        }

        .listening-badge.is-recording {
          background: #eaf8f1;
          color: #087c4a;
        }

        .listening-badge.is-paused {
          background: #fff6df;
          color: #9f6b00;
        }

        .listening-badge.is-stopped,
        .listening-badge.is-unsupported {
          background: #f1f3f6;
          color: #667085;
        }

        .speech-alert {
          margin-top: 12px;
          border: 1px solid #ffd7a8;
          border-radius: 10px;
          background: #fff8ec;
          color: #8a4b00;
          padding: 10px 12px;
          font-size: 11px;
          line-height: 1.45;
        }

        .speech-alert.is-success {
          border-color: #b7ebce;
          background: #effaf4;
          color: #087c4a;
        }

        .speech-debug-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 12px;
          color: #667085;
          font-size: 11px;
          line-height: 1.4;
        }

        .speech-debug-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .speech-debug-line strong {
          color: #172033;
        }

        .speech-debug-line button {
          flex: 0 0 auto;
          border: 1px solid #dbe3f0;
          border-radius: 8px;
          background: #ffffff;
          color: #001eff;
          padding: 6px 9px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .speech-debug-line button:disabled {
          color: #667085;
          cursor: wait;
          opacity: 0.75;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .transcript-box,
        .segment-section {
          margin-top: 14px;
        }

        .transcript-box {
          border: 1px solid #eef1f6;
          border-radius: 12px;
          background: #fbfcff;
          padding: 12px;
        }

        .transcript-box h3,
        .segment-section h3 {
          margin: 0 0 7px;
          color: #172033;
          font-size: 11px;
          font-weight: 800;
        }

        .transcript-box p,
        .transcript-box li,
        .segment-section p,
        .segment-section li,
        .confidence-line {
          margin: 0;
          color: #475467;
          font-size: 11px;
          line-height: 1.5;
        }

        .transcript-box ul,
        .segment-section ul {
          margin: 0;
          padding-left: 18px;
        }

        .summary-segments {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 14px;
        }

        .summary-segment-card {
          border: 1px solid #e6ebf3;
          border-radius: 12px;
          background: #fbfcff;
          padding: 13px;
        }

        .segment-topline strong {
          color: #172033;
          font-size: 12px;
          font-weight: 800;
        }

        .segment-columns {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .confidence-line {
          margin-top: 12px;
        }

        :global(html[dir="rtl"]) .transcript-box ul,
        :global(html[dir="rtl"]) .segment-section ul {
          padding-left: 0;
          padding-right: 18px;
        }

        .recording-controls {
          position: fixed;
          left: 50%;
          bottom: 24px;
          z-index: 5;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 340px;
          padding: 10px 14px 10px 18px;
          border-radius: 999px;
          background: #fff;
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.18);
        }

        .recording-controls button {
          border: 0;
        }

        .recording-controls button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .recording-controls span {
          color: #172033;
          font-size: 10px;
          font-weight: 700;
        }

        .control-timer {
          display: flex;
          flex-direction: column;
          min-width: 78px;
          padding-right: 8px;
        }

        .control-timer strong {
          color: #001eff;
          font-size: 20px;
          line-height: 1;
        }

        .control-timer span,
        .recording-controls .control-label {
          color: #667085;
          font-size: 10px;
          font-weight: 800;
        }

        .pause-icon,
        .stop-icon {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }

        .pause-icon {
          background: #eef2ff;
          color: #001eff;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -2px;
        }

        .stop-icon {
          background: #0800d8;
        }

        .stop-icon.is-stopped {
          background: #667085;
        }

        .stop-icon span {
          width: 10px;
          height: 10px;
          border: 2px solid #fff;
          border-radius: 50%;
        }

        .stop-confirm {
          position: fixed;
          inset: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.24);
        }

        .stop-confirm-panel {
          width: min(100%, 320px);
          border-radius: 14px;
          background: #fff;
          padding: 18px;
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.2);
        }

        .stop-confirm-panel h2 {
          margin: 0;
          color: #172033;
          font-size: 16px;
          font-weight: 800;
        }

        .stop-confirm-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 18px;
        }

        .stop-confirm-actions button {
          height: 32px;
          border: 1px solid #d8deea;
          border-radius: 999px;
          background: #fff;
          color: #172033;
          padding: 0 12px;
          font-size: 11px;
          font-weight: 800;
        }

        .stop-confirm-actions button:first-child {
          border-color: #0800d8;
          background: #0800d8;
          color: #fff;
        }

        .procedure-popup-backdrop {
          position: fixed;
          inset: 0;
          z-index: 99998;
          pointer-events: none;
          backdrop-filter: blur(1px);
          background: rgba(15, 23, 42, 0.02);
        }

        .procedure-popup {
          position: fixed;
          left: 50%;
          bottom: 92px;
          z-index: 99999;
          width: min(calc(100vw - 32px), 720px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          box-sizing: border-box;
          padding: 18px 20px;
          border: 1px solid #b8f0d2;
          border-left: 5px solid #11c778;
          border-radius: 20px;
          background: linear-gradient(135deg, #ffffff 0%, #f7fbff 55%, #f5fff9 100%);
          box-shadow: 0 20px 48px rgba(15, 23, 42, 0.16), 0 0 0 5px rgba(17, 199, 120, 0.08);
          color: #172033;
          transform: translateX(-50%);
        }

        .cpt-detected-popup {
          position: fixed;
          left: 50%;
          bottom: 110px;
          transform: translateX(-50%);
          z-index: 99999;
        }

        .procedure-popup-left {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          min-width: 0;
        }

        .procedure-popup-dot {
          width: 10px;
          height: 10px;
          flex: 0 0 auto;
          margin-top: 4px;
          border-radius: 50%;
          background: #11c778;
          box-shadow: 0 0 0 7px rgba(17, 199, 120, 0.14);
        }

        .procedure-popup p,
        .procedure-popup h2,
        .procedure-popup span,
        .procedure-popup small {
          margin: 0;
        }

        .procedure-popup p {
          color: #087c4a;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .procedure-popup h2 {
          margin-top: 5px;
          font-size: 17px;
          line-height: 1.2;
        }

        .procedure-popup span,
        .procedure-popup small {
          display: block;
          margin-top: 6px;
          color: #344054;
          font-size: 12px;
          line-height: 1.4;
        }

        .procedure-popup small {
          color: #667085;
          font-size: 11px;
        }

        .procedure-popup-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 0 0 auto;
        }

        .procedure-popup-actions button {
          height: 36px;
          border: 1px solid #d8deea;
          border-radius: 999px;
          background: #fff;
          color: #344054;
          padding: 0 15px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .procedure-popup-actions button:last-child {
          border-color: #0800d8;
          background: #0800d8;
          color: #fff;
          box-shadow: 0 10px 22px rgba(8, 0, 216, 0.18);
        }

        @media (max-width: 900px) {
          .live-grid,
          .session-insights-grid {
            grid-template-columns: 1fr;
          }

          .speech-ai-grid,
          .segment-columns {
            grid-template-columns: 1fr;
          }

          .suggestions-panel {
            width: 100%;
            max-width: 520px;
          }

          .patient-meta {
            grid-template-columns: repeat(2, minmax(120px, 1fr));
          }
        }

        @media (max-width: 760px) {
          .topbar {
            gap: 10px;
            padding: 0 16px;
          }

          .global-search,
          .profile div,
          .profile .chevron {
            display: none;
          }

          .session-content {
            padding: 18px 16px 32px;
          }

          .patient-strip {
            align-items: flex-start;
          }

          .patient-meta {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .recording-card {
            align-items: flex-start;
            flex-direction: column;
          }

          .recording-right {
            text-align: left;
          }

          .procedure-popup {
            bottom: 104px;
            align-items: stretch;
            flex-direction: column;
          }

          .procedure-popup-actions {
            justify-content: flex-end;
          }
        }
      `}</style>
    </main>
  );
}

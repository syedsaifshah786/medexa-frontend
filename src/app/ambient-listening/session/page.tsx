"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MedexaHeader from "@/components/MedexaHeader";
import { useLanguage } from "@/context/LanguageContext";
import { type SoapData, useSessionDocumentation } from "@/context/SessionDocumentationContext";
import { apiSessionToUpcomingSession, medexaApi, type ApiInsight, type ApiSuggestion } from "@/lib/api";
import { setActiveSessionId } from "@/lib/activeSession";
import { getSessionById } from "@/lib/sessions";

/* eslint-disable @next/next/no-img-element -- Prototype uses remote avatar URLs without touching next.config.ts. */

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
];

const defaultSuggestions = [
  {
    id: "current-live-cpt",
    title: "Current Live CPT",
    text: "Therapeutic Act. 97130 is in progress. CPT started at 8:05",
  },
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

const INITIAL_RECORDING_SECONDS = 0;
const BILLABLE_UNIT_SECONDS = 8 * 60;

const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

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
  const [searchQuery, setSearchQuery] = useState("");
  const [insightStates, setInsightStates] = useState<Record<string, InsightState>>({});
  const [appliedSuggestions, setAppliedSuggestions] = useState<Record<string, boolean>>({});
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(INITIAL_RECORDING_SECONDS);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const routeSessionId = searchParams.get("id") ?? searchParams.get("session") ?? "";
  const localRouteSession = getSessionById(routeSessionId);
  const sessionId = routeSessionId || localRouteSession.id;
  const [selectedSession, setSelectedSession] = useState(localRouteSession);
  const [insightItems, setInsightItems] = useState<InsightItem[]>(defaultInsights);
  const [suggestionItems, setSuggestionItems] = useState<SuggestionItem[]>(defaultSuggestions);
  const { updateSoapData } = useSessionDocumentation();
  const { t } = useLanguage();

  useEffect(() => {
    const localSession = getSessionById(routeSessionId);
    setSelectedSession(localSession);
    setActiveSessionId(routeSessionId || localSession.id);
  }, [routeSessionId]);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const [apiSession, apiState, apiInsights, apiSuggestions] = await Promise.all([
        medexaApi.session(sessionId),
        medexaApi.sessionState(sessionId),
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
        setRecordingStatus(apiState.status);
        setRecordingSeconds(apiState.elapsedSeconds);
      }

      if (apiInsights) {
        setInsightItems(apiInsights.map(apiInsightToInsight));
        setInsightStates(
          Object.fromEntries(
            apiInsights.map((insight) => [
              insight.id,
              {
                approved: insight.status === "approved",
                ignored: insight.status === "ignored",
              },
            ]),
          ),
        );
      }

      if (apiSuggestions) {
        setSuggestionItems(apiSuggestions.map(apiSuggestionToSuggestion));
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
    if (!query) {
      return insightItems;
    }

    return insightItems.filter((item) =>
      [item.tag, item.text, item.label, item.note]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [insightItems, query]);

  useEffect(() => {
    if (recordingStatus !== "recording") {
      return;
    }

    const timerId = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [recordingStatus]);
  const filteredSuggestions = useMemo(() => {
    if (!query) {
      return suggestionItems;
    }

    return suggestionItems.filter((item) =>
      [item.title, item.text].join(" ").toLowerCase().includes(query),
    );
  }, [query, suggestionItems]);

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

  const handlePrimaryRecordingControl = () => {
    setStatusMessage("");

    if (recordingStatus === "recording") {
      setRecordingStatus("paused");
      medexaApi.updateSessionState(sessionId, {
        status: "paused",
        elapsedSeconds: recordingSeconds,
      });
      return;
    }

    if (recordingStatus === "stopped") {
      setRecordingSeconds(INITIAL_RECORDING_SECONDS);
    }

    setRecordingStatus("recording");
    medexaApi.updateSessionState(sessionId, {
      status: "recording",
      elapsedSeconds: recordingStatus === "stopped" ? INITIAL_RECORDING_SECONDS : recordingSeconds,
    });
  };

  const requestStop = () => {
    if (recordingStatus === "recording" || recordingStatus === "paused") {
      setShowStopConfirm(true);
    }
  };

  const confirmStop = () => {
    setRecordingStatus("stopped");
    setShowStopConfirm(false);
    medexaApi.updateSessionState(sessionId, {
      status: "stopped",
      elapsedSeconds: recordingSeconds,
    });
    saveSoapDocumentation();
    medexaApi.generateSoapNotes(sessionId).then((generatedSoapData) => {
      if (generatedSoapData) {
        updateSoapData(generatedSoapData);
      }
    });
  };

  const recordingStatusText =
    recordingStatus === "stopped"
      ? t("session.recordingStopped")
      : recordingStatus === "recording"
        ? t("session.recordingActive")
      : recordingStatus === "paused"
        ? t("session.recordingPaused")
        : t("session.readyToRecord");
  const recordingCardText =
    recordingStatus === "stopped"
      ? t("session.recordingSaved")
      : recordingStatus === "paused"
        ? t("session.recordingPaused")
        : recordingStatus === "idle"
          ? t("session.pressPlay")
        : (
            <>
              {t("session.sayStopRecording")}
            </>
          );
  const formattedRecordingDuration = formatDuration(recordingSeconds);
  const recordedUnits = Math.floor(recordingSeconds / BILLABLE_UNIT_SECONDS);
  const nextUnit = recordedUnits + 1;
  const nextUnitTargetSeconds = nextUnit * BILLABLE_UNIT_SECONDS;
  const secondsUntilNextUnit = nextUnitTargetSeconds - recordingSeconds;
  const unitLabel = recordedUnits === 1 ? "Unit" : "Units";
  const primaryControlLabel =
    recordingStatus === "recording"
      ? t("common.pause")
      : recordingStatus === "paused"
        ? t("common.resume")
        : recordingStatus === "stopped"
          ? t("common.start")
          : t("common.start");

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
            <span className="wave-bars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <div>
              <div className="timer-line">
                <strong>{formattedRecordingDuration}</strong>
                <span>/ {recordedUnits} {unitLabel}</span>
              </div>
              <p>{recordingCardText}</p>
            </div>
          </div>
          <div className="recording-right">
            <p>{t("session.unitAt")} {nextUnit} at <b dir="ltr">{formatDuration(nextUnitTargetSeconds)}</b></p>
            <strong dir="ltr">+{formatDuration(secondsUntilNextUnit)} {t("session.left")}</strong>
          </div>
        </section>

        <div className="session-status-row" aria-live="polite">
          <p className={`recording-status is-${recordingStatus}`}>{recordingStatusText}</p>
          {statusMessage && <p className="status-message">{statusMessage}</p>}
        </div>

        <p className="processing-text">{t("session.processingInsights")}</p>

        <section className="live-grid">
          <div className="insights-column">
            {filteredInsights.map((item) => {
              const itemState = insightStates[item.id] ?? {};
              const isBilling = item.label === "Billing";

              return (
                <article
                  className={`insight-item ${itemState.ignored ? "is-ignored" : ""}`}
                  key={item.id}
                >
                  <div className="connector" />
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
                          { ignored: true, selected: false },
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

          <aside className="suggestions-panel">
            <div className="suggestions-heading">
              <h2>{t("session.suggestions")}</h2>
              <span>3</span>
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
                  </article>
                );
              })}

              {filteredSuggestions.length === 0 && (
                <div className="empty-state compact">{t("session.noSuggestions")}</div>
              )}
            </div>
          </aside>
        </section>
      </section>

      <div className="recording-controls" aria-label="Recording controls">
        <button
          type="button"
          className="pause-icon"
          aria-label={primaryControlLabel}
          onClick={handlePrimaryRecordingControl}
        >
          {recordingStatus === "recording" ? "||" : "▶"}
        </button>
        <span>{primaryControlLabel}</span>
        <button
          type="button"
          className={`stop-icon ${recordingStatus === "stopped" ? "is-stopped" : ""}`}
          aria-label="Stop"
          disabled={recordingStatus === "idle" || recordingStatus === "stopped"}
          onClick={requestStop}
        >
          <span />
        </button>
        <span>{recordingStatus === "stopped" ? t("common.stopped") : t("common.stop")}</span>
      </div>

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
          padding: 18px 20px 34px;
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
        }

        .wave-bars i:nth-child(2),
        .wave-bars i:nth-child(4) {
          height: 17px;
        }

        .wave-bars i:nth-child(3) {
          height: 18px;
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

        .live-grid {
          display: grid;
          grid-template-columns: minmax(0, 390px) 320px;
          gap: 18px;
          align-items: start;
        }

        .insights-column {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .insight-item {
          position: relative;
          min-height: 104px;
          padding-left: 38px;
        }

        .insight-item.is-ignored {
          opacity: 0.58;
        }

        .connector {
          position: absolute;
          left: 10px;
          top: 0;
          bottom: -10px;
          width: 22px;
          border-left: 1px dashed #69a7ff;
          border-bottom: 1px dashed #69a7ff;
          border-radius: 0 0 0 10px;
        }

        .insight-card {
          width: min(100%, 330px);
          box-sizing: border-box;
          padding: 13px 15px;
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
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
          width: 320px;
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
          display: block;
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

        .recording-controls {
          position: fixed;
          left: 50%;
          bottom: 24px;
          z-index: 5;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 999px;
          background: #fff;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.24);
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

        .pause-icon,
        .stop-icon {
          width: 32px;
          height: 32px;
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

        @media (max-width: 900px) {
          .live-grid {
            grid-template-columns: 1fr;
          }

          .suggestions-panel {
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
        }
      `}</style>
    </main>
  );
}

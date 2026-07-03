"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MedexaHeader from "@/components/MedexaHeader";
import { useSelectedDoctor } from "@/components/DoctorContext";
import { useLanguage } from "@/context/LanguageContext";
import { apiSessionToUpcomingSession, medexaApi, type ApiTranscript } from "@/lib/api";
import { setActiveSessionId } from "@/lib/activeSession";
import { sessions, type UpcomingSession } from "@/lib/sessions";
import { formatNumber, translateDynamicMessage, translateStatus } from "@/lib/translations";
import { detectMedexaCommand } from "@/lib/voiceCommands";
import { useMedexaLiveSession } from "@/providers/MedexaLiveSessionProvider";

/* eslint-disable @next/next/no-img-element -- Prototype uses remote avatar URLs without touching next.config.ts. */

type TranscriptStatus = "SUMMARIZED" | "SUMMARY PENDING";

type Transcript = {
  id: string;
  name: string;
  time: string;
  status: TranscriptStatus;
  img: string;
  summary: string;
  transcript: string;
};

const initialTranscripts: Transcript[] = [
  {
    id: "jameson-locke",
    name: "Jameson Locke",
    time: "OCT 23, 11:45 AM",
    status: "SUMMARIZED",
    img: "https://i.pravatar.cc/80?img=14",
    summary:
      "Jameson reported improved sleep and lower pain intensity after completing the home mobility plan.",
    transcript:
      "Patient described steady improvement with fewer nighttime interruptions. Discussed continued stretching, medication adherence, and a follow-up mobility review.",
  },
  {
    id: "sarah-palmer",
    name: "Sarah Palmer",
    time: "OCT 23, 09:20 AM",
    status: "SUMMARY PENDING",
    img: "https://i.pravatar.cc/80?img=24",
    summary:
      "Summary has not been generated yet. Session notes include fatigue, balance concerns, and therapy adherence.",
    transcript:
      "Patient noted moderate fatigue after activity and asked about pacing exercises. Provider reviewed fall prevention cues and recommended shorter activity intervals.",
  },
  {
    id: "michael-chen",
    name: "Michael Chen",
    time: "OCT 23, 09:45 AM",
    status: "SUMMARIZED",
    img: "https://i.pravatar.cc/80?img=8",
    summary:
      "Michael tolerated therapeutic exercises well and demonstrated improved confidence with gait training.",
    transcript:
      "Patient completed the planned exercise sequence with minimal prompting. Reviewed balance work, pain scale, and next session goals.",
  },
  {
    id: "aisha-khan",
    name: "Aisha Khan",
    time: "OCT 23, 10:05 AM",
    status: "SUMMARY PENDING",
    img: "https://i.pravatar.cc/80?img=45",
    summary:
      "Summary has not been generated yet. Transcript includes medication questions and mobility updates.",
    transcript:
      "Patient asked whether morning stiffness is expected after therapy. Provider discussed hydration, warm-up movements, and documenting symptoms.",
  },
  {
    id: "david-lopez",
    name: "David Lopez",
    time: "OCT 23, 10:30 AM",
    status: "SUMMARY PENDING",
    img: "https://i.pravatar.cc/80?img=18",
    summary:
      "Summary has not been generated yet. Session focused on lower back discomfort and activity pacing.",
    transcript:
      "Patient reported lower back tightness after prolonged sitting. Provider reviewed posture changes, home exercises, and when to pause activity.",
  },
];

const transcriptsPerPage = 2;
const sessionDragThreshold = 6;

const apiTranscriptToTranscript = (transcript: ApiTranscript): Transcript => ({
  id: transcript.id,
  name: transcript.patientName,
  time: transcript.time,
  status: transcript.status,
  img: transcript.avatar,
  summary: transcript.summary,
  transcript: transcript.transcript,
});

export default function AmbientListeningPage() {
  const router = useRouter();
  const sessionsRowRef = useRef<HTMLDivElement>(null);
  const sessionDragRef = useRef({
    isDragging: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });
  const [headerSearch, setHeaderSearch] = useState("");
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [transcriptItems, setTranscriptItems] = useState<Transcript[]>(initialTranscripts);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TranscriptStatus | null>(null);
  const [currentTranscriptPage, setCurrentTranscriptPage] = useState(1);
  const [transcriptMessage, setTranscriptMessage] = useState("");
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");
  const [sessionStatusDetail, setSessionStatusDetail] = useState("");
  const [voiceCommandMessage, setVoiceCommandMessage] = useState("");
  const [isDraggingSessions, setIsDraggingSessions] = useState(false);
  const [sessionItems, setSessionItems] = useState<UpcomingSession[]>(sessions);
  const [now, setNow] = useState<Date | null>(null);
  const { selectedDoctor } = useSelectedDoctor();
  const { language, t } = useLanguage();
  const speechSession = useMedexaLiveSession();
  const lastVoiceCommandRef = useRef("");
  const lastVoiceCommandAtRef = useRef(0);

  const normalizedHeaderSearch = headerSearch.trim().toLowerCase();
  const doctorFirstName = selectedDoctor.name.replace(/^Dr\.\s+/, "").split(" ")[0];
  const formattedDateTime = useMemo(() => {
    if (!now) {
      return "";
    }

    const date = new Intl.DateTimeFormat(language, {
      weekday: "long",
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(now);
    const time = new Intl.DateTimeFormat(language, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(now);

    return `${date} • ${time}`;
  }, [language, now]);
  const greeting = useMemo(() => {
    if (!now) {
      return "";
    }

    const hour = now.getHours();
    if (hour >= 5 && hour < 12) {
      return t("common.goodMorning");
    }
    if (hour >= 12 && hour < 17) {
      return t("common.goodAfternoon");
    }
    if (hour >= 17 && hour < 21) {
      return t("common.goodEvening");
    }
    return t("common.goodNight");
  }, [now, t]);

  useEffect(() => {
    const updateNow = () => setNow(new Date());
    updateNow();
    const interval = window.setInterval(updateNow, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadDashboardData = async () => {
      const [apiSessions, apiTranscripts] = await Promise.all([
        medexaApi.sessions(),
        medexaApi.transcripts(),
      ]);

      if (!isMounted) {
        return;
      }

      if (apiSessions) {
        setSessionItems(apiSessions.map(apiSessionToUpcomingSession));
      }

      if (apiTranscripts) {
        setTranscriptItems(apiTranscripts.map(apiTranscriptToTranscript));
      }
    };

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredSessions = useMemo(() => {
    if (!normalizedHeaderSearch) {
      return sessionItems;
    }

    return sessionItems.filter((session) => {
      return [
        session.name,
        session.status,
        session.careType,
        session.cpt,
        session.icd,
        session.time,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedHeaderSearch);
    });
  }, [normalizedHeaderSearch, sessionItems]);

  const startSessionFromVoice = (session: UpcomingSession) => {
    setSessionMessage(`${t("ambient.openingSession")} ${session.name}`);
    setVoiceCommandMessage(t("session.detectedSelected"));
    setActiveSessionId(session.id);
    medexaApi.startSession({
      patient_id: session.id,
      patientName: session.name,
      therapist_id: selectedDoctor.name,
      session_type: session.careType,
    });
    router.push(`/ambient-listening/start-session?sessionId=${session.id}&autoStartRecording=1&source=voice`);
  };

  useEffect(() => {
    speechSession.autoStartTriggerMode();
  }, [speechSession.autoStartTriggerMode]);

  useEffect(() => {
    if (speechSession.permissionStatus === "unsupported" || speechSession.triggerPermissionStatus === "unsupported") {
      setVoiceCommandMessage(t("session.webSpeechUnsupported"));
      return;
    }

    if (
      speechSession.permissionStatus === "denied" ||
      speechSession.permissionStatus === "prompt" ||
      speechSession.triggerPermissionStatus === "required" ||
      speechSession.permissionError
    ) {
      setVoiceCommandMessage(t("session.voiceMicrophoneRequired"));
      return;
    }

    if (speechSession.permissionStatus === "granted") {
      setVoiceCommandMessage(t("session.listening"));
    }
  }, [
    speechSession.permissionError,
    speechSession.permissionStatus,
    speechSession.triggerPermissionStatus,
  ]);

  useEffect(() => {
    if (!speechSession.lastHeardText) {
      return;
    }

    const detection = detectMedexaCommand(speechSession.lastHeardText);
    if (detection.command !== "start_session" && detection.command !== "start_recording") {
      return;
    }

    const now = Date.now();
    if (
      lastVoiceCommandRef.current === detection.phrase &&
      now - lastVoiceCommandAtRef.current < 5000
    ) {
      return;
    }

    lastVoiceCommandRef.current = detection.phrase;
    lastVoiceCommandAtRef.current = now;
    const nextSession = filteredSessions[0] ?? sessionItems[0] ?? sessions[0];
    startSessionFromVoice(nextSession);
  }, [filteredSessions, sessionItems, speechSession.lastHeardText]);

  const openSession = (session: UpcomingSession) => {
    if (sessionDragRef.current.moved) {
      return;
    }

    setSessionMessage(`${t("ambient.openingSession")} ${session.name}`);
    setActiveSessionId(session.id);
    medexaApi.startSession({
      patient_id: session.id,
      patientName: session.name,
      therapist_id: selectedDoctor.name,
      session_type: session.careType,
    });
    router.push(`/ambient-listening/session?sessionId=${session.id}`);
  };

  const startNewSession = () => {
    setSessionMessage(t("ambient.startingNewSession"));
    setActiveSessionId("new-session");
    medexaApi.startSession({
      session_id: "new-session",
      therapist_id: selectedDoctor.name,
      session_type: "Therapeutic Therapy Session",
    });
    router.push("/ambient-listening/start-session?sessionId=new-session&autoStartRecording=1&source=manual");
  };

  const showSessionStatus = (session: UpcomingSession) => {
    setSessionStatusDetail(
      `${session.name} ${session.status === "active" ? t("ambient.activeSessionStatus") : t("ambient.awaitingSessionStatus")} ${session.time}.`,
    );
  };

  const scrollSessions = () => {
    const row = sessionsRowRef.current;

    if (!row) {
      return;
    }

    const maxScrollLeft = row.scrollWidth - row.clientWidth;
    const nextScrollLeft = row.scrollLeft + Math.max(row.clientWidth * 0.8, 320);
    const isNearEnd = row.scrollLeft >= maxScrollLeft - 16 || nextScrollLeft >= maxScrollLeft;

    row.scrollTo({
      left: isNearEnd ? 0 : nextScrollLeft,
      behavior: "smooth",
    });
  };

  const startSessionDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    const row = sessionsRowRef.current;

    if (!row) {
      return;
    }

    sessionDragRef.current = {
      isDragging: true,
      startX: event.clientX,
      scrollLeft: row.scrollLeft,
      moved: false,
    };
    setIsDraggingSessions(true);
  };

  const moveSessionDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    const row = sessionsRowRef.current;
    const dragState = sessionDragRef.current;

    if (!row || !dragState.isDragging) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    if (Math.abs(deltaX) > sessionDragThreshold) {
      dragState.moved = true;
    }

    row.scrollLeft = dragState.scrollLeft - deltaX;
  };

  const endSessionDrag = () => {
    sessionDragRef.current.isDragging = false;
    setIsDraggingSessions(false);

    window.setTimeout(() => {
      sessionDragRef.current.moved = false;
    }, 0);
  };

  const filteredTranscripts = useMemo(() => {
    const query = transcriptSearch.trim().toLowerCase();

    return transcriptItems.filter((item) => {
      const headerMatch =
        !normalizedHeaderSearch ||
        item.name.toLowerCase().includes(normalizedHeaderSearch) ||
        item.status.toLowerCase().includes(normalizedHeaderSearch) ||
        item.summary.toLowerCase().includes(normalizedHeaderSearch);
      const transcriptMatch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.status.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query);
      const statusMatch = !statusFilter || item.status === statusFilter;

      return headerMatch && transcriptMatch && statusMatch;
    });
  }, [normalizedHeaderSearch, statusFilter, transcriptItems, transcriptSearch]);

  const totalTranscriptPages = Math.max(
    1,
    Math.ceil(filteredTranscripts.length / transcriptsPerPage),
  );
  const visibleTranscriptPage = Math.min(currentTranscriptPage, totalTranscriptPages);
  const paginatedTranscripts = filteredTranscripts.slice(
    (visibleTranscriptPage - 1) * transcriptsPerPage,
    visibleTranscriptPage * transcriptsPerPage,
  );
  const selectedTranscript =
    transcriptItems.find((item) => item.id === selectedTranscriptId) ?? null;

  const toggleStatusFilter = (status: TranscriptStatus) => {
    setStatusFilter((current) => (current === status ? null : status));
    setCurrentTranscriptPage(1);
    setTranscriptMessage(
      statusFilter === status
        ? t("ambient.statusFilterCleared")
        : `${status === "SUMMARIZED" ? t("ambient.summarized") : t("ambient.summaryPending")} ${t("ambient.statusFilterApplied")}`,
    );
  };

  const generateSummary = async (id: string) => {
    const generatedTranscript = await medexaApi.generateTranscriptSummary(id);

    if (generatedTranscript) {
      setTranscriptItems((items) =>
        items.map((item) =>
          item.id === id ? apiTranscriptToTranscript(generatedTranscript) : item,
        ),
      );
      setTranscriptMessage(t("ambient.summaryGenerated"));
      return;
    }

    setTranscriptItems((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "SUMMARIZED",
              summary: t("ambient.generatedSummary", { patientName: item.name }),
            }
          : item,
      ),
    );
    setTranscriptMessage(t("ambient.summaryGenerated"));
  };

  const markAsSummarized = (id: string) => {
    setTranscriptItems((items) =>
      items.map((item) => (item.id === id ? { ...item, status: "SUMMARIZED" } : item)),
    );
    setTranscriptMessage(t("ambient.summaryGenerated"));
  };

  return (
    <main className="ambient-page">
      <MedexaHeader
        searchValue={headerSearch}
        onSearchChange={(value) => {
          setHeaderSearch(value);
          setCurrentTranscriptPage(1);
        }}
      />

      <section className="content">
        <p className="date">{formattedDateTime}</p>

        <section className="hero">
          <h1>
            {greeting || t("common.goodMorning")},
            <br />
            Dr. {doctorFirstName}
          </h1>

          <button type="button" className="start-session" onClick={startNewSession}>
            <span className="mic-icon">◉</span>
            <span>
              <strong>{t("ambient.startNewSession")}</strong>
              <em>{t("ambient.startPrompt")}</em>
            </span>
          </button>
        </section>

        <section className="sessions-section">
          <div className="section-heading">
            <div>
              <h2>{t("ambient.upcomingSessions")}</h2>
              <p>{formatNumber(sessionItems.length, language)} {t("ambient.sessionsRemaining")}</p>
            </div>
            <div className="heading-actions">
              <button type="button" onClick={() => setIsSessionsModalOpen(true)}>
                {t("ambient.viewAllUpcoming")}
              </button>
              <button type="button" aria-label="Scroll upcoming sessions" onClick={scrollSessions}>
                ↗
              </button>
            </div>
          </div>

          {(sessionMessage || sessionStatusDetail || voiceCommandMessage) && (
            <div className="session-feedback" aria-live="polite">
              {sessionMessage && <strong>{sessionMessage}</strong>}
              {sessionStatusDetail && <span>{sessionStatusDetail}</span>}
              {voiceCommandMessage && <span>{voiceCommandMessage}</span>}
            </div>
          )}

          <div
            className={`sessions-row ${isDraggingSessions ? "is-dragging" : ""}`}
            ref={sessionsRowRef}
            onMouseDown={startSessionDrag}
            onMouseMove={moveSessionDrag}
            onMouseUp={endSessionDrag}
            onMouseLeave={endSessionDrag}
            onDragStart={(event) => event.preventDefault()}
          >
            {filteredSessions.map((session) => (
              <article
                key={session.id}
                className="session-card"
                role="button"
                tabIndex={0}
                onClick={() => openSession(session)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openSession(session);
                  }
                }}
              >
                <img src={session.img} alt="" />
                {session.status === "active" ? (
                  <button
                    type="button"
                    className="session-action"
                    aria-label={t("ambient.sessionAria", { patientName: session.name })}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (sessionDragRef.current.moved) {
                        return;
                      }
                      openSession(session);
                    }}
                  >
                    ↗
                  </button>
                ) : (
                  <button
                    type="button"
                    className="session-status"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (sessionDragRef.current.moved) {
                        return;
                      }
                      showSessionStatus(session);
                    }}
                  >
                    {translateStatus(session.status, language)}
                  </button>
                )}
                <h3>{session.name}</h3>
                <p className="care-type">
                  <span /> {translateDynamicMessage(session.careType, language)}
                </p>
                <p className="codes">
                  CPT: {session.cpt}&nbsp;&nbsp;ICD: {session.icd}
                </p>
                <p className="session-time">{translateDynamicMessage(session.time, language)}</p>
              </article>
            ))}
            {filteredSessions.length === 0 && (
              <div className="sessions-empty">
                {t("ambient.noUpcoming")}
              </div>
            )}
          </div>

          {isSessionsModalOpen && (
            <div className="sessions-modal" role="dialog" aria-modal="true" aria-labelledby="sessions-modal-title">
              <section className="sessions-modal-panel">
                <div className="sessions-modal-heading">
                  <div>
                    <h3 id="sessions-modal-title">{t("ambient.allUpcoming")}</h3>
                    <p>{formatNumber(sessionItems.length, language)} {t("ambient.sessionsScheduled")}</p>
                  </div>
                  <button type="button" onClick={() => setIsSessionsModalOpen(false)}>
                    {t("common.close")}
                  </button>
                </div>

                <div className="sessions-list">
                  {sessionItems.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      className="session-list-item"
                      onClick={() => openSession(session)}
                    >
                      <img src={session.img} alt="" />
                      <span>
                        <strong>{session.name}</strong>
                        <em>{translateDynamicMessage(session.careType, language)}</em>
                      </span>
                      <time>{translateDynamicMessage(session.time, language)}</time>
                      <b>{translateStatus(session.status, language)}</b>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}
        </section>

        <section className="transcripts-section">
          <div className="section-heading transcripts-heading">
            <div>
              <h2>{t("ambient.recentTranscriptions")}</h2>
              <p>{t("ambient.showingTranscriptions")}</p>
            </div>

            <label className="transcript-search">
              <span>⌕</span>
              <input
                aria-label={t("ambient.searchTranscriptions")}
                placeholder={t("ambient.searchTranscriptions")}
                type="search"
                value={transcriptSearch}
                onChange={(event) => {
                  setTranscriptSearch(event.target.value);
                  setCurrentTranscriptPage(1);
                }}
              />
            </label>
          </div>

          <div className="transcripts-card">
            {paginatedTranscripts.map((item) => (
              <div
                key={item.id}
                className="transcript-row"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedTranscriptId(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedTranscriptId(item.id);
                  }
                }}
              >
                <div className="patient">
                  <img src={item.img} alt="" />
                  <strong>{item.name}</strong>
                </div>
                <time>{translateDynamicMessage(item.time, language)}</time>
                <button
                  type="button"
                  className={
                    item.status === "SUMMARIZED"
                      ? `badge badge-summarized ${statusFilter === item.status ? "is-active" : ""}`
                      : `badge badge-pending ${statusFilter === item.status ? "is-active" : ""}`
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleStatusFilter(item.status);
                  }}
                >
                  {item.status === "SUMMARIZED" ? t("ambient.summarized") : t("ambient.summaryPending")}
                </button>
                <button
                  type="button"
                  className="row-arrow"
                  aria-label={`${t("ambient.openTranscript")} ${item.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedTranscriptId(item.id);
                  }}
                >
                  ›
                </button>
              </div>
            ))}
            {filteredTranscripts.length === 0 && (
              <div className="transcripts-empty">
                <strong>{t("ambient.noTranscriptions")}</strong>
                <span>{t("ambient.noTranscriptionsHint")}</span>
              </div>
            )}
          </div>

          {(statusFilter || transcriptMessage) && (
            <div className="transcript-feedback" aria-live="polite">
              {statusFilter && <span>{statusFilter === "SUMMARIZED" ? t("ambient.summarized") : t("ambient.summaryPending")}</span>}
              {transcriptMessage && <strong>{transcriptMessage}</strong>}
            </div>
          )}

          {selectedTranscript && (
            <section className="transcript-detail" aria-label="Transcript detail">
              <div className="detail-heading">
                <div className="patient">
                  <img src={selectedTranscript.img} alt="" />
                  <div>
                    <h3>{selectedTranscript.name}</h3>
                    <time>{translateDynamicMessage(selectedTranscript.time, language)}</time>
                  </div>
                </div>
                <span
                  className={
                    selectedTranscript.status === "SUMMARIZED"
                      ? "badge badge-summarized"
                      : "badge badge-pending"
                  }
                >
                  {selectedTranscript.status === "SUMMARIZED" ? t("ambient.summarized") : t("ambient.summaryPending")}
                </span>
              </div>

              <div className="detail-body">
                <div>
                  <h4>{t("ambient.summarized")}</h4>
                  <p>{translateDynamicMessage(selectedTranscript.summary, language)}</p>
                </div>
                <div>
                  <h4>{t("ambient.transcript")}</h4>
                  <p>{translateDynamicMessage(selectedTranscript.transcript, language)}</p>
                </div>
              </div>

              <div className="detail-actions">
                <button type="button" onClick={() => setTranscriptMessage(translateDynamicMessage(selectedTranscript.summary, language))}>
                  {t("ambient.openTranscript")}
                </button>
                {selectedTranscript.status === "SUMMARY PENDING" && (
                  <button type="button" onClick={() => generateSummary(selectedTranscript.id)}>
                    {t("ambient.generateSummary")}
                  </button>
                )}
                <button type="button" onClick={() => markAsSummarized(selectedTranscript.id)}>
                  {t("ambient.summarized")}
                </button>
                <button type="button" onClick={() => setSelectedTranscriptId(null)}>
                  {t("common.close")}
                </button>
              </div>
            </section>
          )}

          {filteredTranscripts.length > 0 && (
            <nav className="pagination" aria-label="Transcription pages">
              <button
                type="button"
                disabled={visibleTranscriptPage === 1}
                onClick={() => setCurrentTranscriptPage((page) => Math.max(1, page - 1))}
              >
                {t("pagination.previous")}
              </button>
              {[1, 2, 3].map((page) => (
                <button
                  key={page}
                  type="button"
                  disabled={page > totalTranscriptPages}
                  className={page === visibleTranscriptPage ? "current-page" : ""}
                  onClick={() => setCurrentTranscriptPage(page)}
                >
                  {formatNumber(page, language)}
                </button>
              ))}
              <button
                type="button"
                disabled={visibleTranscriptPage === totalTranscriptPages}
                onClick={() =>
                  setCurrentTranscriptPage((page) => Math.min(totalTranscriptPages, page + 1))
                }
              >
                {t("pagination.next")}
              </button>
            </nav>
          )}
        </section>
      </section>

      <style>{`
        .ambient-page {
          min-height: 100vh;
          overflow-x: hidden;
          background: #eef1f6;
          color: #151820;
          font-family: Arial, Helvetica, sans-serif;
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

        .content {
          box-sizing: border-box;
          width: 100%;
          min-height: calc(100vh - 64px);
          margin: 0 auto;
          padding: 20px clamp(16px, 3vw, 32px) 36px;
          background: #fbfbfc;
        }

        .date {
          margin: 0 0 10px;
          color: #687386;
          font-size: 12px;
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 440px);
          align-items: center;
          gap: 40px;
          padding: 0 0 24px;
          border-bottom: 1px solid #e8edf5;
        }

        h1,
        h2,
        h3,
        p {
          margin-top: 0;
        }

        .hero h1 {
          margin: 0;
          color: #16181e;
          font-size: 38px;
          font-weight: 300;
          line-height: 1.12;
          letter-spacing: -0.8px;
        }

        .start-session {
          box-sizing: border-box;
          min-height: 70px;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 22px;
          border-radius: 14px;
          border: 0;
          background: #ffffff;
          color: inherit;
          font: inherit;
          text-align: left;
          text-decoration: none;
          box-shadow: 0 10px 28px rgba(25, 32, 56, 0.13);
          cursor: pointer;
        }

        .mic-icon {
          width: 36px;
          height: 36px;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #b8c2ff;
          border-radius: 50%;
          background: #f0f2ff;
          color: #001eff;
          font-size: 16px;
        }

        .start-session strong {
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
          line-height: 1;
        }

        .start-session em {
          display: block;
          overflow: hidden;
          color: #637085;
          font-size: 11px;
          font-style: normal;
          line-height: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .sessions-section {
          margin-top: 26px;
          min-width: 0;
        }

        .section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .section-heading h2 {
          margin: 0;
          color: #20242d;
          font-size: 18px;
          font-weight: 500;
          line-height: 1.2;
        }

        .section-heading p {
          margin: 6px 0 0;
          color: #9aa5b6;
          font-size: 12px;
        }

        .heading-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .heading-actions button {
          height: 38px;
          border: 0;
          border-radius: 999px;
          background: #ffffff;
          color: #06105f;
          font-size: 12px;
          font-weight: 700;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
          cursor: pointer;
        }

        .heading-actions button:first-child {
          padding: 0 22px;
        }

        .heading-actions button:last-child {
          width: 38px;
          padding: 0;
          color: #001eff;
        }

        .sessions-row {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          display: flex;
          flex-wrap: nowrap;
          gap: 16px;
          margin-top: 18px;
          padding: 2px 2px 14px;
          overflow-x: auto;
          overflow-y: hidden;
          overscroll-behavior-x: contain;
          scroll-behavior: smooth;
          scrollbar-width: none;
          cursor: grab;
          user-select: none;
        }

        .sessions-row::-webkit-scrollbar {
          display: none;
        }

        .sessions-row.is-dragging {
          cursor: grabbing;
        }

        .session-feedback {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
          color: #667085;
          font-size: 11px;
        }

        .session-feedback strong,
        .session-feedback span {
          border-radius: 999px;
          background: #fff;
          padding: 6px 10px;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
        }

        .session-feedback strong {
          color: #001eff;
        }

        .session-card {
          position: relative;
          width: clamp(210px, 22vw, 270px);
          height: 166px;
          flex: 0 0 clamp(210px, 22vw, 270px);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 18px 16px;
          border-radius: 12px;
          background: #ffffff;
          color: inherit;
          text-decoration: none;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1);
          border: 0;
          cursor: inherit;
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }

        .session-card:hover,
        .session-card:focus-visible {
          outline: 0;
          transform: translateY(-2px);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.14);
        }

        .session-card img {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
        }

        .session-action {
          position: absolute;
          top: 20px;
          right: 16px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #080665;
          color: #ffffff;
          font-size: 12px;
          border: 0;
          cursor: pointer;
        }

        .session-status {
          position: absolute;
          top: 24px;
          right: 16px;
          border: 0;
          background: transparent;
          color: #a1abbc;
          font-size: 10px;
          cursor: pointer;
        }

        .session-card h3 {
          margin: 14px 0 0;
          color: #111827;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.1;
          max-width: calc(100% - 40px);
        }

        .care-type {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 12px 0 0;
          color: #222733;
          font-size: 10px;
          font-weight: 600;
          line-height: 1;
          white-space: nowrap;
        }

        .care-type span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #001eff;
        }

        .codes {
          margin: 6px 0 0;
          color: #56647a;
          font-size: 9px;
          line-height: 1.2;
          white-space: nowrap;
        }

        .session-time {
          margin: auto 0 0;
          color: #172033;
          font-size: 11px;
          line-height: 1.2;
          white-space: nowrap;
        }

        .sessions-empty {
          min-height: 120px;
          flex: 1 0 240px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed #d8deea;
          border-radius: 12px;
          background: #fff;
          color: #667085;
          font-size: 12px;
        }

        .sessions-modal {
          position: fixed;
          inset: 0;
          z-index: 40;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.24);
        }

        .sessions-modal-panel {
          width: min(100%, 720px);
          max-height: min(80vh, 640px);
          overflow: hidden;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.2);
        }

        .sessions-modal-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 18px 12px;
          border-bottom: 1px solid #edf1f6;
        }

        .sessions-modal-heading h3 {
          margin: 0;
          color: #172033;
          font-size: 16px;
          font-weight: 800;
        }

        .sessions-modal-heading p {
          margin: 4px 0 0;
          color: #7f8ba0;
          font-size: 11px;
        }

        .sessions-modal-heading button {
          border: 0;
          border-radius: 999px;
          background: #eef2ff;
          color: #001eff;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .sessions-list {
          max-height: 520px;
          overflow-y: auto;
          padding: 8px;
        }

        .session-list-item {
          width: 100%;
          min-height: 64px;
          display: grid;
          grid-template-columns: 42px minmax(160px, 1fr) minmax(120px, auto) minmax(78px, auto);
          align-items: center;
          gap: 12px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          padding: 10px;
          color: #172033;
          text-align: left;
          cursor: pointer;
        }

        .session-list-item:hover {
          background: #f8fafc;
        }

        .session-list-item img {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          object-fit: cover;
        }

        .session-list-item span,
        .session-list-item strong,
        .session-list-item em {
          display: block;
        }

        .session-list-item strong {
          font-size: 12px;
          font-weight: 800;
        }

        .session-list-item em,
        .session-list-item time {
          color: #7f8ba0;
          font-size: 11px;
          font-style: normal;
        }

        .session-list-item b {
          width: fit-content;
          border-radius: 999px;
          background: #f1f3f6;
          color: #172033;
          padding: 5px 9px;
          font-size: 10px;
        }

        .transcripts-section {
          margin-top: 30px;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        .transcripts-heading {
          margin-bottom: 16px;
        }

        .transcript-search {
          width: min(100%, 300px);
          height: 36px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 18px;
          border: 1px solid #e2e7ef;
          border-radius: 999px;
          background: #ffffff;
          color: #9aa6ba;
          font-size: 12px;
          white-space: nowrap;
        }

        .transcript-search span {
          color: #001eff;
          font-size: 12px;
        }

        .transcript-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #172033;
          font: inherit;
        }

        .transcript-search input::placeholder {
          color: #9aa6ba;
        }

        .transcripts-card {
          overflow: hidden;
          width: 100%;
          box-sizing: border-box;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.07);
        }

        .transcript-row {
          min-height: 64px;
          display: grid;
          grid-template-columns: minmax(220px, 1fr) minmax(132px, 160px) minmax(145px, 170px) 22px;
          align-items: center;
          box-sizing: border-box;
          column-gap: 18px;
          padding: 12px 24px;
          border-bottom: 1px solid #edf1f6;
          cursor: pointer;
          transition: background 0.16s ease;
        }

        .transcript-row:last-child {
          border-bottom: 0;
        }

        .transcript-row:hover,
        .transcript-row:focus-visible {
          background: #f8fafc;
          outline: 0;
        }

        .patient {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        .patient img {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          object-fit: cover;
        }

        .patient strong {
          overflow: hidden;
          color: #172033;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .transcript-row time {
          color: #7f8ba0;
          font-size: 11px;
          white-space: nowrap;
        }

        .badge {
          width: fit-content;
          border: 0;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 10px;
          font-weight: 800;
          line-height: 1;
          white-space: nowrap;
          cursor: pointer;
        }

        .badge-summarized {
          background: #c9faec;
          color: #00956c;
        }

        .badge-pending {
          background: #f1f3f6;
          color: #161b25;
        }

        .badge.is-active {
          box-shadow: 0 0 0 2px #001eff22;
        }

        .row-arrow {
          border: 0;
          background: transparent;
          color: #111827;
          font-size: 20px;
          line-height: 1;
          text-align: right;
          cursor: pointer;
        }

        .transcripts-empty {
          min-height: 132px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 24px;
          color: #667085;
          text-align: center;
        }

        .transcripts-empty strong {
          color: #172033;
          font-size: 14px;
        }

        .transcripts-empty span {
          font-size: 12px;
        }

        .transcript-feedback {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
          color: #667085;
          font-size: 11px;
        }

        .transcript-feedback span,
        .transcript-feedback strong {
          border-radius: 999px;
          background: #fff;
          padding: 6px 10px;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
        }

        .transcript-feedback strong {
          color: #087c4a;
          font-weight: 800;
        }

        .transcript-detail {
          margin-top: 12px;
          border-radius: 12px;
          background: #fff;
          padding: 18px;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.07);
        }

        .detail-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding-bottom: 14px;
          border-bottom: 1px solid #edf1f6;
        }

        .detail-heading h3 {
          margin: 0;
          color: #172033;
          font-size: 14px;
          font-weight: 800;
        }

        .detail-heading time {
          display: block;
          margin-top: 4px;
          color: #7f8ba0;
          font-size: 11px;
        }

        .detail-body {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-top: 14px;
        }

        .detail-body h4 {
          margin: 0;
          color: #172033;
          font-size: 11px;
          font-weight: 800;
        }

        .detail-body p {
          margin: 8px 0 0;
          color: #536071;
          font-size: 12px;
          line-height: 1.5;
        }

        .detail-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 16px;
        }

        .detail-actions button,
        .pagination button {
          border: 1px solid #dce3ed;
          border-radius: 999px;
          background: #fff;
          color: #172033;
          padding: 7px 12px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .detail-actions button:nth-child(2),
        .detail-actions button:first-child:hover,
        .pagination button:hover:not(:disabled) {
          border-color: #001eff;
          background: #eef2ff;
          color: #001eff;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin-top: 16px;
          color: #4c596d;
          font-size: 11px;
        }

        .current-page {
          padding: 5px 9px;
          border: 1px solid #dce3ed;
          border-radius: 4px;
          background: #f8fafc;
          color: #172033;
        }

        .pagination button.current-page {
          border-color: #001eff;
          background: #eef2ff;
          color: #001eff;
        }

        .pagination button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
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

          .hero {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .section-heading,
          .transcripts-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .content {
            padding: 18px 16px 28px;
          }

          .transcripts-card {
            overflow: visible;
          }

          .transcript-row {
            min-width: 0;
            grid-template-columns: 1fr;
            gap: 10px;
            padding: 14px;
          }

          .row-arrow {
            justify-self: end;
          }

          .detail-body {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

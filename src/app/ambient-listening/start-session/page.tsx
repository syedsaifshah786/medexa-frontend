"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MedexaHeader from "@/components/MedexaHeader";
import { useSelectedDoctor } from "@/components/DoctorContext";
import { medexaApi } from "@/lib/api";
import { setActiveSessionId } from "@/lib/activeSession";
import { getSessionById } from "@/lib/sessions";
import { useMedexaLiveSession } from "@/providers/MedexaLiveSessionProvider";

/* eslint-disable @next/next/no-img-element -- Prototype uses remote avatar URLs without touching next.config.ts. */

const REDIRECT_SECONDS = 6;

const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export default function StartSessionPage() {
  return (
    <Suspense fallback={null}>
      <StartSessionContent />
    </Suspense>
  );
}

function StartSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedDoctor } = useSelectedDoctor();
  const liveSession = useMedexaLiveSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const [hasStartedRedirect, setHasStartedRedirect] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const autoStartHandledRef = useRef(false);
  const redirectStartedAtRef = useRef<number | null>(null);

  const routeSessionId = searchParams.get("sessionId") ?? "new-session";
  const source = searchParams.get("source") ?? "manual";
  const shouldAutoStartRecording = searchParams.get("autoStartRecording") === "1";
  const selectedSession = useMemo(() => getSessionById(routeSessionId), [routeSessionId]);
  const isRecording = liveSession.recordingStatus === "recording";
  const isListening = isRecording && liveSession.isListening;
  const hasMicWarning =
    liveSession.permissionStatus === "denied" ||
    liveSession.triggerPermissionStatus === "required" ||
    Boolean(liveSession.permissionError);

  const beginRecording = useCallback(async () => {
    if (isStarting || hasStartedRedirect) {
      return;
    }

    setIsStarting(true);
    setActiveSessionId(routeSessionId);
    medexaApi.startSession({
      session_id: routeSessionId,
      patient_id: routeSessionId,
      patientName: selectedSession.name,
      therapist_id: selectedDoctor.name,
      session_type: selectedSession.careType,
    });
    const didStartRecording = await liveSession.startRecording(routeSessionId);

    if (!didStartRecording) {
      setIsStarting(false);
      return;
    }

    medexaApi.startSessionTimer(routeSessionId);
    setHasStartedRedirect(true);
    redirectStartedAtRef.current = Date.now();
    setCountdown(REDIRECT_SECONDS);
    setIsStarting(false);
  }, [
    hasStartedRedirect,
    isStarting,
    liveSession,
    routeSessionId,
    selectedDoctor.name,
    selectedSession.careType,
    selectedSession.name,
  ]);

  useEffect(() => {
    if (!shouldAutoStartRecording || autoStartHandledRef.current) {
      return;
    }

    autoStartHandledRef.current = true;
    void beginRecording();
  }, [beginRecording, shouldAutoStartRecording]);

  useEffect(() => {
    if (!hasStartedRedirect) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const startedAt = redirectStartedAtRef.current ?? Date.now();
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const nextCountdown = Math.max(REDIRECT_SECONDS - elapsedSeconds, 0);
      setCountdown(nextCountdown);

      if (nextCountdown <= 0) {
        window.clearInterval(intervalId);
        router.push(
          `/ambient-listening/session?sessionId=${encodeURIComponent(routeSessionId)}&continueRecording=1&source=${encodeURIComponent(source)}`,
        );
      }
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasStartedRedirect, routeSessionId, router, source]);

  return (
    <main className="start-session-page">
      <MedexaHeader searchValue={searchQuery} onSearchChange={setSearchQuery} />

      <section className="start-session-shell">
        <Link href="/ambient-listening" className="back-link" aria-label="Back to Ambient Listening">
          &larr; Ambient Listening
        </Link>

        <section className="start-session-card" aria-live="polite">
          <div className={`avatar-radar ${isListening ? "is-active" : ""}`}>
            <span className="radar-ring ring-one" aria-hidden="true" />
            <span className="radar-ring ring-two" aria-hidden="true" />
            <span className="radar-ring ring-three" aria-hidden="true" />
            <span className="radar-scan" aria-hidden="true" />
            <span className="avatar-frame">
              <img src={selectedSession.img} alt="" />
            </span>
            <span className="mic-dot" aria-hidden="true">
              <span />
            </span>
          </div>

          <div className={`status-pill ${isRecording ? "is-recording" : "is-idle"}`}>
            <span aria-hidden="true" />
            {isRecording ? "Medexa is listening" : "Medexa is ready"}
          </div>

          <div className="session-heading">
            <h1>{isRecording ? "Starting Session" : "Start Session"}</h1>
            <p>
              <strong>{selectedSession.name}</strong>
              <span>{selectedSession.careType}</span>
            </p>
          </div>

          <div className="timer" dir="ltr">
            {formatDuration(liveSession.totalSeconds)}
          </div>

          <div className={`audio-bars ${isListening ? "is-active" : ""}`} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>

          {hasMicWarning && (
            <div className="permission-card">
              Microphone permission is required to start recording.
            </div>
          )}

          <div className="session-actions">
            {!hasStartedRedirect && (
              <button
                type="button"
                className="start-recording-button"
                disabled={isStarting}
                onClick={() => void beginRecording()}
              >
                {isStarting ? "Starting..." : "Start Recording"}
              </button>
            )}
            {isRecording && (
              <button type="button" className="stop-button" onClick={liveSession.stopRecording}>
                Cancel and Stop
              </button>
            )}
          </div>

          <p className="support-text">
            {isRecording
              ? "Recording will continue into the live session screen."
              : "Ready to record"}
          </p>

          {hasStartedRedirect && (
            <p className="redirect-text">
              Redirecting to live session in {countdown} seconds...
            </p>
          )}

          <div className="debug-strip">
            <span>sessionId: {routeSessionId}</span>
            <span>source: {source}</span>
            <span>recordingStatus: {liveSession.recordingStatus}</span>
            <span>isListening: {liveSession.isListening ? "true" : "false"}</span>
            <span>permissionStatus: {liveSession.permissionStatus}</span>
            <span>totalSeconds: {liveSession.totalSeconds}</span>
            <span>latestHeardText: {liveSession.lastHeardText || "none"}</span>
            <span>fullTranscript length: {liveSession.liveTranscript.length}</span>
            <span>redirect countdown: {hasStartedRedirect ? countdown : "idle"}</span>
          </div>
        </section>
      </section>

      <style>{`
        .start-session-page {
          min-height: 100vh;
          background: #fbfbfc;
          color: #172033;
        }

        .start-session-shell {
          box-sizing: border-box;
          min-height: calc(100vh - 64px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 18px;
          padding: 30px clamp(16px, 4vw, 40px) 44px;
        }

        .back-link {
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 36px;
          border: 1px solid #dfe6f4;
          border-radius: 999px;
          background: #ffffff;
          color: #001eff;
          padding: 0 14px;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.07);
        }

        .start-session-card {
          width: min(100%, 680px);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 1px solid #edf1f7;
          border-radius: 28px;
          background:
            radial-gradient(circle at top, rgba(0, 30, 255, 0.07), transparent 38%),
            #ffffff;
          padding: clamp(26px, 5vw, 44px);
          text-align: center;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
        }

        .avatar-radar {
          position: relative;
          width: 190px;
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 22px;
          border-radius: 50%;
        }

        .radar-ring,
        .radar-scan {
          position: absolute;
          inset: 0;
          border-radius: 50%;
        }

        .ring-one {
          inset: 30px;
          border: 1px solid rgba(0, 30, 255, 0.14);
          background: rgba(0, 30, 255, 0.035);
        }

        .ring-two {
          inset: 14px;
          border: 1px solid rgba(105, 65, 198, 0.16);
        }

        .ring-three {
          border: 1px solid rgba(0, 30, 255, 0.1);
        }

        .radar-scan {
          opacity: 0;
          background: conic-gradient(from 0deg, rgba(0, 30, 255, 0.2), rgba(105, 65, 198, 0.04) 42deg, transparent 86deg);
        }

        .avatar-radar.is-active .radar-scan {
          opacity: 1;
          animation: radar-sweep 2.2s linear infinite;
        }

        .avatar-radar.is-active .radar-ring {
          animation: radar-pulse 1.8s ease-out infinite;
        }

        .avatar-radar.is-active .ring-two {
          animation-delay: 0.28s;
        }

        .avatar-radar.is-active .ring-three {
          animation-delay: 0.56s;
        }

        .avatar-frame {
          position: relative;
          z-index: 2;
          width: 96px;
          height: 96px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 7px solid #ffffff;
          border-radius: 50%;
          background: #eef2ff;
          box-shadow: 0 18px 38px rgba(0, 30, 255, 0.18);
        }

        .avatar-frame img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }

        .mic-dot {
          position: absolute;
          right: 42px;
          bottom: 34px;
          z-index: 3;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 4px solid #ffffff;
          border-radius: 50%;
          background: #0800d8;
          box-shadow: 0 10px 22px rgba(8, 0, 216, 0.24);
        }

        .mic-dot span {
          width: 10px;
          height: 14px;
          border-radius: 999px;
          background: #ffffff;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 30px;
          border-radius: 999px;
          padding: 0 13px;
          font-size: 12px;
          font-weight: 900;
        }

        .status-pill span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-pill.is-idle {
          background: #f3f5fa;
          color: #5d687a;
        }

        .status-pill.is-idle span {
          background: #9aa6ba;
        }

        .status-pill.is-recording {
          background: #eaf8f1;
          color: #087c4a;
        }

        .status-pill.is-recording span {
          background: #10c978;
          box-shadow: 0 0 0 5px rgba(16, 201, 120, 0.15);
        }

        .session-heading {
          margin-top: 18px;
        }

        .session-heading h1 {
          margin: 0;
          color: #141824;
          font-size: clamp(30px, 5vw, 44px);
          font-weight: 500;
          line-height: 1.05;
        }

        .session-heading p {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
          margin: 10px 0 0;
          color: #667085;
          font-size: 14px;
        }

        .session-heading strong {
          color: #172033;
          font-weight: 900;
        }

        .session-heading span::before {
          content: "";
          width: 4px;
          height: 4px;
          display: inline-block;
          margin: 0 8px 2px 0;
          border-radius: 50%;
          background: #001eff;
        }

        .timer {
          margin-top: 26px;
          color: #001eff;
          font-size: clamp(54px, 11vw, 82px);
          font-weight: 800;
          line-height: 0.95;
          font-variant-numeric: tabular-nums;
        }

        .audio-bars {
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin: 24px 0 8px;
        }

        .audio-bars i {
          width: 7px;
          height: 18px;
          border-radius: 999px;
          background: linear-gradient(180deg, #6941c6 0%, #001eff 100%);
          opacity: 0.35;
        }

        .audio-bars.is-active i {
          opacity: 1;
          animation: audio-wave 0.82s ease-in-out infinite;
        }

        .audio-bars i:nth-child(2) { animation-delay: 0.06s; height: 28px; }
        .audio-bars i:nth-child(3) { animation-delay: 0.12s; height: 40px; }
        .audio-bars i:nth-child(4) { animation-delay: 0.18s; height: 26px; }
        .audio-bars i:nth-child(5) { animation-delay: 0.24s; height: 48px; }
        .audio-bars i:nth-child(6) { animation-delay: 0.3s; height: 30px; }
        .audio-bars i:nth-child(7) { animation-delay: 0.36s; height: 42px; }
        .audio-bars i:nth-child(8) { animation-delay: 0.42s; height: 24px; }
        .audio-bars i:nth-child(9) { animation-delay: 0.48s; height: 34px; }

        .permission-card {
          width: min(100%, 430px);
          box-sizing: border-box;
          margin-top: 14px;
          border: 1px solid #ffd7a8;
          border-radius: 14px;
          background: #fff8ec;
          color: #8a4b00;
          padding: 11px 14px;
          font-size: 12px;
          font-weight: 800;
        }

        .session-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 22px;
        }

        .start-recording-button,
        .stop-button {
          min-width: 154px;
          height: 44px;
          border-radius: 999px;
          padding: 0 20px;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }

        .start-recording-button {
          border: 0;
          background: #0800d8;
          color: #ffffff;
          box-shadow: 0 14px 28px rgba(8, 0, 216, 0.24);
        }

        .start-recording-button:hover:not(:disabled) {
          background: #001eff;
          transform: translateY(-1px);
          box-shadow: 0 18px 34px rgba(0, 30, 255, 0.26);
        }

        .start-recording-button:disabled {
          cursor: wait;
          opacity: 0.72;
        }

        .stop-button {
          border: 1px solid #d8deea;
          background: #ffffff;
          color: #172033;
        }

        .stop-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
        }

        .support-text,
        .redirect-text {
          margin: 16px 0 0;
          font-size: 13px;
          line-height: 1.45;
        }

        .support-text {
          color: #667085;
        }

        .redirect-text {
          color: #001eff;
          font-weight: 900;
        }

        .debug-strip {
          width: 100%;
          box-sizing: border-box;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 7px;
          margin-top: 28px;
          border: 1px solid #e1e8f5;
          border-radius: 16px;
          background: #f7f9ff;
          padding: 12px;
          color: #5d687a;
          font-size: 10px;
          line-height: 1.35;
          text-align: left;
        }

        .debug-strip span {
          border-radius: 999px;
          background: #ffffff;
          padding: 5px 8px;
          box-shadow: 0 5px 14px rgba(15, 23, 42, 0.04);
        }

        @keyframes radar-sweep {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes radar-pulse {
          0% {
            transform: scale(0.72);
            opacity: 0.72;
          }
          100% {
            transform: scale(1.08);
            opacity: 0.08;
          }
        }

        @keyframes audio-wave {
          0%, 100% {
            transform: scaleY(0.55);
          }
          50% {
            transform: scaleY(1.25);
          }
        }

        @media (max-width: 760px) {
          .start-session-shell {
            justify-content: flex-start;
            padding-top: 20px;
          }

          .back-link {
            align-self: stretch;
            justify-content: center;
          }

          .start-session-card {
            border-radius: 20px;
            padding: 24px 18px;
          }

          .avatar-radar {
            width: 158px;
          }

          .avatar-frame {
            width: 82px;
            height: 82px;
          }

          .mic-dot {
            right: 32px;
            bottom: 28px;
          }

          .debug-strip {
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  );
}

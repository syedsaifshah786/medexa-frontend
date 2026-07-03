"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  const autoStartHandledRef = useRef(false);
  const redirectStartedAtRef = useRef<number | null>(null);

  const routeSessionId = searchParams.get("sessionId") ?? "new-session";
  const source = searchParams.get("source") ?? "manual";
  const shouldAutoStartRecording = searchParams.get("autoStartRecording") === "1";
  const selectedSession = useMemo(() => getSessionById(routeSessionId), [routeSessionId]);
  const isActive = liveSession.recordingStatus === "recording" && liveSession.isListening;

  const beginRecording = async () => {
    setActiveSessionId(routeSessionId);
    medexaApi.startSession({
      session_id: routeSessionId,
      patient_id: routeSessionId,
      patientName: selectedSession.name,
      therapist_id: selectedDoctor.name,
      session_type: selectedSession.careType,
    });
    medexaApi.startSessionTimer(routeSessionId);
    await liveSession.startRecording(routeSessionId);
    setHasStartedRedirect(true);
    redirectStartedAtRef.current = Date.now();
    setCountdown(REDIRECT_SECONDS);
  };

  useEffect(() => {
    if (!shouldAutoStartRecording || autoStartHandledRef.current) {
      return;
    }

    autoStartHandledRef.current = true;
    void beginRecording();
  }, [shouldAutoStartRecording]);

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

      <section className="start-session-content">
        <Link href="/ambient-listening" className="back-link" aria-label="Back to Ambient Listening">
          ‹
        </Link>

        <section className="patient-band">
          <img src={selectedSession.img} alt="" />
          <div>
            <h1>{hasStartedRedirect ? "Starting Session" : "Medexa is ready"}</h1>
            <p>{selectedSession.name} · {selectedSession.careType}</p>
          </div>
          <strong dir="ltr">{formatDuration(liveSession.totalSeconds)}</strong>
        </section>

        <section className="listening-stage">
          <div className={`radar ${isActive ? "is-active" : ""}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <div className="stage-copy">
            <p className={`status-pill is-${liveSession.recordingStatus}`}>
              {isActive ? "Medexa is listening" : hasStartedRedirect ? "Medexa is connecting" : "Ready to record"}
            </p>
            <h2>{hasStartedRedirect ? "Medexa is preparing your session" : "Start recording when you are ready"}</h2>
            <p>
              {hasStartedRedirect
                ? "Recording has started. You will be redirected shortly."
                : "Recording will continue into the live session screen."}
            </p>

            <div className={`frequency-bars ${isActive ? "is-active" : ""}`} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>

            {hasStartedRedirect ? (
              <span className="redirect-copy">Redirecting to live session in {countdown} seconds...</span>
            ) : (
              <button type="button" className="start-button" onClick={() => void beginRecording()}>
                Start Recording
              </button>
            )}

            {liveSession.recordingStatus === "recording" && (
              <button type="button" className="secondary-button" onClick={liveSession.stopRecording}>
                Cancel and Stop
              </button>
            )}
          </div>
        </section>

        <div className="debug-strip" aria-live="polite">
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

      <style jsx>{`
        .start-session-page {
          min-height: 100vh;
          background: #fbfbfc;
          color: #172033;
        }

        .start-session-content {
          width: min(100%, 1040px);
          box-sizing: border-box;
          margin: 0 auto;
          padding: 28px clamp(16px, 4vw, 34px) 42px;
        }

        .back-link {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #fff;
          color: #001eff;
          text-decoration: none;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
        }

        .patient-band {
          display: grid;
          grid-template-columns: 58px minmax(0, 1fr) auto;
          align-items: center;
          gap: 16px;
          margin-top: 22px;
          padding-bottom: 24px;
          border-bottom: 1px solid #e8edf5;
        }

        .patient-band img {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          object-fit: cover;
        }

        .patient-band h1,
        .patient-band p {
          margin: 0;
        }

        .patient-band h1 {
          font-size: clamp(26px, 4vw, 40px);
          font-weight: 400;
          line-height: 1.1;
        }

        .patient-band p {
          margin-top: 7px;
          color: #667085;
          font-size: 13px;
        }

        .patient-band strong {
          color: #001eff;
          font-size: 32px;
        }

        .listening-stage {
          min-height: 420px;
          display: grid;
          grid-template-columns: minmax(260px, 0.9fr) minmax(300px, 1.1fr);
          align-items: center;
          gap: clamp(28px, 6vw, 72px);
        }

        .radar {
          position: relative;
          width: min(72vw, 360px);
          aspect-ratio: 1;
          justify-self: center;
          border: 1px solid #d9e2ff;
          border-radius: 50%;
          background:
            radial-gradient(circle at center, rgba(0, 30, 255, 0.14) 0 8%, transparent 9%),
            conic-gradient(from 0deg, rgba(0, 30, 255, 0.16), transparent 45%, transparent);
          overflow: hidden;
        }

        .radar::before {
          content: "";
          position: absolute;
          inset: 10%;
          border: 1px solid #d9e2ff;
          border-radius: 50%;
        }

        .radar::after {
          content: "";
          position: absolute;
          inset: 22%;
          border: 1px solid #d9e2ff;
          border-radius: 50%;
        }

        .radar span {
          position: absolute;
          inset: 50%;
          border-radius: 50%;
          border: 1px solid rgba(0, 30, 255, 0.3);
          transform: translate(-50%, -50%);
          opacity: 0;
        }

        .radar.is-active {
          animation: radar-scan 2.4s linear infinite;
        }

        .radar.is-active span {
          animation: radar-pulse 1.8s ease-out infinite;
        }

        .radar span:nth-child(2) {
          animation-delay: 0.45s;
        }

        .radar span:nth-child(3) {
          animation-delay: 0.9s;
        }

        .stage-copy h2,
        .stage-copy p {
          margin: 0;
        }

        .status-pill {
          width: fit-content;
          margin-bottom: 16px;
          border-radius: 999px;
          background: #f1f3f6;
          color: #667085;
          padding: 7px 12px;
          font-size: 11px;
          font-weight: 800;
        }

        .status-pill.is-recording {
          background: #eaf8f1;
          color: #087c4a;
        }

        .stage-copy h2 {
          color: #172033;
          font-size: clamp(28px, 4vw, 44px);
          font-weight: 400;
          line-height: 1.08;
        }

        .stage-copy > p {
          max-width: 430px;
          margin-top: 14px;
          color: #667085;
          font-size: 15px;
          line-height: 1.5;
        }

        .frequency-bars {
          height: 54px;
          display: flex;
          align-items: center;
          gap: 7px;
          margin: 26px 0;
        }

        .frequency-bars i {
          width: 7px;
          height: 18px;
          border-radius: 999px;
          background: #001eff;
          opacity: 0.35;
        }

        .frequency-bars.is-active i {
          animation: wave 0.85s ease-in-out infinite;
          opacity: 1;
        }

        .frequency-bars i:nth-child(2) { animation-delay: 0.08s; }
        .frequency-bars i:nth-child(3) { animation-delay: 0.16s; }
        .frequency-bars i:nth-child(4) { animation-delay: 0.24s; }
        .frequency-bars i:nth-child(5) { animation-delay: 0.32s; }
        .frequency-bars i:nth-child(6) { animation-delay: 0.4s; }
        .frequency-bars i:nth-child(7) { animation-delay: 0.48s; }

        .redirect-copy {
          display: block;
          color: #001eff;
          font-size: 13px;
          font-weight: 800;
        }

        .start-button,
        .secondary-button {
          height: 42px;
          border-radius: 999px;
          padding: 0 18px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .start-button {
          border: 0;
          background: #0800d8;
          color: #fff;
        }

        .secondary-button {
          margin-left: 10px;
          border: 1px solid #d8deea;
          background: #fff;
          color: #172033;
        }

        .debug-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          border-top: 1px solid #e8edf5;
          padding-top: 14px;
          color: #667085;
          font-size: 10px;
        }

        .debug-strip span {
          border-radius: 999px;
          background: #fff;
          padding: 6px 9px;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.05);
        }

        @keyframes radar-scan {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes radar-pulse {
          0% {
            width: 0;
            height: 0;
            opacity: 0.7;
          }
          100% {
            width: 95%;
            height: 95%;
            opacity: 0;
          }
        }

        @keyframes wave {
          0%, 100% { height: 16px; }
          50% { height: 48px; }
        }

        @media (max-width: 760px) {
          .patient-band {
            grid-template-columns: 48px minmax(0, 1fr);
          }

          .patient-band strong {
            grid-column: 1 / -1;
            font-size: 28px;
          }

          .listening-stage {
            grid-template-columns: 1fr;
            padding: 28px 0;
          }
        }
      `}</style>
    </main>
  );
}

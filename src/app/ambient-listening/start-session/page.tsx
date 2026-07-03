"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSelectedDoctor } from "@/components/DoctorContext";
import { medexaApi } from "@/lib/api";
import { setActiveSessionId } from "@/lib/activeSession";
import { getSessionById } from "@/lib/sessions";
import { useMedexaLiveSession } from "@/providers/MedexaLiveSessionProvider";

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
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const [hasStartedRedirect, setHasStartedRedirect] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const autoStartHandledRef = useRef(false);
  const redirectStartedAtRef = useRef<number | null>(null);

  const routeSessionId = searchParams.get("sessionId") ?? "new-session";
  const source = searchParams.get("source") ?? "manual";
  const shouldAutoStartRecording = searchParams.get("autoStartRecording") !== "0";
  const selectedSession = useMemo(() => getSessionById(routeSessionId), [routeSessionId]);
  const isVoiceFlow = source === "voice";
  const isActive = true;
  const hasMicWarning =
    liveSession.permissionStatus === "denied" ||
    liveSession.triggerPermissionStatus === "required" ||
    Boolean(liveSession.permissionError);
  const commandText = isVoiceFlow
    ? `Hey Medexa, start a new session with ${selectedSession.name}`
    : `Start a new session with ${selectedSession.name}`;

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
      <div className="start-session-glow glow-one" aria-hidden="true" />
      <div className="start-session-glow glow-two" aria-hidden="true" />

      <section className="start-session-card" aria-live="polite">
        <p className="command-text">{commandText}</p>

        <div className={`radar-wrap ${isActive ? "is-active" : "is-idle"}`}>
          <span className="radar-ring ring-one" aria-hidden="true" />
          <span className="radar-ring ring-two" aria-hidden="true" />
          <span className="radar-ring ring-three" aria-hidden="true" />
          <span className="radar-center" aria-hidden="true">
            <span />
          </span>
        </div>

        <div className="status-section">
          <p className="listening-status">Medexa is listening</p>
          <h1>Starting the Session...</h1>
          <p>Syncing Patient Context...</p>
        </div>

        <div className="timer" dir="ltr">
          {formatDuration(liveSession.totalSeconds)}
        </div>

        {hasMicWarning && (
          <div className="permission-card">
            Microphone permission is required to continue recording.
          </div>
        )}

        {hasStartedRedirect && (
          <p className="redirect-text">Redirecting to live session in {countdown}s</p>
        )}
      </section>

      <style>{`
        .start-session-page {
          position: relative;
          min-height: 100vh;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.96) 0 11%, transparent 30%),
            linear-gradient(135deg, #f7f8fb 0%, #eef2f8 46%, #f7f7fb 100%);
          color: #172033;
          padding: 28px 16px;
        }

        .start-session-page::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(115deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0)),
            radial-gradient(circle at 22% 16%, rgba(87, 122, 255, 0.12), transparent 26%),
            radial-gradient(circle at 76% 82%, rgba(132, 92, 255, 0.11), transparent 24%);
          backdrop-filter: blur(6px);
        }

        .start-session-glow {
          position: absolute;
          border-radius: 999px;
          filter: blur(28px);
          opacity: 0.56;
          pointer-events: none;
        }

        .glow-one {
          width: 280px;
          height: 280px;
          top: 12%;
          left: calc(50% - 340px);
          background: rgba(0, 30, 255, 0.1);
        }

        .glow-two {
          width: 240px;
          height: 240px;
          right: calc(50% - 330px);
          bottom: 13%;
          background: rgba(105, 65, 198, 0.1);
        }

        .start-session-card {
          position: relative;
          z-index: 1;
          width: min(100%, 400px);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 1px solid rgba(124, 140, 255, 0.32);
          border-radius: 22px;
          background:
            radial-gradient(circle at 50% 0%, rgba(236, 242, 255, 0.92), rgba(255, 255, 255, 0.98) 46%),
            #ffffff;
          padding: 30px 28px 26px;
          text-align: center;
          box-shadow:
            0 24px 70px rgba(36, 46, 83, 0.15),
            0 1px 0 rgba(255, 255, 255, 0.92) inset;
        }

        .command-text {
          max-width: 320px;
          min-height: 42px;
          margin: 0;
          color: #24304a;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.5;
        }

        .radar-wrap {
          position: relative;
          width: 156px;
          height: 156px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 22px 0 19px;
          border-radius: 50%;
        }

        .radar-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(29, 78, 216, 0.2);
        }

        .ring-one {
          inset: 43px;
          background: rgba(17, 90, 255, 0.06);
        }

        .ring-two {
          inset: 22px;
          border-color: rgba(99, 102, 241, 0.22);
        }

        .ring-three {
          inset: 0;
          border-color: rgba(104, 117, 245, 0.15);
        }

        .radar-center {
          position: relative;
          z-index: 2;
          width: 64px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: linear-gradient(145deg, #f7fbff, #edf3ff);
          box-shadow:
            0 18px 32px rgba(0, 30, 255, 0.16),
            0 0 0 10px rgba(0, 30, 255, 0.04);
        }

        .radar-center span {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #0800d8;
          box-shadow: 0 0 0 7px rgba(8, 0, 216, 0.12);
        }

        .radar-wrap.is-active .radar-ring {
          animation: radar-pulse 1.9s ease-out infinite;
        }

        .radar-wrap.is-active .ring-two {
          animation-delay: 0.25s;
        }

        .radar-wrap.is-active .ring-three {
          animation-delay: 0.5s;
        }

        .radar-wrap.is-active .radar-center {
          animation: center-breathe 1.45s ease-in-out infinite;
        }

        .status-section h1 {
          margin: 0;
          color: #151c2f;
          font-size: 20px;
          font-weight: 800;
          line-height: 1.2;
          letter-spacing: 0;
        }

        .listening-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 28px;
          margin: 0 0 12px;
          border-radius: 999px;
          background: #eaf8f1;
          color: #087c4a;
          padding: 0 12px;
          font-size: 12px;
          font-weight: 900;
          line-height: 1;
        }

        .listening-status::before {
          content: "";
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10c978;
          box-shadow: 0 0 0 5px rgba(16, 201, 120, 0.15);
        }

        .status-section p {
          margin: 8px 0 0;
          color: #667085;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.45;
        }

        .timer {
          min-width: 92px;
          margin-top: 18px;
          border: 1px solid #e6ebf7;
          border-radius: 14px;
          background: #f8faff;
          color: #0800d8;
          padding: 8px 12px;
          font-size: 24px;
          font-weight: 900;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
        }

        .permission-card {
          width: 100%;
          box-sizing: border-box;
          margin-top: 16px;
          border: 1px solid #ffd7a8;
          border-radius: 14px;
          background: #fff8ec;
          color: #8a4b00;
          padding: 11px 13px;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.45;
        }

        .redirect-text {
          margin: 17px 0 0;
          color: #001eff;
          font-size: 13px;
          font-weight: 900;
          line-height: 1.45;
        }

        @keyframes radar-pulse {
          0% {
            transform: scale(0.75);
            opacity: 0.8;
          }
          70%,
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }

        @keyframes center-breathe {
          0%,
          100% {
            transform: scale(0.96);
          }
          50% {
            transform: scale(1.04);
          }
        }

        @media (max-width: 480px) {
          .start-session-page {
            align-items: flex-start;
            padding-top: 20px;
          }

          .start-session-card {
            border-radius: 20px;
            padding: 26px 20px 20px;
          }

          .radar-wrap {
            width: 138px;
            height: 138px;
          }

          .status-section h1 {
            font-size: 18px;
          }

          .timer {
            font-size: 23px;
          }
        }
      `}</style>
    </main>
  );
}

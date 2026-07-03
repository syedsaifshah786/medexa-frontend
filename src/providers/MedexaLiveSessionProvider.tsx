"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWebSpeechSession } from "@/hooks/useWebSpeechSession";
import type { ApiCptRecord } from "@/lib/api";

export type RecordingStatus = "idle" | "recording" | "paused" | "stopped";

type TranscriptSource = "interim" | "final";
type TranscriptSubscriber = (latestText: string, fullText: string, source: TranscriptSource) => void;

type MedexaLiveSessionContextValue = ReturnType<typeof useWebSpeechSession> & {
  sessionId: string;
  recordingStatus: RecordingStatus;
  totalSeconds: number;
  startedAt: number | null;
  latestHeardText: string;
  fullTranscript: string;
  currentChunkText: string;
  cptRecords: Record<string, ApiCptRecord>;
  activeCptCode: string | null;
  setRecordingStatus: Dispatch<SetStateAction<RecordingStatus>>;
  setTotalSeconds: Dispatch<SetStateAction<number>>;
  setCptRecords: Dispatch<SetStateAction<Record<string, ApiCptRecord>>>;
  setActiveCptCode: Dispatch<SetStateAction<string | null>>;
  startRecording: (nextSessionId: string) => Promise<boolean>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => Promise<void>;
  subscribeTranscriptUpdate: (subscriber: TranscriptSubscriber) => () => void;
};

const MedexaLiveSessionContext = createContext<MedexaLiveSessionContextValue | null>(null);

export function MedexaLiveSessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState("");
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [latestHeardText, setLatestHeardText] = useState("");
  const [fullTranscript, setFullTranscript] = useState("");
  const [currentChunkText, setCurrentChunkText] = useState("");
  const [cptRecords, setCptRecords] = useState<Record<string, ApiCptRecord>>({});
  const [activeCptCode, setActiveCptCode] = useState<string | null>(null);
  const subscribersRef = useRef(new Set<TranscriptSubscriber>());

  const speechSession = useWebSpeechSession({
    clinicalSpeechLanguage: "en-US",
    onTranscriptUpdate: (latestText, fullText, source) => {
      setLatestHeardText(latestText);
      setFullTranscript(fullText);
      setCurrentChunkText(latestText);
      subscribersRef.current.forEach((subscriber) => {
        subscriber(latestText, fullText, source);
      });
    },
  });

  useEffect(() => {
    if (recordingStatus !== "recording") {
      return;
    }

    const timerId = window.setInterval(() => {
      setTotalSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [recordingStatus]);

  const startRecording = useCallback(
    async (nextSessionId: string) => {
      const isNewSession = nextSessionId !== sessionId;

      setSessionId(nextSessionId);
      if (isNewSession || recordingStatus === "idle" || recordingStatus === "stopped") {
        setTotalSeconds(0);
        setStartedAt(Date.now());
        setLatestHeardText("");
        setFullTranscript("");
        setCurrentChunkText("");
        speechSession.resetTranscript();
      } else if (!startedAt) {
        setStartedAt(Date.now());
      }

      const didStartListening = await speechSession.startListening();

      if (!didStartListening) {
        setRecordingStatus("idle");
        return false;
      }

      setRecordingStatus("recording");
      return true;
    },
    [recordingStatus, sessionId, speechSession, startedAt],
  );

  const pauseRecording = useCallback(() => {
    setRecordingStatus("paused");
    speechSession.pauseListening();
  }, [speechSession]);

  const resumeRecording = useCallback(async () => {
    setRecordingStatus("recording");
    if (!startedAt) {
      setStartedAt(Date.now());
    }
    await speechSession.startListening();
  }, [speechSession, startedAt]);

  const stopRecording = useCallback(() => {
    setRecordingStatus("stopped");
    speechSession.stopListening();
  }, [speechSession]);

  const subscribeTranscriptUpdate = useCallback((subscriber: TranscriptSubscriber) => {
    subscribersRef.current.add(subscriber);

    return () => {
      subscribersRef.current.delete(subscriber);
    };
  }, []);

  const value = useMemo<MedexaLiveSessionContextValue>(
    () => ({
      ...speechSession,
      sessionId,
      recordingStatus,
      totalSeconds,
      startedAt,
      latestHeardText,
      fullTranscript,
      currentChunkText,
      cptRecords,
      activeCptCode,
      setRecordingStatus,
      setTotalSeconds,
      setCptRecords,
      setActiveCptCode,
      startRecording,
      stopRecording,
      pauseRecording,
      resumeRecording,
      subscribeTranscriptUpdate,
    }),
    [
      activeCptCode,
      cptRecords,
      currentChunkText,
      fullTranscript,
      latestHeardText,
      pauseRecording,
      recordingStatus,
      resumeRecording,
      sessionId,
      speechSession,
      startRecording,
      startedAt,
      stopRecording,
      subscribeTranscriptUpdate,
      totalSeconds,
    ],
  );

  return (
    <MedexaLiveSessionContext.Provider value={value}>
      {children}
    </MedexaLiveSessionContext.Provider>
  );
}

export function useMedexaLiveSession() {
  const context = useContext(MedexaLiveSessionContext);

  if (!context) {
    throw new Error("useMedexaLiveSession must be used inside MedexaLiveSessionProvider");
  }

  return context;
}

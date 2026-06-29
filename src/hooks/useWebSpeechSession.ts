"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type TranscriptSegment = {
  id: string;
  text: string;
  timestamp: number;
};

type UseWebSpeechSessionOptions = {
  lang?: string;
};

const getRecognitionConstructor = () => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
};

export function useWebSpeechSession({ lang = "en-US" }: UseWebSpeechSessionOptions = {}) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);
  const manuallyStoppedRef = useRef(false);
  const finalPartsRef = useRef<string[]>([]);
  const lastFinalTextRef = useRef("");
  const restartTimerRef = useRef<number | null>(null);

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);

  useEffect(() => {
    setIsSupported(Boolean(getRecognitionConstructor()));

    return () => {
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
      }

      recognitionRef.current?.abort();
    };
  }, []);

  const createRecognition = useCallback(() => {
    const Recognition = getRecognitionConstructor();

    if (!Recognition) {
      setIsSupported(false);
      return null;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setPermissionError("");
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") {
        setPermissionError("Microphone permission is required for live transcription.");
        shouldListenRef.current = false;
        manuallyStoppedRef.current = true;
      }

      setIsListening(false);
    };

    recognition.onresult = (event) => {
      let interimText = "";
      const newFinalParts: string[] = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript.trim();

        if (!transcript) {
          continue;
        }

        if (result.isFinal) {
          if (transcript !== lastFinalTextRef.current) {
            newFinalParts.push(transcript);
            lastFinalTextRef.current = transcript;
          }
        } else {
          interimText = `${interimText} ${transcript}`.trim();
        }
      }

      if (newFinalParts.length > 0) {
        finalPartsRef.current = [...finalPartsRef.current, ...newFinalParts];
        setFinalTranscript(finalPartsRef.current.join(" "));
        setTranscriptSegments((segments) => [
          ...segments,
          ...newFinalParts.map((text) => ({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            text,
            timestamp: Date.now(),
          })),
        ]);
      }

      setLiveTranscript(interimText);
    };

    recognition.onend = () => {
      setIsListening(false);

      if (shouldListenRef.current && !manuallyStoppedRef.current) {
        restartTimerRef.current = window.setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // Browser may still be settling after an onend event.
          }
        }, 350);
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [lang]);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current ?? createRecognition();

    if (!recognition) {
      return;
    }

    shouldListenRef.current = true;
    manuallyStoppedRef.current = false;

    try {
      recognition.start();
    } catch {
      // start() throws if recognition is already active.
    }
  }, [createRecognition]);

  const pauseListening = useCallback(() => {
    shouldListenRef.current = false;
    manuallyStoppedRef.current = true;
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const resumeListening = useCallback(() => {
    startListening();
  }, [startListening]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    manuallyStoppedRef.current = true;
    recognitionRef.current?.stop();
    setIsListening(false);
    setLiveTranscript("");
  }, []);

  const resetTranscript = useCallback(() => {
    finalPartsRef.current = [];
    lastFinalTextRef.current = "";
    setLiveTranscript("");
    setFinalTranscript("");
    setTranscriptSegments([]);
  }, []);

  const currentChunkTranscript = useMemo(
    () => [finalTranscript, liveTranscript].filter(Boolean).join(" ").trim(),
    [finalTranscript, liveTranscript],
  );

  return {
    isSupported,
    isListening,
    permissionError,
    liveTranscript,
    finalTranscript,
    currentChunkTranscript,
    transcriptSegments,
    startListening,
    pauseListening,
    resumeListening,
    stopListening,
    resetTranscript,
  };
}

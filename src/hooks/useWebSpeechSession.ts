"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TranscriptSegment = {
  id: string;
  text: string;
  timestamp: number;
};

type UseWebSpeechSessionOptions = {
  lang?: string;
  onSpeechText?: (text: string) => void;
};

const normalizeTranscript = (text: string) => text.trim().replace(/\s+/g, " ");

const getRecognitionConstructor = () => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
};

export function useWebSpeechSession({ lang = "en-US", onSpeechText }: UseWebSpeechSessionOptions = {}) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const chunkFinalTranscriptRef = useRef("");
  const chunkTranscriptRef = useRef("");
  const lastProcessedChunkRef = useRef("");
  const lastFinalSentenceRef = useRef("");
  const isManuallyStoppedRef = useRef(false);
  const isPausedRef = useRef(false);
  const shouldListenRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [lastHeardText, setLastHeardText] = useState("");
  const [latestInterimText, setLatestInterimText] = useState("");
  const [latestFinalText, setLatestFinalText] = useState("");
  const [currentChunkTranscript, setCurrentChunkTranscript] = useState("");
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);

  const syncTranscriptState = useCallback(() => {
    const fullText = normalizeTranscript([finalTranscriptRef.current, interimTranscriptRef.current].filter(Boolean).join(" "));
    const chunkText = normalizeTranscript([chunkFinalTranscriptRef.current, interimTranscriptRef.current].filter(Boolean).join(" "));

    chunkTranscriptRef.current = chunkText;
    setFinalTranscript(finalTranscriptRef.current);
    setLiveTranscript(fullText);
    setCurrentChunkTranscript(chunkText);
  }, []);

  useEffect(() => {
    setIsSupported(Boolean(getRecognitionConstructor()));

    return () => {
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
      }

      recognitionRef.current?.abort();
    };
  }, []);

  const appendFinalTranscript = useCallback(
    (text: string) => {
      const normalizedText = normalizeTranscript(text);

      if (!normalizedText || normalizedText === lastFinalSentenceRef.current) {
        return;
      }

      const alreadyProcessed = lastProcessedChunkRef.current.includes(normalizedText.toLowerCase());
      const alreadyInFullTranscript = finalTranscriptRef.current.toLowerCase().includes(normalizedText.toLowerCase());

      if (!alreadyInFullTranscript) {
        finalTranscriptRef.current = normalizeTranscript([finalTranscriptRef.current, normalizedText].filter(Boolean).join(" "));
      }

      lastFinalSentenceRef.current = normalizedText;

      if (!alreadyProcessed && !alreadyInFullTranscript) {
        chunkFinalTranscriptRef.current = normalizeTranscript(
          [chunkFinalTranscriptRef.current, normalizedText].filter(Boolean).join(" "),
        );
      }

      setTranscriptSegments((segments) => [
        ...segments,
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          text: normalizedText,
          timestamp: Date.now(),
        },
      ]);
    },
    [],
  );

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
        isManuallyStoppedRef.current = true;
      }

      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const interimParts: string[] = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = normalizeTranscript(result[0]?.transcript ?? "");

        if (!transcript) {
          continue;
        }

        if (result.isFinal) {
          appendFinalTranscript(transcript);
          setLatestFinalText(transcript);
          setLastHeardText(transcript);
          onSpeechText?.(transcript);
        } else {
          interimParts.push(transcript);
        }
      }

      interimTranscriptRef.current = normalizeTranscript(interimParts.join(" "));
      if (interimTranscriptRef.current) {
        setLatestInterimText(interimTranscriptRef.current);
        setLastHeardText(interimTranscriptRef.current);
        onSpeechText?.(interimTranscriptRef.current);
      }
      syncTranscriptState();
    };

    recognition.onend = () => {
      setIsListening(false);

      if (shouldListenRef.current && !isManuallyStoppedRef.current && !isPausedRef.current) {
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
  }, [appendFinalTranscript, lang, onSpeechText, syncTranscriptState]);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current ?? createRecognition();

    if (!recognition) {
      return;
    }

    shouldListenRef.current = true;
    isManuallyStoppedRef.current = false;
    isPausedRef.current = false;

    try {
      recognition.start();
    } catch {
      // start() throws if recognition is already active.
    }
  }, [createRecognition]);

  const pauseListening = useCallback(() => {
    shouldListenRef.current = false;
    isPausedRef.current = true;
    isManuallyStoppedRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
    syncTranscriptState();
  }, [syncTranscriptState]);

  const resumeListening = useCallback(() => {
    startListening();
  }, [startListening]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    isPausedRef.current = false;
    isManuallyStoppedRef.current = true;
    recognitionRef.current?.stop();
    setIsListening(false);
    syncTranscriptState();
  }, [syncTranscriptState]);

  const getCurrentChunkTranscript = useCallback(() => {
    syncTranscriptState();
    return chunkTranscriptRef.current;
  }, [syncTranscriptState]);

  const consumeCurrentChunkTranscript = useCallback(() => {
    syncTranscriptState();
    const chunkText = chunkTranscriptRef.current;

    if (chunkText) {
      lastProcessedChunkRef.current = normalizeTranscript(
        [lastProcessedChunkRef.current, chunkText.toLowerCase()].filter(Boolean).join(" "),
      );

      if (!finalTranscriptRef.current.toLowerCase().includes(chunkText.toLowerCase())) {
        finalTranscriptRef.current = normalizeTranscript([finalTranscriptRef.current, chunkText].filter(Boolean).join(" "));
        setFinalTranscript(finalTranscriptRef.current);
      }
    }

    chunkFinalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    chunkTranscriptRef.current = "";
    setCurrentChunkTranscript("");
    setLiveTranscript(finalTranscriptRef.current);
    return chunkText;
  }, [syncTranscriptState]);

  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    chunkFinalTranscriptRef.current = "";
    chunkTranscriptRef.current = "";
    lastProcessedChunkRef.current = "";
    lastFinalSentenceRef.current = "";
    setLiveTranscript("");
    setFinalTranscript("");
    setLastHeardText("");
    setLatestInterimText("");
    setLatestFinalText("");
    setCurrentChunkTranscript("");
    setTranscriptSegments([]);
  }, []);

  return {
    isSupported,
    isListening,
    permissionError,
    liveTranscript,
    finalTranscript,
    lastHeardText,
    latestInterimText,
    latestFinalText,
    currentChunkTranscript,
    transcriptSegments,
    recognitionRef,
    finalTranscriptRef,
    interimTranscriptRef,
    chunkTranscriptRef,
    lastProcessedChunkRef,
    isManuallyStoppedRef,
    isPausedRef,
    startListening,
    pauseListening,
    resumeListening,
    stopListening,
    resetTranscript,
    getCurrentChunkTranscript,
    consumeCurrentChunkTranscript,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectMedexaCommand, type MedexaCommandDetection } from "@/lib/voiceCommands";

export type TranscriptSegment = {
  id: string;
  text: string;
  timestamp: number;
};

type UseWebSpeechSessionOptions = {
  lang?: string;
  onSpeechText?: (text: string) => void;
  onTranscriptUpdate?: (latestText: string, fullText: string) => void;
};

const normalizeTranscript = (text: string) => text.trim().replace(/\s+/g, " ");

const SpeechRecognition =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

const getRecognitionConstructor = () => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return SpeechRecognition ?? window.SpeechRecognition ?? window.webkitSpeechRecognition;
};

export function useWebSpeechSession({ lang = "en-US", onSpeechText, onTranscriptUpdate }: UseWebSpeechSessionOptions = {}) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const liveTranscriptRef = useRef("");
  const lastHeardTextRef = useRef("");
  const interimTranscriptRef = useRef("");
  const chunkFinalTranscriptRef = useRef("");
  const chunkTranscriptRef = useRef("");
  const lastProcessedChunkRef = useRef("");
  const lastFinalSentenceRef = useRef("");
  const isManuallyStoppedRef = useRef(false);
  const isPausedRef = useRef(false);
  const shouldListenRef = useRef(false);
  const shouldKeepListeningRef = shouldListenRef;
  const triggerModeRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [permissionStatus, setPermissionStatus] = useState<"idle" | "prompt" | "granted" | "denied" | "unsupported">("idle");
  const [triggerModeEnabled, setTriggerModeEnabled] = useState(false);
  const [triggerPermissionStatus, setTriggerPermissionStatus] = useState<"idle" | "requesting" | "listening" | "required" | "unsupported">("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [lastHeardText, setLastHeardText] = useState("");
  const [latestInterimText, setLatestInterimText] = useState("");
  const [latestFinalText, setLatestFinalText] = useState("");
  const [lastDetectedCommand, setLastDetectedCommand] = useState<MedexaCommandDetection | null>(null);
  const [currentChunkTranscript, setCurrentChunkTranscript] = useState("");
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);

  const syncTranscriptState = useCallback(() => {
    const fullText = normalizeTranscript([finalTranscriptRef.current, interimTranscriptRef.current].filter(Boolean).join(" "));
    const chunkText = normalizeTranscript([chunkFinalTranscriptRef.current, interimTranscriptRef.current].filter(Boolean).join(" "));

    chunkTranscriptRef.current = chunkText;
    liveTranscriptRef.current = fullText;
    setFinalTranscript(finalTranscriptRef.current);
    setLiveTranscript(fullText);
    setCurrentChunkTranscript(chunkText);
    return { fullText, chunkText };
  }, []);

  useEffect(() => {
    const supported = Boolean(getRecognitionConstructor());
    setIsSupported(supported);
    if (!supported) {
      setPermissionStatus("unsupported");
      setTriggerPermissionStatus("unsupported");
    }

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
      console.log("[WebSpeech] recognition started");
      setIsListening(true);
      setPermissionError("");
      setPermissionStatus("granted");
      if (triggerModeRef.current) {
        setTriggerPermissionStatus("listening");
      }
    };

    recognition.onerror = (event) => {
      console.error("[WebSpeech] error", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") {
        const message =
          event.error === "audio-capture"
            ? "Microphone audio capture is unavailable."
            : "Microphone permission denied";
        setPermissionError(message);
        setPermissionStatus("denied");
        setTriggerPermissionStatus("required");
        shouldKeepListeningRef.current = false;
        isManuallyStoppedRef.current = true;
      } else if (event.error === "no-speech") {
        setPermissionError("No speech detected yet. Keep speaking or try again.");
      } else if (event.error === "network") {
        setPermissionError("Speech recognition network error.");
      } else if (event.error === "aborted") {
        setPermissionError("Speech recognition was aborted.");
      } else {
        setPermissionError(`Speech recognition error: ${event.error}`);
      }

      setIsListening(false);
    };

    recognition.onresult = (event) => {
      console.log("[WebSpeech] onresult fired");
      const interimParts: string[] = [];
      const finalParts: string[] = [];
      let latestText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = normalizeTranscript(result[0]?.transcript ?? "");

        if (!transcript) {
          continue;
        }

        if (result.isFinal) {
          const detection = detectMedexaCommand(transcript);
          appendFinalTranscript(transcript);
          finalParts.push(transcript);
          setLatestFinalText(transcript);
          lastHeardTextRef.current = transcript;
          setLastHeardText(transcript);
          latestText = transcript;
          if (detection.wakeWordDetected || detection.command !== "none") {
            setLastDetectedCommand(detection);
          }
          onSpeechText?.(transcript);
        } else {
          interimParts.push(transcript);
        }
      }

      interimTranscriptRef.current = normalizeTranscript(interimParts.join(" "));
      if (interimTranscriptRef.current) {
        setLatestInterimText(interimTranscriptRef.current);
        lastHeardTextRef.current = interimTranscriptRef.current;
        setLastHeardText(interimTranscriptRef.current);
        latestText = interimTranscriptRef.current;
        const detection = detectMedexaCommand(interimTranscriptRef.current);
        if (detection.wakeWordDetected || detection.command !== "none") {
          setLastDetectedCommand(detection);
        }
        onSpeechText?.(interimTranscriptRef.current);
      }
      const { fullText } = syncTranscriptState();
      if (latestText) {
        console.log("[WebSpeech] latestHeardText", latestText);
        console.log("[WebSpeech] interim", interimTranscriptRef.current);
        console.log("[WebSpeech] final", normalizeTranscript(finalParts.join(" ")));
        console.log("[WebSpeech] finalTranscript", finalTranscriptRef.current);
        console.log("[WebSpeech] liveTranscript", fullText);
        console.log("[WebSpeech] live", fullText);
        onTranscriptUpdate?.(latestText, fullText);
      }
    };

    recognition.onend = () => {
      console.log("[WebSpeech] ended");
      setIsListening(false);

      if (shouldKeepListeningRef.current && !isManuallyStoppedRef.current && !isPausedRef.current) {
        restartTimerRef.current = window.setTimeout(() => {
          try {
            recognition.start();
            setIsListening(true);
            console.log("[WebSpeech] restarted");
          } catch (error) {
            console.warn("[WebSpeech] restart failed", error);
          }
        }, 500);
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [appendFinalTranscript, lang, onSpeechText, onTranscriptUpdate, syncTranscriptState]);

  const startListening = useCallback(async () => {
    if (!getRecognitionConstructor()) {
      setIsSupported(false);
      setPermissionStatus("unsupported");
      setPermissionError("Voice recognition is supported in Chrome/Edge. Please use a supported browser.");
      setTriggerPermissionStatus("unsupported");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionStatus("unsupported");
      setPermissionError("Microphone access is not available in this browser.");
      return;
    }

    console.log("[WebSpeech] requesting microphone permission");
    setPermissionStatus("prompt");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionStatus("granted");
      setPermissionError("");
      console.log("[WebSpeech] microphone permission granted");
    } catch (error) {
      console.error("[WebSpeech] microphone permission denied", error);
      setPermissionStatus("denied");
      setPermissionError("Microphone permission denied");
      setTriggerPermissionStatus("required");
      shouldKeepListeningRef.current = false;
      isManuallyStoppedRef.current = true;
      setIsListening(false);
      return;
    }

    const recognition = recognitionRef.current ?? createRecognition();

    if (!recognition) {
      return;
    }

    shouldKeepListeningRef.current = true;
    isManuallyStoppedRef.current = false;
    isPausedRef.current = false;

    try {
      recognition.start();
      setIsListening(true);
      console.log("[WebSpeech] recognition started");
    } catch {
      // start() throws if recognition is already active.
    }
  }, [createRecognition]);

  const autoStartTriggerMode = useCallback(() => {
    if (!getRecognitionConstructor()) {
      setIsSupported(false);
      setTriggerPermissionStatus("unsupported");
      return;
    }

    triggerModeRef.current = true;
    setTriggerModeEnabled(true);
    setTriggerPermissionStatus("requesting");
    startListening();
  }, [startListening]);

  const pauseListening = useCallback(() => {
    if (triggerModeRef.current) {
      shouldListenRef.current = true;
      isPausedRef.current = false;
      syncTranscriptState();
      return;
    }

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
    liveTranscriptRef.current = "";
    lastHeardTextRef.current = "";
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
    setLastDetectedCommand(null);
    setCurrentChunkTranscript("");
    setTranscriptSegments([]);
  }, []);

  return {
    isSupported,
    isListening,
    permissionError,
    permissionStatus,
    error: permissionError,
    liveTranscript,
    interimTranscript: latestInterimText,
    finalTranscript,
    lastHeardText,
    latestInterimText,
    latestFinalText,
    currentChunkTranscript,
    transcriptSegments,
    recognitionRef,
    finalTranscriptRef,
    liveTranscriptRef,
    lastHeardTextRef,
    interimTranscriptRef,
    chunkTranscriptRef,
    lastProcessedChunkRef,
    triggerModeEnabled,
    triggerPermissionStatus,
    lastDetectedCommand,
    isManuallyStoppedRef,
    isPausedRef,
    startListening,
    autoStartTriggerMode,
    pauseListening,
    resumeListening,
    stopListening,
    resetTranscript,
    getCurrentChunkTranscript,
    consumeCurrentChunkTranscript,
  };
}

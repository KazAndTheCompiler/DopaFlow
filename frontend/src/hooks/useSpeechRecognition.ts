/**
 * Browser SpeechRecognition hook.
 * Uses Web Speech API — works offline, no backend needed.
 * Falls back gracefully if unsupported (Firefox desktop, some mobile browsers).
 *
 * Usage:
 *   const { listening, transcript, start, stop, supported } = useSpeechRecognition();
 */

import { useCallback, useEffect, useRef, useState } from "react";

// Type declarations for Web Speech API
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

function mapSpeechError(error: string): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission was denied by the browser.";
    case "audio-capture":
      return "No microphone was found for voice input.";
    case "network":
      return "Voice recognition hit a network error.";
    default:
      return error;
  }
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((ev: Event) => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface UseSpeechRecognitionResult {
  supported: boolean;
  listening: boolean;
  transcript: string;       // last confirmed final transcript
  interim: string;          // live partial result while speaking
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

// webkit prefix for Safari / older Chrome
const SR: { new (): SpeechRecognition } | undefined =
  typeof window !== "undefined"
    ? ((window as unknown as { SpeechRecognition?: { new (): SpeechRecognition }; webkitSpeechRecognition?: { new (): SpeechRecognition } })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: { new (): SpeechRecognition } }).webkitSpeechRecognition) as { new (): SpeechRecognition } | undefined
    : undefined;

export function useSpeechRecognition(lang = "en-US"): UseSpeechRecognitionResult {
  const supported = Boolean(SR);
  const recRef = useRef<SpeechRecognition | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      recRef.current?.abort();
    };
  }, []);

  const start = useCallback((): void => {
    if (!SR) return;
    setError(null);
    setTranscript("");
    setInterim("");
    recRef.current?.abort();

    const rec = new SR();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = (): void => setListening(true);

    rec.onresult = (event: SpeechRecognitionEvent): void => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }
      if (finalText) setTranscript((prev) => (prev + " " + finalText).trim());
      setInterim(interimText);
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent): void => {
      // "no-speech" and "aborted" are benign — user just didn't speak
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(mapSpeechError(event.error));
      }
      setListening(false);
    };

    rec.onend = (): void => {
      setListening(false);
      setInterim("");
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "Voice recognition could not start.";
      setError(/notallowed|permission|denied/i.test(message)
        ? "Microphone permission was denied by the browser."
        : message);
      setListening(false);
      recRef.current = null;
    }
  }, [lang]);

  const stop = useCallback((): void => {
    recRef.current?.stop();
    recRef.current = null;
  }, []);

  const reset = useCallback((): void => {
    recRef.current?.abort();
    recRef.current = null;
    setListening(false);
    setTranscript("");
    setInterim("");
    setError(null);
  }, []);

  return { supported, listening, transcript, interim, error, start, stop, reset };
}

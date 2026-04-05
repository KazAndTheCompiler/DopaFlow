/**
 * Browser Text-to-Speech via Web Speech API.
 * Works offline on PWA / mobile. No backend required.
 * Falls back silently if speechSynthesis is unavailable (e.g. some headless browsers).
 */

import { useCallback, useRef, useState } from "react";

export interface UseTTSResult {
  speak: (text: string) => void;
  speaking: boolean;
  supported: boolean;
}

export function useTTS(): UseTTSResult {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const speak = useCallback(
    (text: string): void => {
      if (!supported || !text.trim()) return;
      // Cancel any in-progress speech before queuing a new utterance
      window.speechSynthesis.cancel();
      if (timerRef.current) clearInterval(timerRef.current);

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => {
        setSpeaking(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };
      utterance.onerror = () => {
        setSpeaking(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      setSpeaking(true);
      window.speechSynthesis.speak(utterance);

      // Safety fallback — some browsers fire onend unreliably
      timerRef.current = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          setSpeaking(false);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, 300);
    },
    [supported],
  );

  return { speak, speaking, supported };
}

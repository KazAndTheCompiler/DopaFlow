/**
 * Browser Text-to-Speech via Web Speech API.
 * Works offline on PWA / mobile. No backend required.
 * Falls back silently if speechSynthesis is unavailable (e.g. some headless browsers).
 */

export interface UseTTSResult {
  speak: (text: string) => void;
  supported: boolean;
}

export function useTTS(): UseTTSResult {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const speak = (text: string): void => {
    if (!supported || !text.trim()) return;
    // Cancel any in-progress speech before queuing a new utterance
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  return { speak, supported };
}

import { useEffect, useState } from "react";

import type { MomentumScore, PackyWhisper } from "../../../shared/types";
import { askPacky, getPackyMomentum, getPackyWhisper, updatePackyLorebook } from "@api/index";

export interface UsePackyResult {
  whisper?: PackyWhisper | undefined;
  momentum?: MomentumScore | undefined;
  ask: (prompt: string, context?: Record<string, unknown>) => Promise<{ reply: string; action: string }>;
  refresh: () => Promise<void>;
  updateLorebook: (headline: string, body: string, stats?: { completed_today?: number; habit_streak?: number; focus_minutes_today?: number }) => Promise<void>;
}

export function usePacky(): UsePackyResult {
  const [whisper, setWhisper] = useState<PackyWhisper>();
  const [momentum, setMomentum] = useState<MomentumScore>();

  const refresh = async (): Promise<void> => {
    const [nextWhisper, nextMomentum] = await Promise.all([getPackyWhisper(), getPackyMomentum()]);
    setWhisper(nextWhisper);
    setMomentum(nextMomentum);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    whisper,
    momentum,
    ask: async (prompt: string, context?: Record<string, unknown>) => {
      const result = await askPacky({ text: prompt, ...(context !== undefined ? { context } : {}) });
      return { reply: result.reply_text, action: result.suggested_action ?? "" };
    },
    refresh,
    updateLorebook: async (headline: string, body: string, stats?: { completed_today?: number; habit_streak?: number; focus_minutes_today?: number }) => {
      await updatePackyLorebook({ headline, body, ...(stats ?? {}) });
      await refresh();
    },
  };
}

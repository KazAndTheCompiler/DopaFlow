function withDopaflowPrefix(key: string): string {
  return key.startsWith("dopaflow:") ? key : `dopaflow:${key}`;
}

export const APP_STORAGE_KEYS = {
  onboardingComplete: withDopaflowPrefix("onboarded"),
  plannedDate: withDopaflowPrefix("planned_date"),
  focusPrefill: withDopaflowPrefix("focus_prefill"),
  breakEndsAt: withDopaflowPrefix("break_ends_at"),
} as const;

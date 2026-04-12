import { useEffect } from "react";

import { API_BASE_URL } from "@api/client";

export type InvalidationDomain = "alarms" | "calendar" | "habits" | "journal" | "tasks";

interface SSEPayload {
  type?: string;
  domain?: string;
}

export function getInvalidationEventName(domain: InvalidationDomain): string {
  return `dopaflow:invalidate:${domain}`;
}

export function useSSE(): void {
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const source = new EventSource(`${API_BASE_URL}/events`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as SSEPayload;
        if (payload.type !== "invalidate" || typeof payload.domain !== "string") {
          return;
        }
        window.dispatchEvent(new CustomEvent(getInvalidationEventName(payload.domain as InvalidationDomain), { detail: payload }));
      } catch {
        // Ignore malformed event payloads and keep the stream alive.
      }
    };

    return () => {
      source.close();
    };
  }, []);
}

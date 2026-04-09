import type { JSX } from "react";

import type { PeerFeed } from "../../../../shared/types";

export const panelStyle = {
  padding: "1.1rem 1.25rem",
  background: "linear-gradient(160deg, color-mix(in srgb, var(--surface) 88%, white 12%), var(--surface))",
  borderRadius: "20px",
  border: "1px solid var(--border-subtle)",
  display: "grid",
  gap: "0.9rem",
  boxShadow: "var(--shadow-soft)",
} as const;

export const inputStyle = {
  width: "100%",
  padding: "0.7rem 0.8rem",
  borderRadius: "12px",
  border: "1px solid var(--border-subtle)",
  background: "var(--surface)",
  color: "var(--text-primary)",
  fontSize: "var(--text-sm)",
  fontFamily: "inherit",
} as const;

export function normalizeApiBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function isLikelyApiBaseUrl(value: string): boolean {
  return /\/api\/v\d+$/i.test(value);
}

export function parseSetupCode(raw: string): { base_url: string; token: string } | { error: string } {
  const trimmed = raw.trim();
  const separatorIndex = trimmed.indexOf("|");
  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    return { error: "Paste the full setup code in the form https://host/api/v2|token." };
  }

  const baseUrl = normalizeApiBaseUrl(trimmed.slice(0, separatorIndex));
  const token = trimmed.slice(separatorIndex + 1).trim();

  try {
    const parsed = new URL(baseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { error: "The base URL must start with http:// or https://." };
    }
  } catch {
    return { error: "The setup code base URL is not valid. Copy it again from the sharing screen that created it." };
  }

  if (!isLikelyApiBaseUrl(baseUrl)) {
    return { error: "That URL does not look like a DopaFlow API base URL yet. It should usually end in /api/v2." };
  }

  if (token.length < 12) {
    return { error: "The token looks too short. Copy the full one-time setup code again." };
  }

  return { base_url: baseUrl, token };
}

export function describeConnectionError(raw: string): { title: string; detail: string } {
  switch (raw) {
    case "token_invalid_or_revoked":
      return {
        title: "Token no longer works",
        detail: "Ask the other install to create a new share token, then reconnect this feed with the fresh setup code.",
      };
    case "redirect_not_allowed":
      return {
        title: "The saved URL points somewhere unsafe",
        detail: "Use the direct DopaFlow API base URL from the other install. Redirects are blocked on purpose so the feed cannot silently hop hosts.",
      };
    case "invalid_feed_payload":
      return {
        title: "The remote server answered, but not with a valid calendar feed",
        detail: "Double-check that the base URL points to that install's DopaFlow API, usually ending in /api/v2, not to a website homepage or proxy splash page.",
      };
    case "feed_not_found":
      return {
        title: "This shared feed no longer exists here",
        detail: "Remove it and add it again with a fresh setup code.",
      };
    default:
      if (/^HTTP 401$|^HTTP 403$/i.test(raw)) {
        return {
          title: "The remote install rejected this token",
          detail: "The token was likely mistyped, expired, or revoked. Reconnect with a new setup code.",
        };
      }
      if (/^HTTP 404$/i.test(raw)) {
        return {
          title: "That base URL does not expose the feed endpoint",
          detail: "Point it to the DopaFlow API base URL, usually ending in /api/v2, then try again.",
        };
      }
      if (/^HTTP 5\d\d$/i.test(raw)) {
        return {
          title: "The other install is reachable, but not ready right now",
          detail: "Wait a moment and retry sync. If it keeps failing, confirm the remote app is running and reachable at the saved base URL.",
        };
      }
      if (raw.toLowerCase().includes("failed to fetch") || raw.toLowerCase().includes("network")) {
        return {
          title: "This install could not reach the other one",
          detail: "Check the base URL, confirm the remote app is online, and make sure both installs can reach each other on the network.",
        };
      }
      if (raw.toLowerCase().includes("name or service not known") || raw.toLowerCase().includes("nodename")) {
        return {
          title: "The hostname in the base URL does not resolve",
          detail: "Fix the host name or IP address, then retry sync.",
        };
      }
      return {
        title: "Sync needs repair",
        detail: "Retry the feed first. If it fails again, verify the saved base URL and replace the token with a newly generated setup code.",
      };
  }
}

export function StepCard({ step, title, detail }: { step: string; title: string; detail: string }): JSX.Element {
  return (
    <div
      style={{
        padding: "0.95rem 1rem",
        borderRadius: "16px",
        border: "1px solid var(--border-subtle)",
        background: "color-mix(in srgb, var(--surface) 82%, white 18%)",
        display: "grid",
        gap: "0.35rem",
      }}
    >
      <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
        {step}
      </span>
      <strong style={{ fontSize: "var(--text-base)" }}>{title}</strong>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>{detail}</span>
    </div>
  );
}

export function MetaPill({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "accent" | "warn";
}): JSX.Element {
  const palette =
    tone === "accent"
      ? { bg: "var(--accent)16", color: "var(--accent)" }
      : tone === "warn"
        ? { bg: "var(--state-warn)16", color: "var(--state-warn)" }
        : { bg: "var(--surface-2)", color: "var(--text-secondary)" };

  return (
    <span
      style={{
        padding: "0.28rem 0.58rem",
        borderRadius: "999px",
        background: palette.bg,
        color: palette.color,
        fontSize: "var(--text-xs)",
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

export function InfoStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "warn";
}): JSX.Element {
  const color = tone === "accent" ? "var(--accent)" : tone === "warn" ? "var(--state-warn)" : "var(--text-primary)";
  const bg = tone === "accent" ? "var(--accent)12" : tone === "warn" ? "var(--state-warn)12" : "var(--surface-2)";

  return (
    <div
      style={{
        padding: "0.8rem 0.9rem",
        borderRadius: "14px",
        border: "1px solid var(--border-subtle)",
        background: bg,
        display: "grid",
        gap: "0.2rem",
      }}
    >
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <strong style={{ fontSize: "var(--text-lg)", color }}>{value}</strong>
    </div>
  );
}

export function StatusBadge({ status }: { status: PeerFeed["sync_status"] }): JSX.Element {
  const palette =
    status === "ok"
      ? { bg: "var(--state-ok)18", color: "var(--state-ok)" }
      : status === "error"
        ? { bg: "var(--state-overdue)18", color: "var(--state-overdue)" }
        : status === "syncing"
          ? { bg: "var(--accent)18", color: "var(--accent)" }
          : { bg: "var(--surface-2)", color: "var(--text-secondary)" };

  return (
    <span
      style={{
        padding: "0.22rem 0.6rem",
        borderRadius: "999px",
        background: palette.bg,
        color: palette.color,
        fontSize: "var(--text-xs)",
        fontWeight: 700,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

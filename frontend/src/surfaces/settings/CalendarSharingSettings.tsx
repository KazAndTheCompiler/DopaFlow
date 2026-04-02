import { useEffect, useMemo, useState } from "react";

import type { PeerFeed, ShareToken, ShareTokenCreated } from "../../../../shared/types";
import { addPeerFeed, createShareToken, listPeerFeeds, listShareTokens, removePeerFeed, revokeShareToken, syncPeerFeed } from "../../api/sharing";
import { API_BASE_URL } from "../../api/client";
import Button from "../../design-system/primitives/Button";
import EmptyState from "../../design-system/primitives/EmptyState";
import Modal from "../../design-system/primitives/Modal";
import { SkeletonCard } from "../../design-system/primitives/Skeleton";
import { showToast } from "../../design-system/primitives/Toast";

const panelStyle = {
  padding: "1.1rem 1.25rem",
  background: "linear-gradient(160deg, color-mix(in srgb, var(--surface) 88%, white 12%), var(--surface))",
  borderRadius: "20px",
  border: "1px solid var(--border-subtle)",
  display: "grid",
  gap: "0.9rem",
  boxShadow: "var(--shadow-soft)",
} as const;

const inputStyle = {
  width: "100%",
  padding: "0.7rem 0.8rem",
  borderRadius: "12px",
  border: "1px solid var(--border-subtle)",
  background: "var(--surface)",
  color: "var(--text-primary)",
  fontSize: "var(--text-sm)",
  fontFamily: "inherit",
} as const;

function normalizeApiBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function isLikelyApiBaseUrl(value: string): boolean {
  return /\/api\/v\d+$/i.test(value);
}

function parseSetupCode(raw: string): { base_url: string; token: string } | { error: string } {
  const trimmed = raw.trim();
  const separatorIndex = trimmed.indexOf("|");
  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    return { error: "Paste the full setup code in the form https://host/api/v2|token." };
  }

  const base_url = normalizeApiBaseUrl(trimmed.slice(0, separatorIndex));
  const token = trimmed.slice(separatorIndex + 1).trim();

  try {
    const parsed = new URL(base_url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { error: "The base URL must start with http:// or https://." };
    }
  } catch {
    return { error: "The setup code base URL is not valid. Copy it again from the sharing screen that created it." };
  }

  if (!isLikelyApiBaseUrl(base_url)) {
    return { error: "That URL does not look like a DopaFlow API base URL yet. It should usually end in /api/v2." };
  }

  if (token.length < 12) {
    return { error: "The token looks too short. Copy the full one-time setup code again." };
  }

  return { base_url, token };
}

function describeConnectionError(raw: string): { title: string; detail: string } {
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


function StepCard({ step, title, detail }: { step: string; title: string; detail: string }): JSX.Element {
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

function MetaPill({ label, tone = "default" }: { label: string; tone?: "default" | "accent" | "warn" }): JSX.Element {
  const palette = tone === "accent"
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

function InfoStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "accent" | "warn" }): JSX.Element {
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

function StatusBadge({ status }: { status: PeerFeed["sync_status"] }): JSX.Element {
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

export default function CalendarSharingSettings(): JSX.Element {
  const [tokens, setTokens] = useState<ShareToken[]>([]);
  const [feeds, setFeeds] = useState<PeerFeed[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [newTokenLabel, setNewTokenLabel] = useState("");
  const [newTokenExpiryDays, setNewTokenExpiryDays] = useState<string>("30");
  const [createdToken, setCreatedToken] = useState<ShareTokenCreated | null>(null);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [setupCode, setSetupCode] = useState("");
  const [newFeed, setNewFeed] = useState({
    label: "",
    base_url: "https://partner.example.com/api/v2",
    token: "",
    color: "#5b8def",
  });

  const activeFeedCount = useMemo(() => feeds.filter((feed) => feed.sync_status === "ok").length, [feeds]);
  const erroredFeedCount = useMemo(() => feeds.filter((feed) => feed.sync_status === "error").length, [feeds]);
  const staleFeedCount = useMemo(
    () =>
      feeds.filter((feed) => {
        if (!feed.last_synced_at) {
          return feed.sync_status !== "syncing";
        }
        return Date.now() - new Date(feed.last_synced_at).getTime() > 36 * 60 * 60 * 1000;
      }).length,
    [feeds],
  );
  const localApiBaseUrl = useMemo(() => API_BASE_URL.replace(/\/+$/, ""), []);
  const createdSetupCode = createdToken
    ? `${localApiBaseUrl}|${createdToken.raw_token}`
    : "";
  const parsedSetupCode = useMemo(() => parseSetupCode(setupCode), [setupCode]);

  const relativeSyncAge = (iso: string | null): string => {
    if (!iso) {
      return "Not synced yet";
    }
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    if (diffHours < 1) {
      return `${Math.max(1, Math.floor(diffMs / (60 * 1000)))}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const loadData = async (): Promise<void> => {
    setLoading(true);
    try {
      const [tokensData, feedsData] = await Promise.all([listShareTokens(), listPeerFeeds()]);
      setTokens(tokensData);
      setFeeds(feedsData);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load sharing settings", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCreateToken = async (): Promise<void> => {
    if (!newTokenLabel.trim()) {
      showToast("Please enter a label.", "warn");
      return;
    }
    setLoading(true);
    try {
      const expiry = newTokenExpiryDays === "never" ? null : Number(newTokenExpiryDays);
      const token = await createShareToken(newTokenLabel.trim(), expiry);
      setCreatedToken(token);
      setNewTokenLabel("");
      setNewTokenExpiryDays("30");
      setShowCreateToken(false);
      await loadData();
      showToast("Share token created.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create share token", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeToken = async (id: string): Promise<void> => {
    setLoading(true);
    try {
      await revokeShareToken(id);
      await loadData();
      showToast("Share token revoked.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to revoke share token", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFeed = async (): Promise<void> => {
    if (!newFeed.label.trim() || !newFeed.base_url.trim() || !newFeed.token.trim()) {
      showToast("Fill in label, base URL, and token.", "warn");
      return;
    }
    let normalizedBaseUrl = "";
    try {
      normalizedBaseUrl = normalizeApiBaseUrl(newFeed.base_url);
      const parsed = new URL(normalizedBaseUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        showToast("Base URL must start with http:// or https://.", "warn");
        return;
      }
      if (!isLikelyApiBaseUrl(normalizedBaseUrl)) {
        showToast("Base URL should usually end in /api/v2 for a DopaFlow install.", "warn");
        return;
      }
    } catch {
      showToast("Enter a valid base URL before connecting.", "warn");
      return;
    }
    if (newFeed.token.trim().length < 12) {
      showToast("Token looks incomplete. Paste the full one-time setup code or token again.", "warn");
      return;
    }
    setLoading(true);
    try {
      await addPeerFeed({
        label: newFeed.label.trim(),
        base_url: normalizedBaseUrl,
        token: newFeed.token.trim(),
        color: newFeed.color,
      });
      setNewFeed({
        label: "",
        base_url: "https://partner.example.com/api/v2",
        token: "",
        color: "#5b8def",
      });
      setShowAddFeed(false);
      await loadData();
      showToast("Shared calendar added.", "success");
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "Failed to add shared calendar";
      const guidance = describeConnectionError(rawMessage);
      showToast(`${guidance.title}. ${guidance.detail}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const applySetupCode = (): void => {
    if ("error" in parsedSetupCode) {
      showToast(parsedSetupCode.error, "warn");
      return;
    }
    setNewFeed((current) => ({ ...current, base_url: parsedSetupCode.base_url, token: parsedSetupCode.token }));
    showToast("Setup code applied. Add a label, then connect the calendar.", "success");
  };

  const handleSyncFeed = async (id: string): Promise<void> => {
    setLoading(true);
    try {
      const result = await syncPeerFeed(id);
      await loadData();
      if (result.status === "ok") {
        showToast(`Sync complete: ${result.events_imported} events imported.`, "success");
      } else {
        const guidance = describeConnectionError(result.detail ?? "Shared calendar sync failed");
        showToast(`${guidance.title}. ${guidance.detail}`, "error");
      }
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "Failed to sync shared calendar";
      const guidance = describeConnectionError(rawMessage);
      showToast(`${guidance.title}. ${guidance.detail}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFeed = async (id: string): Promise<void> => {
    setLoading(true);
    try {
      await removePeerFeed(id);
      await loadData();
      showToast("Shared calendar removed.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove shared calendar", "error");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string): Promise<void> => {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard.", "success");
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <section style={{ ...panelStyle, gap: "1rem", padding: "1.2rem 1.35rem 1.35rem" }}>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
            Cross-install sharing
          </span>
          <strong style={{ fontSize: "clamp(1.3rem, 2.2vw, 1.75rem)", lineHeight: 1.05, letterSpacing: "-0.03em" }}>Calendar Sharing</strong>
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: "68ch", lineHeight: 1.6 }}>
            This is the foundation for future user-to-user calendar sharing. Today it supports deliberate, token-based sharing between trusted DopaFlow installs, so the flow needs to feel polished now and stay safe when broader sharing lands later.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
          <InfoStat label="Share Tokens" value={String(tokens.length)} tone="accent" />
          <InfoStat label="Connected Feeds" value={String(feeds.length)} />
          <InfoStat label="Healthy Feeds" value={String(activeFeedCount)} tone={activeFeedCount > 0 ? "accent" : "warn"} />
          <InfoStat label="Needs Attention" value={String(erroredFeedCount + staleFeedCount)} tone={erroredFeedCount + staleFeedCount > 0 ? "warn" : "default"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
          <StepCard step="1" title="Create a token" detail="Generate a one-time token with a deliberate lifetime for the device or person you trust." />
          <StepCard step="2" title="Share the setup code" detail="Hand over the base URL plus token once. The raw secret is intentionally not recoverable later." />
          <StepCard step="3" title="Mirror the feed" detail="The other DopaFlow install subscribes and sees your events as read-only mirrored calendars." />
        </div>
      </section>

      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: "0.25rem" }}>
            <strong style={{ fontSize: "var(--text-base)" }}>Share my calendar</strong>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: "62ch", lineHeight: 1.5 }}>
              Generate a one-time token, copy it immediately, and give it only to people or devices you trust.
            </span>
          </div>
          <Button
            onClick={() => {
              setShowCreateToken((value) => !value);
              setNewTokenLabel("");
            }}
            disabled={loading}
            variant="ghost"
            style={{ opacity: loading ? 0.55 : 1, borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            {showCreateToken ? "Close" : "New Share Token"}
          </Button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
          <StepCard
            step="Share mine"
            title="Create, copy, hand off once"
            detail="Generate the setup code here, copy it immediately, then send it to the other trusted DopaFlow install."
          />
          <StepCard
            step="Connect theirs"
            title="Paste setup code or fill manually"
            detail="On this device, use the setup code first. Manual base URL plus token entry is the fallback when copy-paste is awkward."
          />
        </div>

        {showCreateToken && (
          <div style={{ display: "grid", gap: "0.9rem", padding: "1rem", borderRadius: "18px", background: "linear-gradient(165deg, color-mix(in srgb, var(--surface-2) 86%, white 14%), var(--surface-2))", border: "1px solid var(--border-subtle)" }}>
            <label style={{ display: "grid", gap: "0.4rem" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Label</span>
              <input
                type="text"
                placeholder="e.g. Home wall display"
                value={newTokenLabel}
                onChange={(event) => setNewTokenLabel(event.target.value)}
                disabled={loading}
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: "0.4rem" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Expiry</span>
              <select
                value={newTokenExpiryDays}
                onChange={(event) => setNewTokenExpiryDays(event.target.value)}
                disabled={loading}
                style={inputStyle}
              >
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
                <option value="never">Never</option>
              </select>
            </label>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                Tokens are shown once and should be rotated or allowed to expire if shared too broadly.
              </span>
              <Button
                onClick={() => void handleCreateToken()}
                disabled={loading}
                variant="primary"
                style={{ opacity: loading ? 0.6 : 1 }}
              >
                {loading ? "Generating…" : "Generate Token"}
              </Button>
            </div>
          </div>
        )}

        {loading && tokens.length === 0 ? (
          <SkeletonCard height="96px" />
        ) : tokens.length === 0 ? (
          <EmptyState icon="SH" title="No share tokens yet" subtitle="Create a token when you want another DopaFlow install to read your calendar feed." />
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {tokens.map((token) => (
              <div
                key={token.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "0.75rem",
                  alignItems: "center",
                  padding: "1rem 1.05rem",
                  borderRadius: "18px",
                  border: "1px solid var(--border-subtle)",
                  background: "linear-gradient(155deg, color-mix(in srgb, var(--surface-2) 86%, white 14%), var(--surface-2))",
                  boxShadow: "var(--shadow-soft)",
                }}
              >
                <div style={{ display: "grid", gap: "0.55rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "var(--text-sm)" }}>{token.label}</strong>
                    <MetaPill label={token.expires_at ? "Expiring token" : "Persistent token"} tone={token.expires_at ? "accent" : "default"} />
                  </div>
                  <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                    <MetaPill label={`Created ${new Date(token.created_at).toLocaleDateString()}`} />
                    <MetaPill label={`Expires ${token.expires_at ? new Date(token.expires_at).toLocaleDateString() : "never"}`} tone={token.expires_at ? "accent" : "default"} />
                    <MetaPill label={`Last used ${token.last_used_at ? new Date(token.last_used_at).toLocaleDateString() : "never"}`} tone={token.last_used_at ? "default" : "warn"} />
                  </div>
                </div>
                <Button
                  onClick={() => void handleRevokeToken(token.id)}
                  disabled={loading}
                  variant="ghost"
                  style={{ opacity: loading ? 0.6 : 1, borderColor: "var(--state-overdue)", color: "var(--state-overdue)" }}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: "0.25rem" }}>
            <strong style={{ fontSize: "var(--text-base)" }}>Subscribed calendars</strong>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: "62ch", lineHeight: 1.5 }}>
              Connect another DopaFlow calendar feed by pasting its base URL and one-time token. This is the integration path that later expands into richer user sharing.
            </span>
          </div>
          <Button
            onClick={() => setShowAddFeed((value) => !value)}
            disabled={loading}
            variant="ghost"
            style={{ opacity: loading ? 0.55 : 1, borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            {showAddFeed ? "Close" : "Add Shared Calendar"}
          </Button>
        </div>

        {feeds.length > 0 && (
          <div
            style={{
              padding: "0.85rem 0.95rem",
              borderRadius: "16px",
              background: "color-mix(in srgb, var(--surface) 78%, white 22%)",
              border: "1px solid var(--border-subtle)",
              display: "grid",
              gap: "0.35rem",
            }}
          >
            <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
              Feed health
            </span>
            <strong style={{ fontSize: "var(--text-base)" }}>
              {erroredFeedCount > 0
                ? `${erroredFeedCount} feed${erroredFeedCount === 1 ? "" : "s"} need repair`
                : staleFeedCount > 0
                  ? `${staleFeedCount} feed${staleFeedCount === 1 ? "" : "s"} may be stale`
                  : "Connected feeds look healthy"}
            </strong>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Use “Sync now” when a feed looks stale. If a feed is errored, check the exact message on the card before removing and re-adding it.
            </span>
          </div>
        )}

        {showAddFeed && (
          <div style={{ display: "grid", gap: "0.9rem", padding: "1rem", borderRadius: "18px", background: "linear-gradient(165deg, color-mix(in srgb, var(--surface-2) 86%, white 14%), var(--surface-2))", border: "1px solid var(--border-subtle)" }}>
            <div style={{ padding: "0.8rem 0.9rem", borderRadius: "14px", background: "color-mix(in srgb, var(--accent) 10%, var(--surface))", border: "1px solid color-mix(in srgb, var(--accent) 24%, var(--border-subtle))", display: "grid", gap: "0.25rem" }}>
              <strong style={{ fontSize: "var(--text-sm)" }}>Fastest path</strong>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Paste the setup code first. It fills the feed URL and token automatically so you only need to name the connection.
              </span>
            </div>
            <label style={{ display: "grid", gap: "0.4rem" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Setup code</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.55rem" }}>
                <input
                  type="text"
                  placeholder="https://partner.example.com/api/v2|token"
                  value={setupCode}
                  onChange={(event) => setSetupCode(event.target.value)}
                  disabled={loading}
                  style={inputStyle}
                />
                <Button
                  onClick={applySetupCode}
                  disabled={loading || !setupCode.trim()}
                  variant="secondary"
                  style={{ opacity: loading ? 0.6 : 1 }}
                >
                  Apply
                </Button>
              </div>
            </label>
            <div
              style={{
                padding: "0.78rem 0.88rem",
                borderRadius: "14px",
                background: "color-mix(in srgb, var(--surface) 78%, white 22%)",
                border: "1px solid var(--border-subtle)",
                display: "grid",
                gap: "0.22rem",
              }}
            >
              {setupCode.trim()
                ? "error" in parsedSetupCode
                  ? (
                    <>
                      <strong style={{ fontSize: "var(--text-sm)", color: "var(--state-warn)" }}>Setup code needs one fix</strong>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                        {parsedSetupCode.error}
                      </span>
                    </>
                  )
                  : (
                    <>
                      <strong style={{ fontSize: "var(--text-sm)" }}>Setup code looks usable</strong>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                        Base URL: {parsedSetupCode.base_url}. Token is present and ready to connect.
                      </span>
                    </>
                  )
                : (
                  <>
                    <strong style={{ fontSize: "var(--text-sm)" }}>What to paste</strong>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      Use the exact one-line setup code from the other install. It should look like {localApiBaseUrl}|token.
                    </span>
                  </>
                )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
            <label style={{ display: "grid", gap: "0.4rem" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Label</span>
              <input
                type="text"
                placeholder="e.g. Family board"
                value={newFeed.label}
                onChange={(event) => setNewFeed({ ...newFeed, label: event.target.value })}
                disabled={loading}
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: "0.4rem" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Base URL</span>
              <input
                type="text"
                placeholder="https://partner.example.com/api/v2"
                value={newFeed.base_url}
                onChange={(event) => setNewFeed({ ...newFeed, base_url: event.target.value })}
                disabled={loading}
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: "0.4rem" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Token</span>
              <input
                type="password"
                placeholder="Paste token"
                value={newFeed.token}
                onChange={(event) => setNewFeed({ ...newFeed, token: event.target.value })}
                disabled={loading}
                style={inputStyle}
              />
            </label>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input type="color" value={newFeed.color} onChange={(event) => setNewFeed({ ...newFeed, color: event.target.value })} disabled={loading} />
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>Feed color</span>
              </label>
              <Button
                onClick={() => void handleAddFeed()}
                disabled={loading}
                variant="primary"
                style={{ opacity: loading ? 0.6 : 1 }}
              >
                {loading ? "Connecting…" : "Connect Calendar"}
              </Button>
            </div>
          </div>
        )}

        {loading && feeds.length === 0 ? (
          <SkeletonCard height="104px" />
        ) : feeds.length === 0 ? (
          <EmptyState icon="FD" title="No shared calendars connected" subtitle="Add a trusted DopaFlow feed to bring another person’s schedule into your calendar surface." />
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {feeds.map((feed) => (
              (() => {
                const isStale = !feed.last_synced_at || Date.now() - new Date(feed.last_synced_at).getTime() > 36 * 60 * 60 * 1000;
                const tone = feed.sync_status === "error" ? "var(--state-overdue)" : isStale ? "var(--state-warn)" : "var(--accent)";
                const guidance = describeConnectionError(feed.last_error ?? "");
                const recoveryHint =
                  feed.sync_status === "error"
                    ? `${guidance.title}. ${guidance.detail}`
                    : isStale
                      ? "This feed is still connected, but it has gone too long without a fresh import. Retry sync before trusting event timing."
                      : "This mirror looks healthy and stays read-only inside the calendar.";

                return (
                  <div
                    key={feed.id}
                    style={{
                      display: "grid",
                      gap: "0.65rem",
                      padding: "1rem 1.05rem",
                      borderRadius: "18px",
                      border: `1px solid color-mix(in srgb, ${tone} 24%, var(--border-subtle))`,
                      background: `linear-gradient(155deg, color-mix(in srgb, ${tone} 6%, var(--surface-2)), var(--surface-2))`,
                      boxShadow: "var(--shadow-soft)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <span style={{ width: "12px", height: "12px", borderRadius: "999px", background: feed.color, boxShadow: "0 0 0 5px color-mix(in srgb, var(--surface) 72%, transparent)" }} />
                        <div style={{ display: "grid", gap: "0.3rem" }}>
                          <strong style={{ fontSize: "var(--text-sm)" }}>{feed.label}</strong>
                          <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                            <MetaPill label={feed.base_url} />
                            <MetaPill label={feed.last_error ? "Needs attention" : isStale ? "Stale mirror" : "Read-only mirror"} tone={feed.last_error || isStale ? "warn" : "accent"} />
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={feed.sync_status} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.6rem" }}>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                        <strong style={{ display: "block", color: "var(--text-primary)" }}>Last sync</strong>
                        {feed.last_synced_at ? `${new Date(feed.last_synced_at).toLocaleString()} · ${relativeSyncAge(feed.last_synced_at)}` : "Not synced yet"}
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                        <strong style={{ display: "block", color: "var(--text-primary)" }}>Status detail</strong>
                        {feed.last_error ? guidance.title : (isStale ? "Connected, but older than expected" : "Healthy")}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "0.7rem 0.8rem",
                        borderRadius: "14px",
                        background: "color-mix(in srgb, var(--surface) 74%, white 26%)",
                        border: "1px solid var(--border-subtle)",
                        fontSize: "var(--text-sm)",
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {recoveryHint}
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <Button
                        onClick={() => void handleSyncFeed(feed.id)}
                        disabled={loading}
                        variant="ghost"
                        style={{ opacity: loading ? 0.55 : 1, borderColor: "var(--accent)", color: "var(--accent)" }}
                      >
                        {feed.sync_status === "error" ? "Reconnect feed" : isStale ? "Retry sync" : "Sync now"}
                      </Button>
                      <Button
                        onClick={() => void handleRemoveFeed(feed.id)}
                        disabled={loading}
                        variant="ghost"
                        style={{ opacity: loading ? 0.55 : 1, borderColor: "var(--state-overdue)", color: "var(--state-overdue)" }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })()
            ))}
          </div>
        )}
      </section>

      <Modal open={createdToken !== null} title="Share Token Ready" onClose={() => setCreatedToken(null)}>
        {createdToken ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            <div style={{ padding: "0.85rem 0.95rem", borderRadius: "14px", background: "color-mix(in srgb, var(--accent) 10%, var(--surface))", border: "1px solid color-mix(in srgb, var(--accent) 24%, var(--border-subtle))" }}>
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Copy this token now. It is only displayed once. For future user sharing, this keeps the current flow explicit and revocable instead of silently exposing a reusable link.
            </p>
            </div>
            <label style={{ display: "grid", gap: "0.4rem" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Setup code</span>
              <input type="text" value={createdSetupCode} readOnly style={{ ...inputStyle, fontFamily: "monospace", background: "var(--surface-2)" }} />
            </label>
            <label style={{ display: "grid", gap: "0.4rem" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Suggested base URL</span>
              <input type="text" value={localApiBaseUrl} readOnly style={{ ...inputStyle, background: "var(--surface-2)" }} />
            </label>
            <label style={{ display: "grid", gap: "0.4rem" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Bearer token</span>
              <input type="text" value={createdToken.raw_token} readOnly style={{ ...inputStyle, fontFamily: "monospace", background: "var(--surface-2)" }} />
            </label>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
              Expires {createdToken.expires_at ? new Date(createdToken.expires_at).toLocaleString() : "never"}.
            </div>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <Button
                onClick={() => void copyToClipboard(createdSetupCode)}
                variant="secondary"
              >
                Copy Setup Code
              </Button>
              <Button
                onClick={() => void copyToClipboard(createdToken.raw_token)}
                variant="primary"
              >
                Copy Token
              </Button>
              <Button
                onClick={() => void copyToClipboard(localApiBaseUrl)}
                variant="ghost"
              >
                Copy Base URL
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

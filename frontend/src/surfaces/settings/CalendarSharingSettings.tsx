import { useEffect, useMemo, useState } from "react";

import type { PeerFeed, ShareToken, ShareTokenCreated } from "../../../../shared/types";
import { addPeerFeed, createShareToken, listPeerFeeds, listShareTokens, removePeerFeed, revokeShareToken, syncPeerFeed, updatePeerFeed } from "../../api/sharing";
import { API_BASE_URL } from "../../api/client";
import Button from "../../design-system/primitives/Button";
import Modal from "../../design-system/primitives/Modal";
import { showToast } from "../../design-system/primitives/Toast";
import { CalendarPeerFeedsSection } from "./CalendarPeerFeedsSection";
import { CalendarShareTokensSection } from "./CalendarShareTokensSection";
import {
  describeConnectionError,
  InfoStat,
  inputStyle,
  isLikelyApiBaseUrl,
  normalizeApiBaseUrl,
  panelStyle,
  parseSetupCode,
  StepCard,
} from "./CalendarSharingShared";

export default function CalendarSharingSettings(): JSX.Element {
  const [tokens, setTokens] = useState<ShareToken[]>([]);
  const [feeds, setFeeds] = useState<PeerFeed[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [newTokenLabel, setNewTokenLabel] = useState("");
  const [newTokenExpiryDays, setNewTokenExpiryDays] = useState<string>("30");
  const [createdToken, setCreatedToken] = useState<ShareTokenCreated | null>(null);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingColor, setEditingColor] = useState("");
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

  const handleEditFeed = async (id: string): Promise<void> => {
    if (!editingLabel.trim()) {
      showToast("Label cannot be empty.", "warn");
      return;
    }
    setLoading(true);
    try {
      await updatePeerFeed(id, { label: editingLabel.trim(), color: editingColor });
      setEditingFeedId(null);
      await loadData();
      showToast("Feed updated.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update feed", "error");
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

      <CalendarShareTokensSection
        loading={loading}
        tokens={tokens}
        showCreateToken={showCreateToken}
        newTokenLabel={newTokenLabel}
        newTokenExpiryDays={newTokenExpiryDays}
        onToggleCreate={() => {
          setShowCreateToken((value) => !value);
          setNewTokenLabel("");
        }}
        onSetNewTokenLabel={setNewTokenLabel}
        onSetNewTokenExpiryDays={setNewTokenExpiryDays}
        onCreateToken={() => void handleCreateToken()}
        onRevokeToken={(id) => void handleRevokeToken(id)}
      />

      <CalendarPeerFeedsSection
        loading={loading}
        feeds={feeds}
        erroredFeedCount={erroredFeedCount}
        staleFeedCount={staleFeedCount}
        showAddFeed={showAddFeed}
        setupCode={setupCode}
        parsedSetupCode={parsedSetupCode}
        newFeed={newFeed}
        localApiBaseUrl={localApiBaseUrl}
        editingFeedId={editingFeedId}
        editingLabel={editingLabel}
        editingColor={editingColor}
        onToggleAddFeed={() => setShowAddFeed((value) => !value)}
        onSetSetupCode={setSetupCode}
        onApplySetupCode={applySetupCode}
        onSetNewFeed={setNewFeed}
        onAddFeed={() => void handleAddFeed()}
        onSyncFeed={(id) => void handleSyncFeed(id)}
        onRemoveFeed={(id) => void handleRemoveFeed(id)}
        onStartEditFeed={(id, label, color) => {
          setEditingFeedId(id);
          setEditingLabel(label);
          setEditingColor(color);
        }}
        onSetEditingLabel={setEditingLabel}
        onSetEditingColor={setEditingColor}
        onEditFeed={(id) => void handleEditFeed(id)}
        onCancelEditFeed={() => setEditingFeedId(null)}
        relativeSyncAge={relativeSyncAge}
      />

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

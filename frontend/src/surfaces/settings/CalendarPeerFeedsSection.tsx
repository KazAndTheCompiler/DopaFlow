import { useState, type JSX } from "react";

import type { PeerFeed } from "../../../../shared/types";
import Button from "../../design-system/primitives/Button";
import EmptyState from "../../design-system/primitives/EmptyState";
import { SkeletonCard } from "../../design-system/primitives/Skeleton";

import {
  describeConnectionError,
  inputStyle,
  MetaPill,
  panelStyle,
  StatusBadge,
} from "./CalendarSharingShared";

type ParsedSetupCode = { base_url: string; token: string } | { error: string };

export function CalendarPeerFeedsSection({
  loading,
  feeds,
  erroredFeedCount,
  staleFeedCount,
  showAddFeed,
  setupCode,
  parsedSetupCode,
  newFeed,
  localApiBaseUrl,
  editingFeedId,
  editingLabel,
  editingColor,
  onToggleAddFeed,
  onSetSetupCode,
  onApplySetupCode,
  onSetNewFeed,
  onAddFeed,
  onSyncFeed,
  onRemoveFeed,
  onStartEditFeed,
  onSetEditingLabel,
  onSetEditingColor,
  onEditFeed,
  onCancelEditFeed,
  relativeSyncAge,
}: {
  loading: boolean;
  feeds: PeerFeed[];
  erroredFeedCount: number;
  staleFeedCount: number;
  showAddFeed: boolean;
  setupCode: string;
  parsedSetupCode: ParsedSetupCode;
  newFeed: { label: string; base_url: string; token: string; color: string };
  localApiBaseUrl: string;
  editingFeedId: string | null;
  editingLabel: string;
  editingColor: string;
  onToggleAddFeed: () => void;
  onSetSetupCode: (value: string) => void;
  onApplySetupCode: () => void;
  onSetNewFeed: (feed: {
    label: string;
    base_url: string;
    token: string;
    color: string;
  }) => void;
  onAddFeed: () => void;
  onSyncFeed: (id: string) => void;
  onRemoveFeed: (id: string) => void;
  onStartEditFeed: (id: string, label: string, color: string) => void;
  onSetEditingLabel: (label: string) => void;
  onSetEditingColor: (color: string) => void;
  onEditFeed: (id: string) => void;
  onCancelEditFeed: () => void;
  relativeSyncAge: (iso: string | null) => string;
}): JSX.Element {
  const [feedUrlError, setFeedUrlError] = useState("");

  function isValidFeedUrl(value: string): boolean {
    if (!value.startsWith("http://") && !value.startsWith("https://")) {
      return false;
    }
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  function handleAddFeed(): void {
    if (!isValidFeedUrl(newFeed.base_url)) {
      setFeedUrlError("Must be a valid http(s) URL");
      return;
    }
    setFeedUrlError("");
    onAddFeed();
  }

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "0.75rem",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: "0.25rem" }}>
          <strong style={{ fontSize: "var(--text-base)" }}>
            Subscribed calendars
          </strong>
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              maxWidth: "62ch",
              lineHeight: 1.5,
            }}
          >
            Connect another DopaFlow calendar feed by pasting its base URL and
            one-time token. This is the integration path that later expands into
            richer user sharing.
          </span>
        </div>
        <Button
          onClick={onToggleAddFeed}
          disabled={loading}
          variant="ghost"
          style={{
            opacity: loading ? 0.55 : 1,
            borderColor: "var(--accent)",
            color: "var(--accent)",
          }}
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
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--accent)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 800,
            }}
          >
            Feed health
          </span>
          <strong style={{ fontSize: "var(--text-base)" }}>
            {erroredFeedCount > 0
              ? `${erroredFeedCount} feed${erroredFeedCount === 1 ? "" : "s"} need repair`
              : staleFeedCount > 0
                ? `${staleFeedCount} feed${staleFeedCount === 1 ? "" : "s"} may be stale`
                : "Connected feeds look healthy"}
          </strong>
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            Use “Sync now” when a feed looks stale. If a feed is errored, check
            the exact message on the card before removing and re-adding it.
          </span>
        </div>
      )}

      {showAddFeed && (
        <div
          style={{
            display: "grid",
            gap: "0.9rem",
            padding: "1rem",
            borderRadius: "18px",
            background:
              "linear-gradient(165deg, color-mix(in srgb, var(--surface-2) 86%, white 14%), var(--surface-2))",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div
            style={{
              padding: "0.8rem 0.9rem",
              borderRadius: "14px",
              background:
                "color-mix(in srgb, var(--accent) 10%, var(--surface))",
              border:
                "1px solid color-mix(in srgb, var(--accent) 24%, var(--border-subtle))",
              display: "grid",
              gap: "0.25rem",
            }}
          >
            <strong style={{ fontSize: "var(--text-sm)" }}>Fastest path</strong>
            <span
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              Paste the setup code first. It fills the feed URL and token
              automatically so you only need to name the connection.
            </span>
          </div>
          <label style={{ display: "grid", gap: "0.4rem" }}>
            <span
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Setup code
            </span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "0.55rem",
              }}
            >
              <input
                type="text"
                placeholder="https://partner.example.com/api/v2|token"
                value={setupCode}
                onChange={(event) => onSetSetupCode(event.target.value)}
                disabled={loading}
                style={inputStyle}
              />
              <Button
                onClick={onApplySetupCode}
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
            {setupCode.trim() ? (
              "error" in parsedSetupCode ? (
                <>
                  <strong
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--state-warn)",
                    }}
                  >
                    Setup code needs one fix
                  </strong>
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    {parsedSetupCode.error}
                  </span>
                </>
              ) : (
                <>
                  <strong style={{ fontSize: "var(--text-sm)" }}>
                    Setup code looks usable
                  </strong>
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    Base URL: {parsedSetupCode.base_url}. Token is present and
                    ready to connect.
                  </span>
                </>
              )
            ) : (
              <>
                <strong style={{ fontSize: "var(--text-sm)" }}>
                  What to paste
                </strong>
                <span
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  Use the exact one-line setup code from the other install. It
                  should look like {localApiBaseUrl}|token.
                </span>
              </>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <label style={{ display: "grid", gap: "0.4rem" }}>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Label
              </span>
              <input
                type="text"
                placeholder="e.g. Family board"
                value={newFeed.label}
                onChange={(event) =>
                  onSetNewFeed({ ...newFeed, label: event.target.value })
                }
                disabled={loading}
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: "0.4rem" }}>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Base URL
              </span>
              <input
                type="text"
                placeholder="https://partner.example.com/api/v2"
                value={newFeed.base_url}
                onChange={(event) => {
                  setFeedUrlError("");
                  onSetNewFeed({ ...newFeed, base_url: event.target.value });
                }}
                disabled={loading}
                style={inputStyle}
              />
              {feedUrlError ? (
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--state-overdue)",
                  }}
                >
                  {feedUrlError}
                </span>
              ) : null}
            </label>
            <label style={{ display: "grid", gap: "0.4rem" }}>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Token
              </span>
              <input
                type="password"
                placeholder="Paste token"
                value={newFeed.token}
                onChange={(event) =>
                  onSetNewFeed({ ...newFeed, token: event.target.value })
                }
                disabled={loading}
                style={inputStyle}
              />
            </label>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "0.75rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label
              style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
            >
              <input
                type="color"
                value={newFeed.color}
                onChange={(event) =>
                  onSetNewFeed({ ...newFeed, color: event.target.value })
                }
                disabled={loading}
              />
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                }}
              >
                Feed color
              </span>
            </label>
            <Button
              onClick={handleAddFeed}
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
        <EmptyState
          icon="FD"
          title="No shared calendars connected"
          subtitle="Add a trusted DopaFlow feed to bring another person’s schedule into your calendar surface."
        />
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {feeds.map((feed) => {
            const isStale =
              !feed.last_synced_at ||
              Date.now() - new Date(feed.last_synced_at).getTime() >
                36 * 60 * 60 * 1000;
            const tone =
              feed.sync_status === "error"
                ? "var(--state-overdue)"
                : isStale
                  ? "var(--state-warn)"
                  : "var(--accent)";
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "999px",
                        background: feed.color,
                        boxShadow:
                          "0 0 0 5px color-mix(in srgb, var(--surface) 72%, transparent)",
                      }}
                    />
                    <div style={{ display: "grid", gap: "0.3rem" }}>
                      <strong style={{ fontSize: "var(--text-sm)" }}>
                        {feed.label}
                      </strong>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.45rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <MetaPill label={feed.base_url} />
                        <MetaPill
                          label={
                            feed.last_error
                              ? "Needs attention"
                              : isStale
                                ? "Stale mirror"
                                : "Read-only mirror"
                          }
                          tone={feed.last_error || isStale ? "warn" : "accent"}
                        />
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={feed.sync_status} />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: "0.6rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <strong
                      style={{ display: "block", color: "var(--text-primary)" }}
                    >
                      Last sync
                    </strong>
                    {feed.last_synced_at
                      ? `${new Date(feed.last_synced_at).toLocaleString()} · ${relativeSyncAge(feed.last_synced_at)}`
                      : "Not synced yet"}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <strong
                      style={{ display: "block", color: "var(--text-primary)" }}
                    >
                      Status detail
                    </strong>
                    {feed.last_error
                      ? guidance.title
                      : isStale
                        ? "Connected, but older than expected"
                        : "Healthy"}
                  </div>
                </div>

                <div
                  style={{
                    padding: "0.7rem 0.8rem",
                    borderRadius: "14px",
                    background:
                      "color-mix(in srgb, var(--surface) 74%, white 26%)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  {recoveryHint}
                </div>

                <div
                  style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                >
                  <Button
                    onClick={() => onSyncFeed(feed.id)}
                    disabled={loading}
                    variant="ghost"
                    style={{
                      opacity: loading ? 0.55 : 1,
                      borderColor: "var(--accent)",
                      color: "var(--accent)",
                    }}
                  >
                    {feed.sync_status === "error"
                      ? "Reconnect feed"
                      : isStale
                        ? "Retry sync"
                        : "Sync now"}
                  </Button>
                  {editingFeedId !== feed.id && (
                    <Button
                      onClick={() =>
                        onStartEditFeed(feed.id, feed.label, feed.color)
                      }
                      disabled={loading}
                      variant="ghost"
                      style={{
                        opacity: loading ? 0.55 : 1,
                        borderColor: "var(--border-subtle)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    onClick={() => onRemoveFeed(feed.id)}
                    disabled={loading}
                    variant="ghost"
                    style={{
                      opacity: loading ? 0.55 : 1,
                      borderColor: "var(--state-overdue)",
                      color: "var(--state-overdue)",
                    }}
                  >
                    Remove
                  </Button>
                </div>
                {editingFeedId === feed.id && (
                  <div
                    style={{
                      display: "grid",
                      gap: "0.6rem",
                      padding: "0.75rem 0.85rem",
                      borderRadius: "13px",
                      background:
                        "color-mix(in srgb, var(--surface) 74%, white 26%)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: "0.55rem",
                        alignItems: "end",
                      }}
                    >
                      <label style={{ display: "grid", gap: "0.3rem" }}>
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--text-secondary)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Label
                        </span>
                        <input
                          type="text"
                          value={editingLabel}
                          onChange={(e) => onSetEditingLabel(e.target.value)}
                          disabled={loading}
                          style={{ ...inputStyle, fontSize: "var(--text-sm)" }}
                        />
                      </label>
                      <label
                        style={{
                          display: "flex",
                          gap: "0.4rem",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--text-secondary)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Color
                        </span>
                        <input
                          type="color"
                          value={editingColor}
                          onChange={(e) => onSetEditingColor(e.target.value)}
                          disabled={loading}
                        />
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <Button
                        onClick={() => onEditFeed(feed.id)}
                        disabled={loading}
                        variant="primary"
                        style={{
                          opacity: loading ? 0.6 : 1,
                          fontSize: "var(--text-xs)",
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        onClick={onCancelEditFeed}
                        disabled={loading}
                        variant="ghost"
                        style={{
                          opacity: loading ? 0.55 : 1,
                          fontSize: "var(--text-xs)",
                          borderColor: "var(--border-subtle)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

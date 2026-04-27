import type { JSX } from "react";

import type { ShareToken } from "../../../../shared/types";
import Button from "../../design-system/primitives/Button";
import EmptyState from "../../design-system/primitives/EmptyState";
import { SkeletonCard } from "../../design-system/primitives/Skeleton";

import {
  inputStyle,
  MetaPill,
  panelStyle,
  StepCard,
} from "./CalendarSharingShared";

export function CalendarShareTokensSection({
  loading,
  tokens,
  showCreateToken,
  newTokenLabel,
  newTokenExpiryDays,
  onToggleCreate,
  onSetNewTokenLabel,
  onSetNewTokenExpiryDays,
  onCreateToken,
  onRevokeToken,
}: {
  loading: boolean;
  tokens: ShareToken[];
  showCreateToken: boolean;
  newTokenLabel: string;
  newTokenExpiryDays: string;
  onToggleCreate: () => void;
  onSetNewTokenLabel: (value: string) => void;
  onSetNewTokenExpiryDays: (value: string) => void;
  onCreateToken: () => void;
  onRevokeToken: (id: string) => void;
}): JSX.Element {
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
            Share my calendar
          </strong>
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              maxWidth: "62ch",
              lineHeight: 1.5,
            }}
          >
            Generate a one-time token, copy it immediately, and give it only to
            people or devices you trust.
          </span>
        </div>
        <Button
          onClick={onToggleCreate}
          disabled={loading}
          variant="ghost"
          style={{
            opacity: loading ? 0.55 : 1,
            borderColor: "var(--accent)",
            color: "var(--accent)",
          }}
        >
          {showCreateToken ? "Close" : "New Share Token"}
        </Button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "0.75rem",
        }}
      >
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
              placeholder="e.g. Home wall display"
              value={newTokenLabel}
              onChange={(event) => onSetNewTokenLabel(event.target.value)}
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
              Expiry
            </span>
            <select
              value={newTokenExpiryDays}
              onChange={(event) => onSetNewTokenExpiryDays(event.target.value)}
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "0.75rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
              }}
            >
              Tokens are shown once and should be rotated or allowed to expire
              if shared too broadly.
            </span>
            <Button
              onClick={onCreateToken}
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
        <EmptyState
          icon="SH"
          title="No share tokens yet"
          subtitle="Create a token when you want another DopaFlow install to read your calendar feed."
        />
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
                background:
                  "linear-gradient(155deg, color-mix(in srgb, var(--surface-2) 86%, white 14%), var(--surface-2))",
                boxShadow: "var(--shadow-soft)",
              }}
            >
              <div style={{ display: "grid", gap: "0.55rem" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ fontSize: "var(--text-sm)" }}>
                    {token.label}
                  </strong>
                  <MetaPill
                    label={
                      token.expires_at ? "Expiring token" : "Persistent token"
                    }
                    tone={token.expires_at ? "accent" : "default"}
                  />
                </div>
                <div
                  style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}
                >
                  <MetaPill
                    label={`Created ${new Date(token.created_at).toLocaleDateString()}`}
                  />
                  <MetaPill
                    label={`Expires ${token.expires_at ? new Date(token.expires_at).toLocaleDateString() : "never"}`}
                    tone={token.expires_at ? "accent" : "default"}
                  />
                  <MetaPill
                    label={`Last used ${token.last_used_at ? new Date(token.last_used_at).toLocaleDateString() : "never"}`}
                    tone={token.last_used_at ? "default" : "warn"}
                  />
                </div>
              </div>
              <Button
                onClick={() => onRevokeToken(token.id)}
                disabled={loading}
                variant="ghost"
                style={{
                  opacity: loading ? 0.6 : 1,
                  borderColor: "var(--state-overdue)",
                  color: "var(--state-overdue)",
                }}
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

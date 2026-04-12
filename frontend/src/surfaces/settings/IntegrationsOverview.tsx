import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

import type { IntegrationsStatus, PeerFeed, VaultStatus } from "../../../../shared/types";
import { getIntegrationsStatus, getVaultStatus } from "@api/index";
import { listPeerFeeds } from "../../api/sharing";

type OverviewState = {
  integrations: IntegrationsStatus | null;
  peerFeeds: PeerFeed[];
  vault: VaultStatus | null;
};

type OverviewTone = "Connected" | "Needs attention" | "Disabled" | "Error" | "Local-only";

function inferTursoStatus(): { tone: OverviewTone; detail: string } {
  const hasUrl = Boolean(localStorage.getItem("dopaflow:turso_url")?.trim());
  if (hasUrl) {
    return { tone: "Local-only", detail: "Database URL preset saved on this device. Paste a token in the Turso panel when testing." };
  }
  return { tone: "Disabled", detail: "No Turso database URL preset saved locally." };
}

function inferGitHubStatus(): { tone: OverviewTone; detail: string } {
  const hasRepo = Boolean(localStorage.getItem("dopaflow:github_repo")?.trim());
  if (hasRepo) {
    return {
      tone: "Local-only",
      detail: `Repo preset saved for ${localStorage.getItem("dopaflow:github_repo")}. Paste a token when importing.`,
    };
  }
  return { tone: "Disabled", detail: "No GitHub repo preset saved in this browser." };
}

function toneStyle(tone: OverviewTone): CSSProperties {
  if (tone === "Connected") return { color: "var(--state-ok)", background: "color-mix(in srgb, var(--state-ok) 14%, transparent)" };
  if (tone === "Needs attention") return { color: "var(--state-warn)", background: "color-mix(in srgb, var(--state-warn) 14%, transparent)" };
  if (tone === "Error") return { color: "var(--state-overdue)", background: "color-mix(in srgb, var(--state-overdue) 14%, transparent)" };
  if (tone === "Local-only") return { color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)" };
  return { color: "var(--text-secondary)", background: "var(--surface-2)" };
}

function JumpButton({ targetId }: { targetId: string }): JSX.Element {
  return (
    <button
      onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })}
      style={{
        padding: "0.35rem 0.7rem",
        borderRadius: "999px",
        border: "1px solid var(--border-subtle)",
        background: "var(--surface)",
        color: "var(--text-secondary)",
        fontSize: "var(--text-xs)",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      Open
    </button>
  );
}

export default function IntegrationsOverview(): JSX.Element {
  const [state, setState] = useState<OverviewState>({ integrations: null, peerFeeds: [], vault: null });
  const [error, setError] = useState<string | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState<boolean>(() => (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 900px)").matches
      : false
  ));

  useEffect(() => {
    void Promise.all([
      getIntegrationsStatus().catch(() => null),
      listPeerFeeds().catch(() => [] as PeerFeed[]),
      getVaultStatus().catch(() => null),
    ])
      .then(([integrations, peerFeeds, vault]) => setState({ integrations, peerFeeds, vault }))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load integration overview"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const mq = window.matchMedia("(max-width: 900px)");
    const onChange = (event: MediaQueryListEvent): void => setIsCompactLayout(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const calendarTone: OverviewTone =
    state.peerFeeds.length === 0
      ? "Disabled"
      : state.peerFeeds.some((feed) => feed.sync_status === "error")
        ? "Needs attention"
        : state.peerFeeds.some((feed) => feed.sync_status === "syncing")
          ? "Local-only"
          : "Connected";
  const calendarDetail =
    state.peerFeeds.length === 0
      ? "No peer calendar feeds configured."
      : `${state.peerFeeds.length} peer feed${state.peerFeeds.length > 1 ? "s" : ""} configured.`;

  const gmailTone: OverviewTone =
    state.integrations?.gmail_connected ? "Connected" : state.integrations ? "Disabled" : "Local-only";
  const gmailDetail =
    state.integrations?.gmail_connected
      ? "OAuth token stored and import path ready."
      : "No Gmail connection stored in DopaFlow.";

  const webhookTone: OverviewTone =
    !state.integrations?.webhooks_enabled
      ? "Disabled"
      : state.integrations.webhook_retry_wait > 0
        ? "Needs attention"
        : "Connected";
  const webhookDetail = state.integrations
    ? state.integrations.webhooks_enabled
      ? `${state.integrations.webhook_pending} pending · ${state.integrations.webhook_retry_wait} retrying · ${state.integrations.webhook_sent} sent`
      : "No enabled outgoing webhooks."
    : "Webhook health unavailable.";

  const vaultTone: OverviewTone =
    state.vault?.config.vault_enabled
      ? state.vault.vault_reachable
        ? state.vault.conflicts > 0 ? "Needs attention" : "Connected"
        : "Error"
      : "Disabled";
  const vaultDetail = state.vault
    ? state.vault.config.vault_enabled
      ? state.vault.vault_reachable
        ? `${state.vault.total_indexed} indexed · ${state.vault.conflicts} conflicts`
        : "Vault path is enabled but not reachable."
      : "Vault bridge is off."
    : "Vault status unavailable.";

  const github = inferGitHubStatus();
  const turso = inferTursoStatus();

  const rows: Array<{ name: string; tone: OverviewTone; detail: string; targetId: string }> = [
    { name: "Google Calendar", tone: calendarTone, detail: calendarDetail, targetId: "settings-sync-sharing" },
    { name: "Gmail", tone: gmailTone, detail: gmailDetail, targetId: "settings-integrations" },
    { name: "GitHub", tone: github.tone, detail: github.detail, targetId: "settings-integrations" },
    { name: "Webhooks", tone: webhookTone, detail: webhookDetail, targetId: "settings-integrations" },
    { name: "Turso", tone: turso.tone, detail: turso.detail, targetId: "settings-sync-sharing" },
    { name: "Obsidian Vault", tone: vaultTone, detail: vaultDetail, targetId: "settings-vault" },
  ];

  return (
    <div
      style={{
        padding: "1rem 1.05rem",
        borderRadius: "20px",
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "0.7rem",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <strong>Integrations overview</strong>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          One place to see what is connected, what is degraded, and where to fix it without spelunking through five panels.
        </span>
      </div>
      {error && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--state-overdue)" }}>
          {error}
        </div>
      )}
      {rows.map((row) => {
        const tone = toneStyle(row.tone);
        return (
          <div
            key={row.name}
            style={{
              display: "grid",
              gridTemplateColumns: isCompactLayout ? "minmax(0, 1fr)" : "minmax(0, 1fr) auto auto",
              gap: "0.75rem",
              alignItems: "center",
              padding: "0.7rem 0.75rem",
              borderRadius: "14px",
              background: "var(--surface-2)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "grid", gap: "0.18rem", minWidth: 0 }}>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>{row.name}</span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                {row.detail}
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: isCompactLayout ? "flex-start" : "flex-end" }}>
              <span
                style={{
                  ...tone,
                  padding: "0.28rem 0.55rem",
                  borderRadius: "999px",
                  fontSize: "var(--text-xs)",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {row.tone}
              </span>
              <JumpButton targetId={row.targetId} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

import type { CSSProperties } from "react";

import { connectGmail } from "@api/index";
import { useAppJournal, useAppLayout, useAppSkin } from "../../app/AppContexts";
import BackupStatus from "./BackupStatus";
import CalendarSharingSettings from "./CalendarSharingSettings";
import ExportPanel from "./ExportPanel";
import GitHubIntegration from "./GitHubIntegration";
import GmailConnect from "./GmailConnect";
import IntegrationsOverview from "./IntegrationsOverview";
import SettingsPanel from "./SettingsPanel";
import SkinPicker from "./SkinPicker";
import LayoutPicker from "./LayoutPicker";
import TursoConfig from "./TursoConfig";
import WebhookPanel from "./WebhookPanel";
import VaultSettings from "./VaultSettings";

export default function SettingsView(): JSX.Element {
  const skin = useAppSkin();
  const layout = useAppLayout();
  const journal = useAppJournal();

  const sectionTitleStyle: CSSProperties = {
    fontSize: "var(--text-xs)",
    fontWeight: 700,
    color: "var(--text-secondary)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
  };

  const groupStyle: CSSProperties = {
    display: "grid",
    gap: "0.9rem",
    padding: "1rem 1.05rem 1.1rem",
    borderRadius: "22px",
    background: "color-mix(in srgb, var(--surface) 88%, transparent)",
    backdropFilter: "var(--surface-glass-blur, blur(14px))",
    border: "1px solid var(--border-subtle)",
    boxShadow: "var(--shadow-soft)",
    position: "relative",
  };

  const groupHeaderStyle: CSSProperties = {
    display: "grid",
    gap: "0.3rem",
  };

  const groupDescriptionStyle: CSSProperties = {
    fontSize: "var(--text-sm)",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    maxWidth: "70ch",
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <SettingsPanel />
      <section style={groupStyle} id="settings-integrations-overview">
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div style={groupHeaderStyle}>
          <span style={sectionTitleStyle}>System Health</span>
          <span style={groupDescriptionStyle}>
            See the integration picture first: what is connected, what is degraded, and what still lives only on this device.
          </span>
        </div>
        <IntegrationsOverview />
      </section>
      <section style={groupStyle}>
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div style={groupHeaderStyle}>
          <span style={sectionTitleStyle}>Look & Feel</span>
          <span style={groupDescriptionStyle}>
            Tune the shell, color system, and density. These are the settings that change how DopaFlow feels every time you open it.
          </span>
        </div>
        <SkinPicker current={skin.skin} skins={skin.skins} loading={skin.loading} onPick={skin.setSkin} />
        <LayoutPicker current={layout.layout} onPick={layout.setLayout} />
      </section>
      <section style={groupStyle} id="settings-vault">
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div style={groupHeaderStyle}>
          <span style={sectionTitleStyle}>Obsidian Vault</span>
          <span style={groupDescriptionStyle}>
            Connect a local Obsidian vault. DopaFlow writes daily journal notes as plain Markdown so your notes stay yours and work inside Obsidian.
          </span>
        </div>
        <VaultSettings />
      </section>
      <section style={groupStyle} id="settings-sync-sharing">
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div style={groupHeaderStyle}>
          <span style={sectionTitleStyle}>Sync & Sharing</span>
          <span style={groupDescriptionStyle}>
            Connect remote storage and calendar feeds carefully. Keep the local-first default, then layer sharing on top only where it actually helps.
          </span>
        </div>
        <TursoConfig />
        <CalendarSharingSettings />
      </section>
      <section style={groupStyle} id="settings-integrations">
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div style={groupHeaderStyle}>
          <span style={sectionTitleStyle}>Integrations</span>
          <span style={groupDescriptionStyle}>
            Wire in outside systems without turning the app into a dashboard graveyard. Each integration should earn its place in the daily loop.
          </span>
        </div>
        <GmailConnect onConnect={() => connectGmail({ redirect_uri: window.location.href }).then(() => undefined)} />
        <GitHubIntegration />
        <WebhookPanel />
      </section>
      <section style={groupStyle}>
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
        <div style={groupHeaderStyle}>
          <span style={sectionTitleStyle}>Safety & Export</span>
          <span style={groupDescriptionStyle}>
            Protect the data first. Backup, export, and recovery controls should stay obvious so the app remains trustworthy even when everything else changes.
          </span>
        </div>
        <BackupStatus
          backupPath={journal.backupPath}
          lastBackupAt={journal.lastBackupAt}
          onTrigger={() => journal.triggerBackup().then(() => undefined)}
        />
        <ExportPanel />
      </section>
    </div>
  );
}

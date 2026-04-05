import { useContext } from "react";

import { connectGmail } from "@api/index";
import { AppDataContext } from "../../App";
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
  const app = useContext(AppDataContext);
  if (!app) {
    return <div>App context unavailable.</div>;
  }

  const sectionTitleStyle = {
    fontSize: "var(--text-xs)",
    fontWeight: 700,
    color: "var(--text-secondary)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
  };

  const groupStyle = {
    display: "grid",
    gap: "0.9rem",
    padding: "1rem 1.05rem 1.1rem",
    borderRadius: "22px",
    background: "linear-gradient(160deg, color-mix(in srgb, var(--surface) 92%, white 8%), color-mix(in srgb, var(--surface) 98%, black 2%))",
    border: "1px solid var(--border-subtle)",
    boxShadow: "var(--shadow-soft)",
  };

  const groupHeaderStyle = {
    display: "grid",
    gap: "0.3rem",
  };

  const groupDescriptionStyle = {
    fontSize: "var(--text-sm)",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    maxWidth: "70ch",
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <SettingsPanel />
      <section style={groupStyle} id="settings-integrations-overview">
        <div style={groupHeaderStyle}>
          <span style={sectionTitleStyle}>System Health</span>
          <span style={groupDescriptionStyle}>
            See the integration picture first: what is connected, what is degraded, and what still lives only on this device.
          </span>
        </div>
        <IntegrationsOverview />
      </section>
      <section style={groupStyle}>
        <div style={groupHeaderStyle}>
          <span style={sectionTitleStyle}>Look & Feel</span>
          <span style={groupDescriptionStyle}>
            Tune the shell, color system, and density. These are the settings that change how DopaFlow feels every time you open it.
          </span>
        </div>
        <SkinPicker current={app.skin.skin} skins={app.skin.skins} loading={app.skin.loading} onPick={app.skin.setSkin} />
        <LayoutPicker current={app.layout.layout} onPick={app.layout.setLayout} />
      </section>
      <section style={groupStyle} id="settings-vault">
        <div style={groupHeaderStyle}>
          <span style={sectionTitleStyle}>Obsidian Vault</span>
          <span style={groupDescriptionStyle}>
            Connect a local Obsidian vault. DopaFlow writes daily journal notes as plain Markdown so your notes stay yours and work inside Obsidian.
          </span>
        </div>
        <VaultSettings />
      </section>
      <section style={groupStyle} id="settings-sync-sharing">
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
        <div style={groupHeaderStyle}>
          <span style={sectionTitleStyle}>Safety & Export</span>
          <span style={groupDescriptionStyle}>
            Protect the data first. Backup, export, and recovery controls should stay obvious so the app remains trustworthy even when everything else changes.
          </span>
        </div>
        <BackupStatus
          backupPath={app.journal.backupPath}
          lastBackupAt={app.journal.lastBackupAt}
          onTrigger={() => app.journal.triggerBackup().then(() => undefined)}
        />
        <ExportPanel />
      </section>
    </div>
  );
}

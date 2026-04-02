import { useContext } from "react";

import { connectGmail } from "@api/index";
import { AppDataContext } from "../../App";
import BackupStatus from "./BackupStatus";
import CalendarSharingSettings from "./CalendarSharingSettings";
import ExportPanel from "./ExportPanel";
import GitHubIntegration from "./GitHubIntegration";
import GmailConnect from "./GmailConnect";
import SettingsPanel from "./SettingsPanel";
import SkinPicker from "./SkinPicker";
import TursoConfig from "./TursoConfig";
import WebhookPanel from "./WebhookPanel";

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

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <SettingsPanel />
      <section style={{ display: "grid", gap: "0.75rem" }}>
        <span style={sectionTitleStyle}>Look & Feel</span>
        <SkinPicker current={app.skin.skin} skins={app.skin.skins} onPick={app.skin.setSkin} />
      </section>
      <section style={{ display: "grid", gap: "0.75rem" }}>
        <span style={sectionTitleStyle}>Sync & Sharing</span>
        <TursoConfig />
        <CalendarSharingSettings />
      </section>
      <section style={{ display: "grid", gap: "0.75rem" }}>
        <span style={sectionTitleStyle}>Integrations</span>
        <GmailConnect onConnect={() => connectGmail({ redirect_uri: window.location.href }).then(() => undefined)} />
        <GitHubIntegration />
        <WebhookPanel />
      </section>
      <section style={{ display: "grid", gap: "0.75rem" }}>
        <span style={sectionTitleStyle}>Safety & Export</span>
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

import { useContext, useEffect, useState } from "react";

import { AppDataContext } from "../../App";
import TemplatesPicker from "../../components/TemplatesPicker";
import { exportJournalToday } from "../../api/journal";
import AnalyticsView from "./AnalyticsView";
import EditorView from "./EditorView";
import GraphView from "./GraphView";
import JournalPanel from "./JournalPanel";

type Tab = "editor" | "graph" | "analytics";

export default function JournalView(): JSX.Element {
  const app = useContext(AppDataContext);
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [activeTab, setActiveTab] = useState<Tab>("editor");
  const [exportMessage, setExportMessage] = useState<string>("");

  if (!app) {
    return <div>App context unavailable.</div>;
  }

  const activeEntry = app.journal.entries.find((e) => e.date === selectedDate);

  useEffect(() => {
    return () => {
      const todayEntry = app.journal.entries.find((e) => e.date === today);
      if (todayEntry) {
        exportJournalToday().catch(() => {});
      }
    };
  }, [app.journal.entries, today]);

  const handleExportToday = async () => {
    try {
      const result = await exportJournalToday();
      if (result.entry_count > 0) {
        setExportMessage("Saved to journal-backup");
        setTimeout(() => setExportMessage(""), 3000);
      }
    } catch {
      setExportMessage("Export failed");
      setTimeout(() => setExportMessage(""), 3000);
    }
  };

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    padding: "0.4rem 1rem",
    borderRadius: "8px",
    border: "none",
    background: activeTab === tab ? "var(--accent)" : "transparent",
    color: activeTab === tab ? "var(--text-inverted)" : "var(--text-secondary)",
    cursor: "pointer",
    fontWeight: activeTab === tab ? 600 : 400,
    fontSize: "var(--text-sm)",
  });

  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(200px, 240px) minmax(0, 1fr)" }}>
      <JournalPanel
        entries={app.journal.entries}
        loading={false}
        selectedDate={selectedDate}
        backupPath={app.journal.backupPath}
        lastBackupAt={app.journal.lastBackupAt}
        onSelectDate={setSelectedDate}
        onTriggerBackup={() => void app.journal.triggerBackup(selectedDate)}
      />

      <div style={{ display: "grid", gap: "1rem", alignContent: "start" }}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "start" }}>
          <TemplatesPicker onApply={(body, tags) => { void app.journal.save({ date: selectedDate, markdown_body: body, tags, emoji: activeEntry?.emoji ?? null }); }} />
          {selectedDate === today && (
            <button
              onClick={handleExportToday}
              style={{
                padding: "0.5rem 1rem",
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
                color: "var(--text-primary)",
                height: "fit-content",
              }}
            >
              Export today
            </button>
          )}
          {exportMessage && (
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", padding: "0.5rem 0", alignSelf: "center" }}>
              {exportMessage}
            </span>
          )}
        </div>
        <nav style={{ display: "flex", gap: "0.25rem", padding: "0.3rem", background: "var(--surface)", borderRadius: "12px", width: "fit-content" }}>
          <button style={tabStyle("editor")} onClick={() => setActiveTab("editor")}>Editor</button>
          <button style={tabStyle("graph")} onClick={() => setActiveTab("graph")}>Graph</button>
          <button style={tabStyle("analytics")} onClick={() => setActiveTab("analytics")}>Analytics</button>
        </nav>

        {activeTab === "editor" && (
          <EditorView
            entry={activeEntry}
            entries={app.journal.entries}
            selectedDate={selectedDate}
            onSave={app.journal.save}
            onNavigateDate={setSelectedDate}
          />
        )}
        {activeTab === "graph" && <GraphView graph={app.journal.graph} />}
        {activeTab === "analytics" && <AnalyticsView entries={app.journal.entries} />}
      </div>
    </div>
  );
}

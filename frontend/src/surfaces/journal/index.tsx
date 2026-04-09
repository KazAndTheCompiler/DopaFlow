import { useEffect, useState } from "react";

import { useAppJournal } from "../../app/AppContexts";
import TemplatesPicker from "../../components/TemplatesPicker";
import { exportJournalToday } from "../../api/journal";
import AnalyticsView from "./AnalyticsView";
import EditorView from "./EditorView";
import GraphView from "./GraphView";
import JournalPanel from "./JournalPanel";
import { JournalSurfaceSkeleton } from "@ds/primitives/Skeleton";

type Tab = "editor" | "graph" | "analytics";

export default function JournalView(): JSX.Element {
  const journal = useAppJournal();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [activeTab, setActiveTab] = useState<Tab>("editor");
  const [exportMessage, setExportMessage] = useState<string>("");
  const [isCompactLayout, setIsCompactLayout] = useState<boolean>(() => (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 980px)").matches
      : false
  ));

  if (journal.loading) {
    return <JournalSurfaceSkeleton />;
  }

  const activeEntry = journal.entries.find((e) => e.date === selectedDate);

  useEffect(() => {
    return () => {
      const todayEntry = journal.entries.find((e) => e.date === today);
      if (todayEntry) {
        exportJournalToday().catch(() => {});
      }
    };
  }, [journal.entries, today]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const mq = window.matchMedia("(max-width: 980px)");
    const onChange = (event: MediaQueryListEvent): void => setIsCompactLayout(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: isCompactLayout ? "minmax(0, 1fr)" : "minmax(200px, 240px) minmax(0, 1fr)", alignItems: "start" }}>
      <JournalPanel
        entries={journal.entries}
        loading={journal.loading}
        selectedDate={selectedDate}
        backupPath={journal.backupPath}
        lastBackupAt={journal.lastBackupAt}
        onSelectDate={setSelectedDate}
        onTriggerBackup={() => void journal.triggerBackup(selectedDate)}
      />

      <div style={{ display: "grid", gap: "1rem", alignContent: "start", minWidth: 0 }}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "start", flexWrap: "wrap", minWidth: 0 }}>
          <TemplatesPicker onApply={(body, tags) => { void journal.save({ date: selectedDate, markdown_body: body, tags, emoji: activeEntry?.emoji ?? null }); }} />
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
        <nav style={{ display: "flex", gap: "0.25rem", padding: "0.3rem", background: "var(--surface)", borderRadius: "12px", width: "fit-content", flexWrap: "wrap", maxWidth: "100%" }}>
          <button style={tabStyle("editor")} onClick={() => setActiveTab("editor")}>Editor</button>
          <button style={tabStyle("graph")} onClick={() => setActiveTab("graph")}>Graph</button>
          <button style={tabStyle("analytics")} onClick={() => setActiveTab("analytics")}>Analytics</button>
        </nav>

        {activeTab === "editor" && (
          <EditorView
            entry={activeEntry}
            entries={journal.entries}
            selectedDate={selectedDate}
            onSave={journal.save}
            onNavigateDate={setSelectedDate}
            onVoiceExecuted={() => {
              void journal.refresh();
              void journal.refreshGraph();
            }}
          />
        )}
        {activeTab === "graph" && <GraphView graph={journal.graph} />}
        {activeTab === "analytics" && <AnalyticsView entries={journal.entries} />}
      </div>
    </div>
  );
}

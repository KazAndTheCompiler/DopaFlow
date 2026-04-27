import { useState } from "react";
import { showToast } from "@ds/primitives/Toast";
import { API_BASE_URL } from "@api/client";

interface ExportItem {
  id: string;
  label: string;
  description: string;
  filename: string;
  path: string;
}

function buildExports(): ExportItem[] {
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return [
    {
      id: "all",
      label: "Everything (ZIP)",
      description: "Tasks, habits, journal, alarms, nutrition in one archive",
      filename: "dopaflow-export.zip",
      path: "/ops/export/all",
    },
    {
      id: "tasks",
      label: "Tasks (CSV)",
      description: "All tasks with status, priority, tags, subtasks",
      filename: "tasks.csv",
      path: "/tasks/export/csv",
    },
    {
      id: "journal",
      label: "Journal (ZIP)",
      description: "All journal entries as Markdown files (last 12 months)",
      filename: "journal.zip",
      path: `/journal/export/zip?from=${fromDate}&to=${toDate}`,
    },
    {
      id: "nutrition",
      label: "Nutrition (CSV)",
      description: "Full food log with macros (last 12 months)",
      filename: "nutrition.csv",
      path: `/nutrition/export/csv?from=${fromDate}&to=${toDate}`,
    },
  ];
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function inferFilename(item: ExportItem, response: Response): string {
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1]?.trim() || item.filename;
}

const EXPORTS = buildExports();

export default function ExportPanel(): JSX.Element {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastDownload, setLastDownload] = useState<string | null>(null);

  const handleExport = async (item: ExportItem): Promise<void> => {
    setLoading(item.id);
    setError(null);
    setLastDownload(null);
    try {
      const res = await fetch(`${API_BASE_URL}${item.path}`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let hint = "";
        if (res.status === 401 || res.status === 403) {
          hint =
            " — auth required. Start the backend with DOPAFLOW_TRUST_LOCAL_CLIENTS=1 for local use.";
        }
        throw new Error(`${res.status} ${text.slice(0, 120)}${hint}`);
      }
      const blob = await res.blob();
      const filename = inferFilename(item, res);
      downloadBlob(blob, filename);
      setLastDownload(filename);
      showToast(`Download started: ${filename}`, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      setError(message);
      showToast("Export failed.", "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <section
      style={{
        padding: "1.25rem",
        borderRadius: "16px",
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "1rem",
      }}
    >
      <strong>Export data</strong>

      <div style={{ display: "grid", gap: "0.6rem" }}>
        {EXPORTS.map((item) => (
          <div
            key={item.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "0.75rem",
              alignItems: "center",
              padding: "0.75rem 1rem",
              borderRadius: "12px",
              background: "var(--surface-2, var(--surface))",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div>
              <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                {item.label}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                  marginTop: "0.15rem",
                }}
              >
                {item.description}
              </span>
            </div>
            <button
              onClick={() => void handleExport(item)}
              disabled={loading !== null}
              style={{
                padding: "0.4rem 0.9rem",
                borderRadius: "8px",
                border: "1px solid var(--accent)",
                background: "transparent",
                color: "var(--accent)",
                cursor: loading !== null ? "not-allowed" : "pointer",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                opacity: loading !== null && loading !== item.id ? 0.5 : 1,
                minWidth: "80px",
              }}
            >
              {loading === item.id ? "…" : "Download"}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-sm)",
            color: "var(--state-overdue)",
          }}
        >
          {error}
        </p>
      )}
      {lastDownload && (
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
          }}
        >
          Download started for <strong>{lastDownload}</strong>. Check your
          browser's downloads bar or your default Downloads folder.
        </p>
      )}
    </section>
  );
}

import { useState } from "react";
import type { JSX } from "react";

import { pushDailyTasksSection } from "@api/index";

import { cardStyle, labelStyle, smBtn } from "./VaultSettingsShared";

export function VaultDailyTaskSection({ disabled }: { disabled: boolean }): JSX.Element {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const push = (): void => {
    setBusy(true);
    setMsg(null);
    void pushDailyTasksSection(date)
      .then((response) => {
        setMsg(response.errors.length ? `Error: ${response.errors[0]}` : `Task section pushed to ${date}.`);
        setBusy(false);
      })
      .catch((error: unknown) => {
        setMsg(`Failed: ${error instanceof Error ? error.message : "unknown"}`);
        setBusy(false);
      });
  };

  return (
    <div style={cardStyle}>
      <span style={labelStyle}>Daily task section</span>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
        Injects a bounded task list into a daily note without touching your other content.
      </span>
      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          disabled={disabled || busy}
          style={{
            padding: "0.35rem 0.6rem",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text-primary)",
            fontSize: "var(--text-sm)",
          }}
        />
        {smBtn(push, busy ? "Working…" : "Push section", true, disabled || busy || !date)}
      </div>
      {msg && (
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{msg}</span>
      )}
    </div>
  );
}

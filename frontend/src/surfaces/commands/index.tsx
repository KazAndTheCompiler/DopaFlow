import { useEffect, useMemo, useState } from "react";

import { executeCommandText, getCommandList, type CommandListItem } from "@api/index";
import { showToast } from "@ds/primitives/Toast";
import VoiceCommandModal from "../../components/VoiceCommandModal";
import { getPackyMomentum, getPackyWhisper } from "@api/index";

export default function CommandsView(): JSX.Element {
  const [search, setSearch] = useState("");
  const [commands, setCommands] = useState<CommandListItem[]>([]);

  useEffect(() => {
    void getCommandList()
      .then((body) => setCommands(Array.isArray(body.commands) ? body.commands : []))
      .catch(() => setCommands([]));
  }, []);

  const filtered = useMemo(
    () =>
      search
        ? commands.filter(
            (command) =>
              command.name.toLowerCase().includes(search.toLowerCase()) ||
              command.description.toLowerCase().includes(search.toLowerCase()),
          )
        : commands,
    [search, commands],
  );

  const handleExecute = (text: string): void => {
    void executeCommandText(text, true, "text")
      .then(async (result) => {
        const reply = typeof result.reply === "string" ? result.reply.trim() : "";
        showToast(reply || "Command completed.", "success");
        await Promise.all([getPackyWhisper(), getPackyMomentum()].map((p) => p.catch(() => null)));
      })
      .catch(() => {
        showToast("Command failed. Check the server is running.", "error");
      });
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: "0.2rem" }}>
          <strong style={{ fontSize: "var(--text-lg)" }}>Command Center</strong>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            Natural language works here now. Prefixes still work, but they are no longer required.
          </span>
        </div>
        <VoiceCommandModal route="commands" />
      </div>
      <input
        type="text"
        placeholder="Search commands..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        style={{
          padding: "0.75rem 1rem",
          borderRadius: "12px",
          border: "1px solid var(--border-subtle)",
          background: "var(--surface)",
          color: "var(--text-primary)",
          fontSize: "1rem",
        }}
      />

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {filtered.length === 0 ? (
          <div style={{ color: "var(--text-secondary)", textAlign: "center", padding: "2rem" }}>No commands found.</div>
        ) : (
          filtered.map((command) => (
            <article
              key={command.id}
              style={{
                padding: "1rem",
                borderRadius: "12px",
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.borderColor = "var(--accent)";
                event.currentTarget.style.background = "var(--surface-2)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.borderColor = "var(--border-subtle)";
                event.currentTarget.style.background = "var(--surface)";
              }}
              onClick={() => handleExecute(command.text)}
            >
              <strong>{command.name}</strong>
              {command.category && (
                <span style={{ marginLeft: "0.5rem", fontSize: "var(--text-sm)", color: "var(--accent)" }}>[{command.category}]</span>
              )}
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "0.25rem" }}>{command.description}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import type { CSSProperties } from "react";

import type { Alarm } from "../../../../shared/types";

interface AlarmFormProps {
  onCreate: (alarm: Partial<Alarm>) => Promise<void>;
}

const KINDS: Array<"standard" | "tts" | "youtube"> = [
  "tts",
  "youtube",
  "standard",
];

const inputStyle: CSSProperties = {
  padding: "0.4rem 0.65rem",
  borderRadius: "8px",
  border: "1px solid var(--border-subtle)",
  background: "var(--surface-2)",
  color: "var(--text-primary)",
  fontSize: "var(--text-base)",
  width: "100%",
};

const labelStyle: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--text-secondary)",
  marginBottom: "0.2rem",
  display: "block",
};

export function AlarmForm({ onCreate }: AlarmFormProps): JSX.Element {
  const [title, setTitle] = useState<string>("");
  const [at, setAt] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return d.toISOString().slice(0, 16);
  });
  const [kind, setKind] = useState<"standard" | "tts" | "youtube">("tts");
  const [tts_text, setTtsText] = useState<string>("");
  const [youtube_link, setYoutubeLink] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  const handleAdd = async (): Promise<void> => {
    if (!title.trim() || !at) {
      return;
    }
    setBusy(true);
    try {
      await onCreate({
        title: title.trim(),
        at: new Date(at).toISOString(),
        kind,
        tts_text: kind === "tts" && tts_text.trim() ? tts_text.trim() : null,
        youtube_link:
          kind === "youtube" && youtube_link.trim()
            ? youtube_link.trim()
            : null,
      });
      setTitle("");
      setTtsText("");
      setYoutubeLink("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      style={{
        padding: "1rem 1.25rem",
        background: "var(--surface)",
        borderRadius: "18px",
        border: "1px solid var(--border-subtle)",
        display: "flex",
        gap: "0.65rem",
        flexWrap: "wrap",
        alignItems: "flex-end",
      }}
    >
      <div style={{ flex: "1 1 180px", display: "grid", gap: "0.25rem" }}>
        <label style={labelStyle}>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
          placeholder="Alarm label"
          style={inputStyle}
        />
      </div>

      <div style={{ display: "grid", gap: "0.25rem" }}>
        <label style={labelStyle}>Date &amp; time</label>
        <input
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ display: "grid", gap: "0.25rem" }}>
        <label style={labelStyle}>Kind</label>
        <select
          value={kind}
          onChange={(e) =>
            setKind(e.target.value as "standard" | "tts" | "youtube")
          }
          style={inputStyle}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      {kind === "tts" && (
        <div style={{ flex: "1 1 200px", display: "grid", gap: "0.25rem" }}>
          <label style={labelStyle}>TTS text</label>
          <input
            value={tts_text}
            onChange={(e) => setTtsText(e.target.value)}
            placeholder="Words to speak (optional)"
            style={inputStyle}
          />
        </div>
      )}

      {kind === "youtube" && (
        <div style={{ flex: "1 1 200px", display: "grid", gap: "0.25rem" }}>
          <label style={labelStyle}>YouTube link</label>
          <input
            value={youtube_link}
            onChange={(e) => setYoutubeLink(e.target.value)}
            placeholder="https://youtube.com/..."
            style={inputStyle}
          />
        </div>
      )}

      <button
        onClick={() => void handleAdd()}
        disabled={!title.trim() || !at || busy}
        style={{
          padding: "0.45rem 1.1rem",
          borderRadius: "8px",
          border: "none",
          background:
            title.trim() && at ? "var(--accent)" : "var(--border-subtle)",
          color: "var(--text-inverted)",
          cursor: title.trim() && at ? "pointer" : "not-allowed",
          fontWeight: 600,
          alignSelf: "flex-end",
          whiteSpace: "nowrap",
        }}
      >
        {busy ? "…" : "Schedule"}
      </button>
    </section>
  );
}

export default AlarmForm;

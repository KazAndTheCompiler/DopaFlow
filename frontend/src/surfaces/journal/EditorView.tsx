import { useCallback, useEffect, useRef, useState } from "react";

import type { JournalEntry } from "../../../../shared/types";
import VoiceDictation from "../../components/VoiceDictation";
import VoiceCommandModal from "../../components/VoiceCommandModal";
import WikiRenderer from "./WikiRenderer";

const AUTOSAVE_DELAY_MS = 1200;

interface EditorViewProps {
  entry?: JournalEntry | undefined;
  entries: JournalEntry[];
  selectedDate: string;
  onSave: (payload: Partial<JournalEntry>) => Promise<JournalEntry>;
  onNavigateDate?: (date: string) => void;
  onVoiceExecuted?: () => void;
}

function tagPills(tags: string[]): JSX.Element {
  return (
    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            padding: "0.2rem 0.55rem",
            borderRadius: "999px",
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            fontSize: "var(--text-sm)",
          }}
        >
          #{tag}
        </span>
      ))}
    </div>
  );
}

export function EditorView({ entry, entries, selectedDate, onSave, onNavigateDate, onVoiceExecuted }: EditorViewProps): JSX.Element {
  const [body, setBody] = useState<string>(entry?.markdown_body ?? "");
  const [emoji, setEmoji] = useState<string>(entry?.emoji ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [preview, setPreview] = useState(false);
  const [wikilinkQuery, setWikilinkQuery] = useState<string | null>(null);
  const [caretPos, setCaretPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setBody(entry?.markdown_body ?? "");
    setEmoji(entry?.emoji ?? "");
    setStatus("idle");
  }, [entry?.id, selectedDate]);

  const scheduleAutosave = useCallback(
    (nextBody: string, nextEmoji: string): void => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setStatus("saving");
        const tags = (nextBody.match(/#(\w+)/g) ?? []).map((t) => t.slice(1));
        void onSave({ date: selectedDate, markdown_body: nextBody, emoji: nextEmoji || null, tags }).then(() => {
          setStatus("saved");
          setTimeout(() => setStatus("idle"), 1500);
        });
      }, AUTOSAVE_DELAY_MS);
    },
    [selectedDate, onSave],
  );

  const handleBodyChange = (value: string): void => {
    setBody(value);
    scheduleAutosave(value, emoji);
    setStatus("idle");
  };

  const tags = (body.match(/#(\w+)/g) ?? []).map((t) => t.slice(1));
  const suggestions = wikilinkQuery !== null
    ? entries
      .filter((journalEntry) => {
        const preview = journalEntry.markdown_body.slice(0, 40).toLowerCase();
        return journalEntry.date.includes(wikilinkQuery) || preview.includes(wikilinkQuery.toLowerCase());
      })
      .slice(0, 6)
    : [];

  const insertSuggestion = (entryDate: string): void => {
    const match = body.match(/\[\[([^\]]{0,20})$/);
    if (!match) {
      return;
    }
    const nextBody = body.replace(/\[\[([^\]]{0,20})$/, `[[${entryDate}]]`);
    setBody(nextBody);
    setWikilinkQuery(null);
    scheduleAutosave(nextBody, emoji);
  };

  return (
    <section
      style={{
        display: "grid",
        gap: "0.75rem",
        padding: "1.25rem",
        background: "var(--surface)",
        borderRadius: "18px",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <input
          type="text"
          value={emoji}
          maxLength={2}
          placeholder="😶"
          aria-label="Entry emoji"
          onChange={(e) => {
            setEmoji(e.target.value);
            scheduleAutosave(body, e.target.value);
          }}
          style={{
            width: "2.75rem",
            fontSize: "1.4rem",
            textAlign: "center",
            background: "var(--surface-2)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "10px",
            padding: "0.3rem",
          }}
        />
        <strong style={{ fontSize: "var(--text-lg)" }}>{selectedDate}</strong>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              opacity: status === "idle" ? 0 : 1,
              transition: "opacity 0.3s",
            }}
          >
            {status === "saving" ? "Saving…" : "Saved"}
          </span>
          <button
            onClick={() => setPreview((v) => !v)}
            style={{
              padding: "0.25rem 0.65rem",
              borderRadius: "7px",
              border: "1px solid var(--border)",
              background: preview ? "var(--accent)" : "transparent",
              color: preview ? "var(--text-inverted)" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
            }}
          >
            {preview ? "Edit" : "Preview"}
          </button>
        </div>
      </div>

      <VoiceDictation
        onTranscript={(text) => {
          const nextBody = body + (body ? "\n" : "") + text;
          setBody(nextBody);
          scheduleAutosave(nextBody, emoji);
        }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <VoiceCommandModal
          initialCommandWord="journal"
          route="journal"
          {...(onVoiceExecuted ? { onExecuted: onVoiceExecuted } : {})}
        />
      </div>

      {preview ? (
        <div
          style={{
            minHeight: "280px",
            padding: "0.75rem",
            background: "var(--surface-2)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "10px",
          }}
        >
          <WikiRenderer body={body} onWikiClick={(date) => onNavigateDate?.(date)} />
        </div>
      ) : (
        <textarea
          spellCheck={false}
          value={body}
          onChange={(e) => {
            const value = e.target.value;
            handleBodyChange(value);
            const cursor = e.currentTarget.selectionStart ?? 0;
            const before = value.slice(0, cursor);
            const match = before.match(/\[\[([^\]]{0,20})$/);
            if (match) {
              setWikilinkQuery(match[1]);
              const rect = e.currentTarget.getBoundingClientRect();
              setCaretPos({ top: rect.bottom + 4, left: rect.left + 8 });
            } else {
              setWikilinkQuery(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setWikilinkQuery(null);
            }
          }}
          placeholder={`Write anything about ${selectedDate}. Use [[YYYY-MM-DD]] to link entries.`}
          style={{
            minHeight: "280px",
            width: "100%",
            resize: "vertical",
            padding: "0.75rem",
            background: "var(--surface-2)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "10px",
            fontFamily: "inherit",
            fontSize: "var(--text-base)",
            color: "var(--text-primary)",
            lineHeight: 1.65,
          }}
        />
      )}

      {suggestions.length > 0 ? (
        <ul
          style={{
            position: "fixed",
            top: caretPos.top,
            left: caretPos.left,
            zIndex: 300,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "0.25rem 0",
            listStyle: "none",
            margin: 0,
            boxShadow: "0 12px 24px rgba(0, 0, 0, 0.14)",
          }}
        >
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.id}
              onClick={() => insertSuggestion(suggestion.date)}
              style={{
                padding: "0.4rem 0.75rem",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
              }}
            >
              {suggestion.date} {suggestion.markdown_body.slice(0, 36)}
            </li>
          ))}
        </ul>
      ) : null}

      {tags.length > 0 && tagPills(tags)}

      {entry && (
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          Version {entry.version} · {entry.id}
        </span>
      )}
    </section>
  );
}

export default EditorView;

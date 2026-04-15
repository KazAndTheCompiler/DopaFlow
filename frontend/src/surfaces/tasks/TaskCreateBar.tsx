import { useEffect, useRef, useState } from 'react';

import Button from '@ds/primitives/Button';
import VoiceButton from '@ds/primitives/VoiceButton';
import { quickAddTask } from '@api/index';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

export interface TaskCreateBarProps {
  onCreate: (text: string) => Promise<void>;
}

interface ParsePreview {
  title?: string;
  due_at?: string | null;
  priority?: number;
  tags?: string[];
}

export function TaskCreateBar({ onCreate }: TaskCreateBarProps): JSX.Element {
  const [value, setValue] = useState<string>('');
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { listening, transcript, interim, start, stop, supported, reset } = useSpeechRecognition();

  // Final transcript → fill input
  useEffect(() => {
    if (transcript) {
      setValue(transcript);
      reset();
    }
  }, [transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for focus event from keyboard shortcuts
  useEffect(() => {
    const handleFocusEvent = (): void => {
      inputRef.current?.focus();
    };
    document.addEventListener('focus-task-create', handleFocusEvent);
    return () => document.removeEventListener('focus-task-create', handleFocusEvent);
  }, []);

  // Debounced NL parse preview
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    const text = value.trim();
    if (text.length < 4) {
      setPreview(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void quickAddTask({ text })
        .then((parsed) => setPreview(parsed as ParsePreview))
        .catch(() => setPreview(null));
    }, 400);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value]);

  const handleAdd = (): void => {
    const text = value.trim();
    if (!text) {
      return;
    }
    void onCreate(text);
    setValue('');
    setPreview(null);
    reset();
  };

  const formatDue = (due: string): string => {
    const d = new Date(due);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) {
      return 'today';
    }
    if (d.toDateString() === tomorrow.toDateString()) {
      return 'tomorrow';
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const chipStyle = (color: string): React.CSSProperties => ({
    fontSize: '0.7rem',
    fontWeight: 600,
    padding: '1px 7px',
    borderRadius: '999px',
    background: `${color}20`,
    color,
    whiteSpace: 'nowrap' as const,
  });

  return (
    <section
      style={{
        display: 'grid',
        gap: '0.6rem',
        padding: '0.95rem 1rem',
        borderRadius: '20px',
        background:
          'linear-gradient(155deg, color-mix(in srgb, var(--surface) 86%, white 14%), var(--surface))',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div style={{ display: 'grid', gap: '0.22rem' }}>
        <strong style={{ fontSize: 'var(--text-base)' }}>Quick capture</strong>
        <span
          style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}
        >
          Type a plain sentence or speak it. Natural-language parsing should reduce cleanup work,
          not create another form to fill out.
        </span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          ref={inputRef}
          value={listening ? interim || value : value}
          onChange={(event) => setValue(event.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={listening ? 'Listening…' : 'Quick add — type or speak'}
          style={{
            flex: 1,
            width: '100%',
            padding: '0.6rem 0.85rem',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            outline: 'none',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
          }}
        />
        <VoiceButton
          listening={listening}
          supported={supported}
          onToggle={() => (listening ? stop() : start())}
          size="sm"
          title="Speak a task"
        />
        <Button onClick={handleAdd} disabled={!value.trim() && !listening}>
          Add
        </Button>
      </div>

      {preview &&
        (preview.due_at ||
          (preview.priority && preview.priority !== 3) ||
          (preview.tags && preview.tags.length > 0)) && (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', paddingLeft: '0.1rem' }}>
            {preview.due_at && (
              <span style={chipStyle('var(--accent)')}>DT {formatDue(preview.due_at)}</span>
            )}
            {preview.priority !== undefined && preview.priority !== 3 && (
              <span
                style={chipStyle(
                  preview.priority <= 2 ? 'var(--state-overdue)' : 'var(--state-warn)',
                )}
              >
                P{preview.priority}
              </span>
            )}
            {preview.tags?.map((tag) => (
              <span key={tag} style={chipStyle('var(--text-secondary)')}>
                # {tag}
              </span>
            ))}
          </div>
        )}
    </section>
  );
}

export default TaskCreateBar;

import { useEffect, useMemo, useRef, useState } from 'react';

import Input from '@ds/primitives/Input';
import Button from '@ds/primitives/Button';
import { Skeleton } from '@ds/primitives/Skeleton';
import type { Habit, Task } from '@shared/types';
import { useAppHabits, useAppTasks } from '../../app/AppContexts';
import TaskEditModal from '../tasks/TaskEditModal';
import { apiClient } from '../../api/client';

interface JournalSearchResult {
  id: string;
  date: string;
  snippet: string;
  emoji?: string | null;
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  padding: '0.6rem 0.75rem 0.25rem',
};

const RESULT_BTN: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.65rem',
  width: '100%',
  padding: '0.65rem 0.75rem',
  borderRadius: '10px',
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 100ms ease',
};

type ResultType = 'task' | 'habit' | 'journal';
interface FlatResult {
  type: ResultType;
  id: string;
  title: string;
  sub?: string;
  icon?: string;
  data?: Task | Habit | JournalSearchResult;
}

export default function SearchView(): JSX.Element {
  const tasks = useAppTasks();
  const habits = useAppHabits();
  const [query, setQuery] = useState('');
  const [journalResults, setJournalResults] = useState<JournalSearchResult[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const q = query.toLowerCase().trim();

  const taskResults: Task[] = q
    ? tasks.tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          t.description?.toLowerCase().includes(q),
      )
    : [];

  const habitResults: Habit[] = q
    ? habits.habits.filter((h) => h.name.toLowerCase().includes(q))
    : [];

  useEffect(() => {
    if (!q) {
      setJournalResults([]);
      setJournalLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setJournalLoading(true);
      void apiClient<JournalSearchResult[]>(`/journal/search?q=${encodeURIComponent(query)}`)
        .then((results) => {
          if (active) {
            setJournalResults(results);
          }
        })
        .catch(() => {
          if (active) {
            setJournalResults([]);
          }
        })
        .finally(() => {
          if (active) {
            setJournalLoading(false);
          }
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [q, query]);

  // Flat list for keyboard nav
  const flat: FlatResult[] = useMemo(
    () => [
      ...taskResults.slice(0, 8).map(
        (t): FlatResult => ({
          type: 'task',
          id: t.id,
          title: t.title,
          sub: t.due_at
            ? new Date(t.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : t.status,
          icon: t.done ? 'OK' : t.priority === 1 ? 'P1' : t.priority === 2 ? 'P2' : 'TS',
          data: t,
        }),
      ),
      ...habitResults.slice(0, 4).map(
        (h): FlatResult => ({
          type: 'habit',
          id: h.id,
          title: h.name,
          sub: `ST ${h.current_streak}d`,
          icon: 'HB',
        }),
      ),
      ...journalResults.slice(0, 6).map(
        (e): FlatResult => ({
          type: 'journal',
          id: e.id,
          title: new Date(e.date).toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
          sub: e.snippet,
          icon: e.emoji ?? 'JR',
        }),
      ),
    ],
    [habitResults, journalResults, taskResults],
  );

  const handleSelect = (result: FlatResult): void => {
    if (result.type === 'task' && result.data) {
      setEditingTask(result.data as Task);
    } else if (result.type === 'habit') {
      window.location.hash = '#/habits';
    } else {
      window.location.hash = '#/journal';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flat[focusedIdx]) {
      handleSelect(flat[focusedIdx]);
    }
  };

  const sections: Array<{ type: ResultType; label: string; items: FlatResult[] }> = (
    [
      {
        type: 'task' as ResultType,
        label: `Tasks (${taskResults.length})`,
        items: flat.filter((f) => f.type === 'task'),
      },
      {
        type: 'habit' as ResultType,
        label: `Habits (${habitResults.length})`,
        items: flat.filter((f) => f.type === 'habit'),
      },
      {
        type: 'journal' as ResultType,
        label: `Journal (${journalResults.length})`,
        items: flat.filter((f) => f.type === 'journal'),
      },
    ] as Array<{ type: ResultType; label: string; items: FlatResult[] }>
  ).filter((s) => s.items.length > 0);

  const globalIdx = (result: FlatResult): number => flat.indexOf(result);

  return (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: '680px', margin: '0 auto' }}>
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search tasks, habits, journal… ↑↓ to navigate, Enter to open"
        value={query}
        onChange={(e) => {
          setQuery(e.currentTarget.value);
          setFocusedIdx(0);
        }}
        onKeyDown={handleKeyDown}
        style={{ fontSize: '1.05rem', padding: '0.875rem 1rem' }}
      />

      {!q ? (
        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div
            style={{
              fontSize: '0.95rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: 'var(--accent)',
              marginBottom: '0.65rem',
            }}
          >
            SR
          </div>
          <div style={{ fontSize: 'var(--text-sm)' }}>
            Search across tasks, habits, and journal entries
          </div>
          <div
            style={{
              marginTop: '0.75rem',
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {['#work', '#health', 'today', 'focus'].map((hint) => (
              <Button
                key={hint}
                onClick={() => setQuery(hint.replace('#', ''))}
                variant="ghost"
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '999px',
                  fontSize: 'var(--text-xs)',
                }}
              >
                {hint}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: '16px',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
          }}
        >
          {sections.length === 0 && !journalLoading && (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
              }}
            >
              No results for "{query}"
            </div>
          )}
          {journalLoading && sections.length === 0 && (
            <div style={{ padding: '0.85rem 0.9rem', display: 'grid', gap: '0.75rem' }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                    padding: '0.4rem 0',
                  }}
                >
                  <Skeleton width="20px" height="20px" borderRadius="6px" />
                  <div style={{ flex: 1, display: 'grid', gap: '0.25rem' }}>
                    <Skeleton width={index % 2 === 0 ? '46%' : '58%'} height="14px" />
                    <Skeleton width="72%" height="11px" />
                  </div>
                  <Skeleton width="52px" height="18px" borderRadius="6px" />
                </div>
              ))}
            </div>
          )}
          {sections.map(({ type, label, items }, si) => (
            <div
              key={type}
              style={{ borderTop: si > 0 ? '1px solid var(--border-subtle)' : 'none' }}
            >
              <div style={SECTION_LABEL}>{label}</div>
              {items.map((result) => {
                const idx = globalIdx(result);
                const focused = idx === focusedIdx;
                return (
                  <button
                    key={result.id}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setFocusedIdx(idx)}
                    style={{
                      ...RESULT_BTN,
                      background: focused ? 'var(--surface-2)' : 'transparent',
                    }}
                  >
                    <span
                      style={{
                        width: '20px',
                        textAlign: 'center',
                        flexShrink: 0,
                        fontSize: '0.9rem',
                        marginTop: '1px',
                      }}
                    >
                      {result.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {result.title}
                      </div>
                      {result.sub && (
                        <div
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: '1px',
                          }}
                        >
                          {result.sub}
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {result.type}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <TaskEditModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={async (id, patch) => {
          await tasks.update(id, patch);
        }}
        onDelete={async (id) => {
          await tasks.remove(id);
        }}
      />
    </div>
  );
}

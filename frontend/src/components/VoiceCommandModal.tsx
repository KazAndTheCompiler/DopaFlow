import { useCallback, useEffect, useRef, useState } from 'react';

import { sendVoiceCommand, type PackyVoiceResponse } from '@api/index';
import { showToast } from '@ds/primitives/Toast';
import { Modal } from '@ds/primitives/Modal';
import Button from '@ds/primitives/Button';
import { useMicrophone } from '@hooks/useMicrophone';
import { useTTS } from '@hooks/useTTS';
import { useSpeechRecognition } from '@hooks/useSpeechRecognition';
import { JarvisOverlay } from './JarvisOverlay';

// ---------------------------------------------------------------------------
// Intent metadata
// ---------------------------------------------------------------------------

const INTENT_META: Record<string, { icon: string; label: string; color: string }> = {
  'task.create': { icon: '✅', label: 'New Task', color: 'var(--accent-primary)' },
  'task.complete': { icon: '✔️', label: 'Task Completed', color: 'var(--state-ok)' },
  'task.list': { icon: '📋', label: 'Task List', color: 'var(--accent-primary)' },
  'journal.create': { icon: '📝', label: 'Journal', color: 'var(--accent-secondary)' },
  'calendar.create': { icon: '📅', label: 'Event', color: 'var(--accent-tertiary)' },
  'focus.start': { icon: '🎯', label: 'Focus', color: 'var(--state-warn)' },
  'alarm.create': { icon: '⏰', label: 'Alarm', color: 'var(--accent-primary)' },
  'habit.checkin': { icon: '🔥', label: 'Habit', color: 'var(--state-ok)' },
  'habit.list': { icon: '📊', label: 'Habits', color: 'var(--accent-primary)' },
  'review.start': { icon: '🃏', label: 'Review', color: 'var(--accent-secondary)' },
  search: { icon: '🔍', label: 'Search', color: 'var(--text-secondary)' },
  'nutrition.log': { icon: '🍎', label: 'Food Log', color: 'var(--accent-tertiary)' },
  compound: { icon: '⚡', label: 'Multiple Actions', color: 'var(--accent-primary)' },
  greeting: { icon: '👋', label: 'Hello', color: 'var(--text-secondary)' },
  help: { icon: '❓', label: 'Help', color: 'var(--text-secondary)' },
  undo: { icon: '↩️', label: 'Undo', color: 'var(--state-warn)' },
};

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'High', color: 'var(--state-overdue)' },
  2: { label: 'Normal', color: 'var(--text-secondary)' },
  3: { label: 'Low', color: 'var(--text-tertiary)' },
  4: { label: 'Backlog', color: 'var(--text-muted)' },
};

const ROUTE_SUGGESTIONS: Record<string, Record<string, string[]>> = {
  tasks: {
    'task.create': ["View today's tasks?", 'Start focus?'],
    'task.list': ['Add a new task?', 'Start focus?'],
  },
  habits: {
    'habit.checkin': ['Start a focus block?', "Check tomorrow's habits?"],
    'habit.list': ['Check in a habit?', "View today's tasks?"],
  },
  focus: {
    'focus.start': ['Log what you accomplished?', 'Check your habits?'],
  },
  journal: {
    'journal.create': ['Review your streak?', "Check today's tasks?"],
  },
  calendar: {
    'calendar.create': ['Check your task list?', 'Block focus time?'],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEntityValue(key: string, value: unknown): string {
  if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
    return '';
  }
  if (key === 'priority' && typeof value === 'number') {
    return PRIORITY_LABELS[value]?.label ?? String(value);
  }
  if ((key === 'rrule' || key === 'recurrence_rule') && typeof value === 'string') {
    if (value.includes('DAILY')) {
      return 'Repeats daily';
    }
    if (value.includes('WEEKLY') && value.includes('BYDAY')) {
      return `Repeats weekly (${value.split('BYDAY=')[1]})`;
    }
    if (value.includes('WEEKLY')) {
      return 'Repeats weekly';
    }
    if (value.includes('MONTHLY')) {
      return 'Repeats monthly';
    }
    if (value.includes('YEARLY')) {
      return 'Repeats yearly';
    }
    return `Recurring (${value})`;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (key === 'estimated_minutes' && typeof value === 'number') {
    return `~${value}min`;
  }
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }
  return String(value);
}

function shouldShowEntity(key: string, value: unknown): boolean {
  if (value === null || value === undefined || value === '' || value === false) {
    return false;
  }
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  // Skip internal/technical keys
  if (key === 'date' && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface VoiceCommandModalProps {
  initialCommandWord?: 'task' | 'journal' | 'calendar';
  onExecuted?: () => void;
  /** If true, render inline without a modal wrapper. */
  inline?: boolean;
  /** Current app route, passed as context to the voice pipeline for route-aware responses. */
  route?: string;
}

type PreviewPayload = {
  would_execute?: boolean;
  status?: string;
  message?: string;
  options?: Array<Record<string, unknown>>;
  parts?: Array<{ text?: string; intent?: string }>;
};

export function VoiceCommandModal({
  initialCommandWord,
  onExecuted,
  inline,
  route,
}: VoiceCommandModalProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<
    'idle' | 'listening' | 'processing' | 'preview' | 'executing' | 'done'
  >('idle');
  const [response, setResponse] = useState<PackyVoiceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [continuousMode, setContinuousMode] = useState(false);
  const [commandHistory, setCommandHistory] = useState<PackyVoiceResponse[]>([]);

  const {
    supported: sttSupported,
    listening,
    transcript,
    interim,
    error: sttError,
    start,
    stop,
    reset,
  } = useSpeechRecognition();
  const { start: startMicrophone, stop: stopMicrophone, error: microphoneError } = useMicrophone();
  const { speak, speaking } = useTTS();
  const processingRef = useRef(false);
  const lastTranscriptRef = useRef('');
  const followUpTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const transcriptText = typeof transcript === 'string' ? transcript : '';
  const interimText = typeof interim === 'string' ? interim : '';
  const preview = (response?.preview ?? {}) as PreviewPayload;

  // -----------------------------------------------------------------------
  // Process transcript → send to Packy
  // -----------------------------------------------------------------------

  const processTranscript = useCallback(
    async (text: string) => {
      if (processingRef.current || !text.trim()) {
        return;
      }
      processingRef.current = true;
      setPhase('processing');
      setError(null);

      try {
        const context = route ? { route } : undefined;
        const res = await sendVoiceCommand(text, context, false);
        setResponse(res);
        setPhase('preview');

        // Auto-execute non-actionable intents
        if (res.intent === 'greeting' || res.intent === 'help') {
          if (res.tts_text) {
            speak(res.tts_text);
          }
          if (continuousMode) {
            scheduleFollowUpRelisten(res);
          }
        } else if (res.tts_text && res.status === 'ok') {
          speak(res.tts_text);
        }
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : 'Voice command failed');
        setPhase('idle');
      } finally {
        processingRef.current = false;
      }
    },
    [speak, continuousMode, route],
  );

  // When speech recognition produces a final transcript, process it
  useEffect(() => {
    if (transcriptText && transcriptText !== lastTranscriptRef.current && !listening) {
      lastTranscriptRef.current = transcriptText;
      void processTranscript(transcriptText);
    }
  }, [transcriptText, listening, processTranscript]);

  useEffect(() => {
    if (!sttError) {
      return;
    }
    setError(sttError);
    setPhase('idle');
  }, [sttError]);

  useEffect(() => {
    if (!microphoneError) {
      return;
    }
    setError(microphoneError);
    setPhase('idle');
  }, [microphoneError]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (followUpTimeoutRef.current) {
        clearTimeout(followUpTimeoutRef.current);
      }
    };
  }, []);

  // -----------------------------------------------------------------------
  // Execute confirmed command
  // -----------------------------------------------------------------------

  const handleExecute = async (): Promise<void> => {
    if (!transcriptText) {
      return;
    }
    setPhase('executing');
    setError(null);

    try {
      const context = route ? { route } : undefined;
      const res = await sendVoiceCommand(transcriptText, context, true);
      setResponse(res);
      setCommandHistory((prev) => [...prev, res]);
      setPhase('done');

      const rawReply = res.reply_text ?? res.execution_result?.reply ?? 'Done.';
      const reply = typeof rawReply === 'string' ? rawReply : JSON.stringify(rawReply);
      speak(reply);
      showToast(reply, res.status === 'executed' ? 'success' : 'warn');
      onExecuted?.();

      // In continuous mode, auto-relisten after speaking
      if (continuousMode) {
        scheduleFollowUpRelisten(res);
      }
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Execution failed');
      speak('Something went wrong. Try again?');
      setPhase('preview');
    }
  };

  // -----------------------------------------------------------------------
  // Continuous conversation
  // -----------------------------------------------------------------------

  const scheduleFollowUpRelisten = (res: PackyVoiceResponse): void => {
    if (followUpTimeoutRef.current) {
      clearTimeout(followUpTimeoutRef.current);
    }
    // Wait for TTS to finish (~2s per sentence), then re-listen
    const replyLen = (res.reply_text ?? res.tts_text ?? '').length;
    const delay = Math.min(Math.max(replyLen * 50, 1500), 5000);
    followUpTimeoutRef.current = setTimeout(() => {
      if (continuousMode && sttSupported) {
        void (async () => {
          const microphoneReady = await startMicrophone();
          if (!microphoneReady) {
            return;
          }
          stopMicrophone();
          reset();
          setResponse(null);
          setError(null);
          setPhase('listening');
          lastTranscriptRef.current = '';
          start();
        })();
      }
    }, delay);
  };

  // -----------------------------------------------------------------------
  // Follow-up relay
  // -----------------------------------------------------------------------

  const handleFollowUp = (text: string): void => {
    reset();
    lastTranscriptRef.current = '';
    void processTranscript(text);
  };

  // -----------------------------------------------------------------------
  // Start / stop listening
  // -----------------------------------------------------------------------

  const toggleListening = (): void => {
    if (listening) {
      stop();
      stopMicrophone();
      return;
    }
    void (async () => {
      const microphoneReady = await startMicrophone();
      if (!microphoneReady) {
        return;
      }
      stopMicrophone();
      reset();
      setResponse(null);
      setError(null);
      setPhase('listening');
      lastTranscriptRef.current = '';
      start();
    })();
  };

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  const handleClose = (): void => {
    if (listening) {
      stop();
    }
    stopMicrophone();
    if (followUpTimeoutRef.current) {
      clearTimeout(followUpTimeoutRef.current);
    }
    reset();
    setResponse(null);
    setError(null);
    setPhase('idle');
    setContinuousMode(false);
    setCommandHistory([]);
    setOpen(false);
    lastTranscriptRef.current = '';
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const meta = response ? INTENT_META[response.intent] : null;
  const canExecute =
    phase === 'preview' &&
    Boolean(response) &&
    preview.would_execute === true &&
    response?.status === 'ok';
  const canFollowUp = phase === 'done' && response?.follow_ups?.length;

  const renderPreview = (): JSX.Element | null => {
    if (!response) {
      return null;
    }

    const entities = response.entities ?? {};
    const showEntities = Object.entries(entities).filter(([k, v]) => shouldShowEntity(k, v));
    const previewOptions = Array.isArray(preview.options) ? preview.options : [];
    const compoundParts = Array.isArray(preview.parts) ? preview.parts : [];
    const compoundResults = Array.isArray(
      (response.execution_result as { results?: unknown } | null)?.results,
    )
      ? (response.execution_result as { results: PackyVoiceResponse[] }).results
      : [];

    return (
      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          padding: '1rem',
          borderRadius: '14px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-subtle)',
          animation: 'fadeIn 200ms ease',
        }}
      >
        {/* Intent badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{meta?.icon ?? '💬'}</span>
          <span
            style={{
              fontWeight: 700,
              fontSize: 'var(--text-sm)',
              color: meta?.color ?? 'var(--text-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {meta?.label ?? response.intent}
          </span>
          {response.confidence > 0 && (
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                marginLeft: 'auto',
              }}
            >
              {Math.round(response.confidence * 100)}%
            </span>
          )}
        </div>

        {/* Transcript */}
        <div>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-secondary)',
              marginBottom: '0.25rem',
            }}
          >
            Heard
          </div>
          <div style={{ fontWeight: 600 }}>{transcriptText}</div>
        </div>

        {/* Compound preview / results */}
        {compoundParts.length > 0 && (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {compoundParts.map((part, index) => {
              const partMeta = part.intent ? INTENT_META[part.intent] : null;
              return (
                <div
                  key={`${part.text ?? 'part'}-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.35rem 0.5rem',
                    borderRadius: '8px',
                    background: 'var(--surface-3)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <span>{partMeta?.icon ?? '•'}</span>
                  <span style={{ fontWeight: 600 }}>{part.text ?? part.intent ?? 'Action'}</span>
                  <span style={{ color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                    {part.intent ?? 'unknown'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {response.intent === 'compound' && compoundResults.length > 0 && (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {compoundResults.map((r, i) => {
              const rMeta = INTENT_META[r.intent];
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.35rem 0.5rem',
                    borderRadius: '8px',
                    background: 'var(--surface-3)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <span>{rMeta?.icon ?? '💬'}</span>
                  <span style={{ fontWeight: 600 }}>{rMeta?.label ?? r.intent}</span>
                  <span style={{ color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                    {r.status === 'executed' ? '✓' : r.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Entities — rich cards */}
        {showEntities.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {showEntities.map(([key, value]) => {
              const formatted = formatEntityValue(key, value);
              if (!formatted) {
                return null;
              }
              return (
                <span
                  key={key}
                  style={{
                    padding: '0.25rem 0.55rem',
                    borderRadius: '8px',
                    background:
                      key === 'rrule' || key === 'recurrence_rule'
                        ? 'var(--accent-primary)22'
                        : 'var(--surface-3)',
                    fontSize: 'var(--text-xs)',
                    color:
                      key === 'rrule' || key === 'recurrence_rule'
                        ? 'var(--accent-primary)'
                        : 'var(--text-secondary)',
                    fontWeight: key === 'rrule' || key === 'recurrence_rule' ? 600 : 400,
                    border:
                      key === 'rrule' || key === 'recurrence_rule'
                        ? '1px solid var(--accent-primary)44'
                        : 'none',
                  }}
                >
                  {key === 'rrule' || key === 'recurrence_rule'
                    ? formatted
                    : key === 'priority'
                      ? `⚡ ${formatted}`
                      : key === 'estimated_minutes'
                        ? `⏱ ${formatted}`
                        : key === 'due_at'
                          ? `📅 ${formatted}`
                          : `${key}: ${formatted}`}
                </span>
              );
            })}
          </div>
        )}

        {/* Needs datetime hint */}
        {response.status === 'needs_datetime' && (
          <div style={{ color: 'var(--state-warn)', fontSize: 'var(--text-sm)' }}>
            I need a date and time. Say something like &quot;tomorrow at 2pm&quot;.
          </div>
        )}
        {response.status === 'ambiguous' && (
          <div style={{ color: 'var(--state-warn)', fontSize: 'var(--text-sm)' }}>
            This matches more than one thing. Pick a more specific title before running it.
          </div>
        )}
        {response.status === 'not_found' && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            Nothing safe matched yet. Try the exact title or a simpler command.
          </div>
        )}
        {response.status === 'unsupported' && (
          <div style={{ color: 'var(--state-warn)', fontSize: 'var(--text-sm)' }}>
            This preview is blocked on purpose. Run one concrete action at a time.
          </div>
        )}
        {response.status === 'nothing_to_undo' && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            There is no pending supported action to undo.
          </div>
        )}

        {previewOptions.length > 0 && (
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {previewOptions.map((option, index) => (
              <div
                key={`${String(option.id ?? option.title ?? option.name ?? 'option')}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '8px',
                  background: 'var(--surface-3)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                <span style={{ color: 'var(--text-tertiary)' }}>{index + 1}.</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {String(option.title ?? option.name ?? option.id ?? 'Option')}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Reply */}
        {response.reply_text && (
          <div
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              background: 'var(--surface-3)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
              fontStyle: 'italic',
            }}
          >
            &quot;{response.reply_text}&quot;
          </div>
        )}
      </div>
    );
  };

  const renderFollowUps = (): JSX.Element | null => {
    if (!canFollowUp || !response) {
      return null;
    }
    const routeSug = route ? ROUTE_SUGGESTIONS[route]?.[response.intent] : undefined;
    const followUps: string[] = routeSug ?? response.follow_ups;
    return (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {followUps.map((fu: string) => (
          <button
            key={fu}
            onClick={() => handleFollowUp(fu)}
            style={{
              padding: '0.35rem 0.7rem',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-2)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
              transition: 'background 150ms, border-color 150ms',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = 'var(--surface-3)';
              (e.target as HTMLElement).style.borderColor = 'var(--accent-primary)44';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'var(--surface-2)';
              (e.target as HTMLElement).style.borderColor = 'var(--border-subtle)';
            }}
          >
            {fu}
          </button>
        ))}
      </div>
    );
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const content = (
    <>
      <JarvisOverlay visible={speaking} />
      <div style={{ display: 'grid', gap: '1rem' }}>
        {/* Instruction */}
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {initialCommandWord ? (
            <>
              Say a <strong>{initialCommandWord}</strong> command, like &quot;{initialCommandWord}{' '}
              buy milk tomorrow&quot;.
            </>
          ) : (
            <>
              Just speak naturally — no prefixes needed. Try &quot;buy milk every monday&quot;,
              &quot;start focus for 25 minutes&quot;, or &quot;calendar dentist tomorrow at 2pm for
              45 minutes&quot;.
            </>
          )}
        </p>

        {/* Continuous mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setContinuousMode((v) => !v)}
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: continuousMode ? 'var(--accent-primary)' : 'var(--border-subtle)',
              background: continuousMode ? 'var(--accent-primary)22' : 'transparent',
              color: continuousMode ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
              fontWeight: continuousMode ? 600 : 400,
            }}
          >
            {continuousMode ? '🎙 Continuous mode on' : '🎙 Continuous mode'}
          </button>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Auto-relisten after each response
          </span>
        </div>

        {/* Mic button + status */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            onClick={toggleListening}
            disabled={!sttSupported || phase === 'processing' || phase === 'executing'}
            variant={listening ? 'primary' : 'secondary'}
          >
            {listening ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    width: '0.6rem',
                    height: '0.6rem',
                    borderRadius: '50%',
                    background: 'var(--state-overdue)',
                    animation: 'pulse 1s ease-in-out infinite',
                    display: 'inline-block',
                  }}
                />
                Listening…
              </span>
            ) : phase === 'processing' ? (
              'Processing…'
            ) : phase === 'executing' ? (
              'Executing…'
            ) : (
              'Start Listening'
            )}
          </Button>
          {!sttSupported && (
            <span style={{ color: 'var(--state-warn)', fontSize: 'var(--text-sm)' }}>
              Speech recognition not supported in this browser.
            </span>
          )}
        </div>

        {/* Live transcript */}
        {(listening || Boolean(interimText)) && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              background: 'var(--surface-2)',
              border: listening
                ? '1px solid var(--state-overdue)'
                : '1px solid var(--border-subtle)',
              minHeight: '2.5rem',
              transition: 'border-color 200ms',
            }}
          >
            {Boolean(transcriptText) && <span style={{ fontWeight: 500 }}>{transcriptText}</span>}
            {Boolean(interimText) && (
              <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                {transcriptText ? ' ' : ''}
                {interimText}
              </span>
            )}
            {!transcriptText && !interimText && listening && (
              <span style={{ color: 'var(--text-tertiary)' }}>Say something…</span>
            )}
          </div>
        )}

        {/* Preview card */}
        {renderPreview()}

        {/* Error */}
        {error && (
          <span style={{ color: 'var(--state-overdue)', fontSize: 'var(--text-sm)' }}>{error}</span>
        )}

        {/* Follow-ups */}
        {renderFollowUps()}

        {/* Command history (continuous mode) */}
        {commandHistory.length > 0 && (
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '0.5rem',
            }}
          >
            {commandHistory.length} command{commandHistory.length > 1 ? 's' : ''} this session
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button onClick={handleClose} variant="secondary">
            {phase === 'done' ? 'Close' : 'Cancel'}
          </Button>
          {canExecute && (
            <Button onClick={() => void handleExecute()} variant="primary">
              Confirm & Run
            </Button>
          )}
          {phase === 'done' && (
            <Button
              onClick={() => {
                setPhase('idle');
                setResponse(null);
                reset();
                lastTranscriptRef.current = '';
                if (continuousMode) {
                  void (async () => {
                    const microphoneReady = await startMicrophone();
                    if (!microphoneReady) {
                      return;
                    }
                    stopMicrophone();
                    setPhase('listening');
                    start();
                  })();
                }
              }}
              variant="secondary"
            >
              {continuousMode ? 'Listen Again' : 'Another Command'}
            </Button>
          )}
        </div>
      </div>
    </>
  );

  // Inline mode: render without Modal wrapper
  if (inline) {
    return content;
  }

  return (
    <>
      <Button
        disabled={!sttSupported}
        onClick={() => {
          setOpen(true);
          reset();
          setResponse(null);
          setError(null);
          setPhase('idle');
        }}
        variant="secondary"
        style={{ width: 'fit-content' }}
      >
        Voice Command
      </Button>

      <Modal open={open} title="Voice Command" onClose={handleClose}>
        {content}
      </Modal>
    </>
  );
}

export default VoiceCommandModal;

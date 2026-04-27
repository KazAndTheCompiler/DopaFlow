import { useCallback, useEffect, useRef, useState } from "react";
import { getQueue, resolveUrl, saveQueue } from "@api/player";
import Button from "@ds/primitives/Button";
import type { QueueItem } from "@api/player";

const PRESETS = [
  { label: "Lo-fi beats", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk" },
  { label: "Deep focus", url: "https://www.youtube.com/watch?v=5qap5aO4i9A" },
  { label: "Rain sounds", url: "https://www.youtube.com/watch?v=mPZkdNFkNps" },
];

function fmtTime(seconds: number): string {
  if (!isFinite(seconds)) {
    return "0:00";
  }
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerView(): JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [urlInput, setUrlInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [nowPlaying, setNowPlaying] = useState<QueueItem | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  // Load saved queue on mount
  useEffect(() => {
    getQueue()
      .then((res) => setQueue(res.items))
      .catch(() => {});
  }, []);

  const persistQueue = useCallback((items: QueueItem[]) => {
    setQueue(items);
    void saveQueue(items).catch(() => {});
  }, []);

  const playItem = useCallback(async (item: QueueItem) => {
    setResolveError(null);
    let streamUrl = item.stream_url;
    if (!streamUrl) {
      setResolving(true);
      try {
        const res = await resolveUrl(item.url);
        if (res.error || !res.stream_url) {
          setResolveError(res.error ?? "Could not resolve URL");
          setResolving(false);
          return;
        }
        streamUrl = res.stream_url;
      } catch {
        setResolveError(
          "URL resolution failed. Check the stream is accessible.",
        );
        setResolving(false);
        return;
      }
      setResolving(false);
    }
    setNowPlaying({ ...item, stream_url: streamUrl });
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.src = streamUrl ?? "";
        void audioRef.current.play().catch(() => {});
      }
    }, 50);
  }, []);

  const addToQueue = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) {
      return;
    }
    const item: QueueItem = { url, title: titleInput.trim() || url };
    const next = [...queue, item];
    persistQueue(next);
    setUrlInput("");
    setTitleInput("");
    if (!nowPlaying) {
      await playItem(item);
    }
  }, [urlInput, titleInput, queue, nowPlaying, persistQueue, playItem]);

  const playNext = useCallback(async () => {
    if (queue.length === 0) {
      setNowPlaying(null);
      return;
    }
    const [next, ...rest] = queue;
    persistQueue(rest);
    await playItem(next);
  }, [queue, persistQueue, playItem]);

  const removeFromQueue = useCallback(
    (index: number) => {
      persistQueue(queue.filter((_, i) => i !== index));
    },
    [queue, persistQueue],
  );

  const togglePlay = () => {
    if (!audioRef.current) {
      return;
    }
    if (playing) {
      audioRef.current.pause();
    } else {
      void audioRef.current.play().catch(() => {});
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Number(e.currentTarget.value);
    }
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.currentTarget.value);
    setVolume(v);
    if (audioRef.current) {
      audioRef.current.volume = v;
    }
  };

  const card: React.CSSProperties = {
    padding: "1.25rem",
    borderRadius: "18px",
    background: "var(--surface)",
    border: "1px solid var(--border-subtle)",
    display: "grid",
    gap: "0.75rem",
  };

  const inputStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    borderRadius: "10px",
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-2)",
    color: "var(--text-primary)",
    fontSize: "var(--text-sm)",
    width: "100%",
  };

  return (
    <div
      style={{ display: "grid", gap: "1rem", maxWidth: 640, margin: "0 auto" }}
    >
      {/* Now playing */}
      <div style={{ ...card, gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "18px",
              display: "grid",
              placeItems: "center",
              background: "color-mix(in srgb, var(--accent) 10%, transparent)",
              color: "var(--accent)",
              fontSize: "0.82rem",
              fontWeight: 800,
              letterSpacing: "0.06em",
              flexShrink: 0,
            }}
          >
            PL
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: "1rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {resolving
                ? "Resolving…"
                : (nowPlaying?.title ?? "Nothing playing")}
            </div>
            {resolveError && (
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--state-overdue)",
                }}
              >
                {resolveError}
              </div>
            )}
          </div>
        </div>

        {nowPlaying && (
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <input
              type="range"
              min={0}
              max={duration || 1}
              value={currentTime}
              onChange={seek}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
              }}
            >
              <span>{fmtTime(currentTime)}</span>
              <span>{fmtTime(duration)}</span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={togglePlay}
            disabled={!nowPlaying || resolving}
            style={{
              background: playing ? "var(--accent)" : "var(--surface-2)",
              color: playing ? "var(--text-inverted)" : "var(--text-primary)",
              border: "none",
              borderRadius: "50%",
              width: 40,
              height: 40,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              fontSize: "0.72rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
          >
            {playing ? "PA" : "PL"}
          </button>
          <button
            onClick={() => void playNext()}
            disabled={queue.length === 0}
            style={{
              background: "var(--surface-2)",
              color: "var(--text-primary)",
              border: "none",
              borderRadius: "50%",
              width: 40,
              height: 40,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              fontSize: "0.72rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
          >
            NX
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              marginLeft: "auto",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                fontWeight: 800,
                letterSpacing: "0.04em",
              }}
            >
              VOL
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={changeVolume}
              style={{ width: 80, accentColor: "var(--accent)" }}
            />
          </div>
        </div>
      </div>

      {/* Add track */}
      <div style={card}>
        <strong
          style={{
            fontSize: "var(--text-sm)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--text-secondary)",
          }}
        >
          Add track
        </strong>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <input
            style={inputStyle}
            placeholder="YouTube or audio URL"
            value={urlInput}
            onChange={(e) => setUrlInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void addToQueue();
              }
            }}
          />
          <input
            style={inputStyle}
            placeholder="Title (optional)"
            value={titleInput}
            onChange={(e) => setTitleInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void addToQueue();
              }
            }}
          />
          <Button
            onClick={() => void addToQueue()}
            disabled={!urlInput.trim() || resolving}
            variant="primary"
            style={{ padding: "0.5rem 1rem" }}
          >
            {resolving ? "Resolving…" : "Add & play"}
          </Button>
        </div>

        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              onClick={() => {
                setUrlInput(preset.url);
                setTitleInput(preset.label);
              }}
              variant="secondary"
              style={{
                padding: "0.3rem 0.7rem",
                borderRadius: "999px",
                fontSize: "var(--text-xs)",
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div style={card}>
          <strong
            style={{
              fontSize: "var(--text-sm)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-secondary)",
            }}
          >
            Queue · {queue.length}
          </strong>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            {queue.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.4rem 0.5rem",
                  borderRadius: "8px",
                  background: "var(--surface-2)",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    fontSize: "var(--text-sm)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.title ?? item.url}
                </span>
                <button
                  onClick={() =>
                    void playItem(item).then(() => removeFromQueue(i))
                  }
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--accent)",
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                  }}
                  title="Play now"
                >
                  PL
                </button>
                <button
                  onClick={() => removeFromQueue(i)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                  }}
                  title="Remove"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => void playNext()}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)}
        onVolumeChange={() => setVolume(audioRef.current?.volume ?? 0.8)}
        style={{ display: "none" }}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';

/**
 * JARVIS-style concentric circle wave animation.
 * Shows as a floating overlay while Packy speaks (TTS).
 */

interface JarvisOverlayProps {
  visible: boolean;
}

export function JarvisOverlay({ visible }: JarvisOverlayProps): JSX.Element | null {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError(null);
      return;
    }
    setError(null);
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      })
      .catch((err: unknown) => {
        const name =
          err && typeof err === 'object' && 'name' in err
            ? String((err as { name?: unknown }).name ?? '')
            : '';
        if (name === 'NotAllowedError') {
          setError('Microphone access denied — check browser permissions.');
        }
      });
  }, [visible]);

  if (!visible) {
    return null;
  }

  const rings = [0, 1, 2, 3, 4];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        pointerEvents: 'none',
        animation: 'fadeIn 200ms ease',
      }}
    >
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        {error ? (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              width: '100%',
              height: '100%',
              padding: '1rem',
              borderRadius: '24px',
              background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--state-overdue)',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        ) : (
          rings.map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '1.5px solid var(--accent-primary)',
                opacity: 0,
                animation: `jarvisRing 2.4s ease-out ${i * 0.35}s infinite`,
              }}
            />
          ))
        )}

        {!error && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 12,
              height: 12,
              marginLeft: -6,
              marginTop: -6,
              borderRadius: '50%',
              background: 'var(--accent-primary)',
              boxShadow: '0 0 20px 6px var(--accent-primary)',
              animation: 'jarvisPulse 1.2s ease-in-out infinite',
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes jarvisRing {
          0% {
            transform: scale(0.15);
            opacity: 0.7;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
        @keyframes jarvisPulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.4); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default JarvisOverlay;

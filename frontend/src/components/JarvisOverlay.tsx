/**
 * JARVIS-style concentric circle wave animation.
 * Shows as a floating overlay while Packy speaks (TTS).
 */

interface JarvisOverlayProps {
  visible: boolean;
}

export function JarvisOverlay({ visible }: JarvisOverlayProps): JSX.Element | null {
  if (!visible) return null;

  const rings = [0, 1, 2, 3, 4];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        pointerEvents: "none",
        animation: "fadeIn 200ms ease",
      }}
    >
      <div style={{ position: "relative", width: 200, height: 200 }}>
        {rings.map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "1.5px solid var(--accent-primary)",
              opacity: 0,
              animation: `jarvisRing 2.4s ease-out ${i * 0.35}s infinite`,
            }}
          />
        ))}

        {/* Center glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 12,
            height: 12,
            marginLeft: -6,
            marginTop: -6,
            borderRadius: "50%",
            background: "var(--accent-primary)",
            boxShadow: "0 0 20px 6px var(--accent-primary)",
            animation: "jarvisPulse 1.2s ease-in-out infinite",
          }}
        />
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

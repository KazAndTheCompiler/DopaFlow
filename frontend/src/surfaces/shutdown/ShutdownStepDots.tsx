export function ShutdownStepDots({ step, total }: { step: number; total: number }): JSX.Element {
  return (
    <div
      style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginBottom: '1.5rem' }}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === step ? 20 : 8,
            height: 8,
            borderRadius: 999,
            background:
              i < step
                ? 'color-mix(in srgb, var(--accent) 45%, transparent)'
                : i === step
                  ? 'var(--accent)'
                  : 'var(--border)',
            transition: 'width 200ms ease, background 200ms ease',
          }}
        />
      ))}
    </div>
  );
}

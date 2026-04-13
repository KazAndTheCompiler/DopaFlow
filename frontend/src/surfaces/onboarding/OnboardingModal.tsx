import { useState } from "react";

import Input from "../../design-system/primitives/Input";
import Button from "../../design-system/primitives/Button";
import { showToast } from "../../design-system/primitives/Toast";

function StepDots({ step, total }: { step: number; total: number }): JSX.Element {
  return (
    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center", marginBottom: "1.5rem" }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === step ? 20 : 8, height: 8, borderRadius: 999,
            background: i < step ? "color-mix(in srgb, var(--accent) 45%, transparent)" : i === step ? "var(--accent)" : "var(--border)",
            transition: "width 200ms ease, background 200ms ease",
          }}
        />
      ))}
    </div>
  );
}

interface OnboardingModalProps {
  onCreateHabits: (names: string[]) => Promise<void>;
  onCreateTask: (text: string) => Promise<void>;
  onFinish: () => void;
}

export default function OnboardingModal({ onCreateHabits, onCreateTask, onFinish }: OnboardingModalProps): JSX.Element {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const habits = [
    { id: "exercise", icon: "EX", label: "Exercise" },
    { id: "hydrate", icon: "HY", label: "Hydrate" },
    { id: "read", icon: "RD", label: "Read" },
    { id: "sleep", icon: "SL", label: "Sleep 8h" },
    { id: "meditate", icon: "MD", label: "Meditate" },
    { id: "meds", icon: "RX", label: "Meds" },
  ];

  const habitNames: Record<string, string> = Object.fromEntries(habits.map(h => [h.id, h.label]));

  const renderStep = (): JSX.Element => {
    if (step === 0) {
      return (
        <div>
          <div style={{ textAlign: "center", marginBottom: "1.75rem", display: "grid", gap: "0.55rem" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>First run</span>
            <h2 style={{ fontSize: "1.95rem", fontWeight: 800, margin: 0, letterSpacing: "-0.04em" }}>Welcome to DopaFlow</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>
              Your ADHD-first personal OS — tasks, habits, focus, and your brain in one place.
            </p>
          </div>
          <div style={{ padding: "0.9rem 1rem", borderRadius: "16px", background: "color-mix(in srgb, var(--surface) 78%, white 22%)", border: "1px solid var(--border-subtle)", marginBottom: "1rem" }}>
            <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.55 }}>
              Build a lightweight system first. You do not need to configure everything today.
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.75rem" }}>
            {[{ icon: "HB", label: "Habits" }, { icon: "FC", label: "Focus" }, { icon: "JR", label: "Journal" }].map(f => (
              <div key={f.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", padding: "0.95rem 0.6rem", borderRadius: "16px", background: "linear-gradient(155deg, color-mix(in srgb, var(--surface) 80%, white 20%), var(--surface))", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-soft)" }}>
                <span style={{ width: "38px", height: "38px", borderRadius: "14px", display: "grid", placeItems: "center", background: "var(--surface-2)", color: "var(--accent)", fontSize: "0.72rem", fontWeight: 800 }}>{f.icon}</span>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>{f.label}</span>
              </div>
            ))}
          </div>
          <Button onClick={() => setStep(1)} variant="primary" style={{ width: "100%", fontSize: "var(--text-sm)" }}>Start setup</Button>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div>
          <h3 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "1.5rem", textAlign: "center" }}>What do you want to build?</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.6rem", marginBottom: "1.5rem" }}>
            {habits.map(h => (
              <button
                key={h.id}
                onClick={() => {
                  setSelected(p => {
 const n = new Set(p); n.has(h.id) ? n.delete(h.id) : n.add(h.id); return n;
});
                }}
                style={{
                  display: "flex", alignItems: "center", gap: "0.55rem", padding: "0.75rem 0.8rem", borderRadius: "14px",
                  border: "1.5px solid", borderColor: selected.has(h.id) ? "var(--accent)" : "var(--border-subtle)",
                  background: selected.has(h.id) ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "color-mix(in srgb, var(--surface) 78%, white 22%)",
                  cursor: "pointer", transition: "border-color 120ms", fontSize: "var(--text-sm)",
                  fontWeight: selected.has(h.id) ? 600 : 500,
                }}
              >
                <span style={{ width: "32px", height: "32px", borderRadius: "12px", display: "grid", placeItems: "center", background: "var(--surface)", color: "var(--accent)", fontSize: "0.7rem", fontWeight: 800 }}>{h.icon}</span>
                <span>{h.label}</span>
                {selected.has(h.id) && <span style={{ marginLeft: "auto", color: "var(--accent)", fontWeight: 800, fontSize: "0.72rem" }}>ON</span>}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button onClick={() => setStep(0)} variant="ghost" style={{ flex: 1 }}>Back</Button>
            <Button onClick={() => setStep(2)} variant="primary" style={{ flex: 1 }}>Continue</Button>
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div>
            <h3 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "1.5rem", textAlign: "center" }}>What's the one thing you need to do today?</h3>
          <Input
            type="text" value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Review meeting notes"
            autoFocus onKeyDown={async e => {
              if (e.key === "Enter") {
                e.preventDefault();
                const trimmed = text.trim();
                if (!trimmed) {
                  setStep(3);
                  return;
                }
                setLoading(true);
                try {
                  await onCreateTask(trimmed);
                  setStep(3);
                } catch {
                  showToast("Could not create the onboarding task. Check the server is running.", "error");
                } finally {
                  setLoading(false);
                }
              }
            }}
            style={{ fontSize: "var(--text-sm)", marginBottom: "1rem", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <Button onClick={() => setStep(1)} variant="ghost" style={{ flex: 1 }}>Back</Button>
            <Button onClick={async () => {
              const trimmed = text.trim();
              if (!trimmed) {
                setStep(3);
                return;
              }
              setLoading(true);
              try {
                await onCreateTask(trimmed);
                setStep(3);
              } catch {
                showToast("Could not create the onboarding task. Check the server is running.", "error");
              } finally {
                setLoading(false);
              }
            }} disabled={loading} variant="primary" style={{ flex: 1 }}>
              {loading ? "Adding..." : "Add it"}
            </Button>
          </div>
          <button onClick={() => setStep(3)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "var(--text-sm)", width: "100%", textDecoration: "underline", padding: "0.5rem", fontWeight: 500 }}>Skip</button>
        </div>
      );
    }

    return (
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: "1.6rem", fontWeight: 800, margin: 0, marginBottom: "0.5rem", letterSpacing: "-0.03em" }}>You're set up. Let's flow.</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: "0 0 1.75rem 0" }}>
          Open the app each morning with the Plan day ritual to set your intentions.
        </p>
        <Button onClick={async () => {
          const names = Array.from(selected).map(id => habitNames[id]);
          setLoading(true);
          onFinish();
          if (!names.length) {
            return;
          }
          try {
            await onCreateHabits(names);
          } catch {
            showToast("Could not create the starter habits. Check the server is running.", "error");
          }
        }} disabled={loading} variant="primary" style={{ width: "100%", fontSize: "var(--text-sm)" }}>
          {loading ? "Opening..." : "Open today"}
        </Button>
      </div>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 10, 14, 0.52)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: "560px", background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, white 6%), var(--surface))", borderRadius: "28px", padding: "1.25rem 1.35rem 1.4rem", boxShadow: "var(--shadow-floating)", border: "1px solid var(--border-subtle)", maxHeight: "90vh", overflowY: "auto" }}>
        <StepDots step={step} total={4} />
        {renderStep()}
      </div>
    </div>
  );
}

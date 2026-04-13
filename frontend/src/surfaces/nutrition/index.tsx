import { useEffect, useState } from "react";

import Button from "@ds/primitives/Button";
import Input from "@ds/primitives/Input";
import VoiceButton from "@ds/primitives/VoiceButton";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition";
import { API_BASE_URL } from "../../api/client";

const NUTRITION_REFRESH_EVENT = "dopaflow:nutrition-logged";

interface LogEntry {
  id: string;
  name: string;
  kj: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_label: string;
  logged_at?: string | null;
}

interface DailyTotals {
  date: string;
  total_kj: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  entries: LogEntry[];
}

interface Goals {
  daily_kj: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface FoodLibraryItem {
  id: string;
  name: string;
  kj: number;
  unit: string;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_label: string;
  is_preset: boolean;
}

function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }): JSX.Element {
  const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  return (
    <div style={{ display: "grid", gap: "0.3rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          {Math.round(value)}g / {goal}g
        </span>
      </div>
      <div style={{ height: "6px", borderRadius: "3px", background: "var(--border-subtle)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "3px", transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

export default function NutritionView(): JSX.Element {
  const [today, setToday] = useState<DailyTotals | null>(null);
  const [goals, setGoals] = useState<Goals>({ daily_kj: 9000, protein_g: 120, carbs_g: 250, fat_g: 70 });
  const [name, setName] = useState("");
  const { listening, transcript, interim, start, stop, supported, reset } = useSpeechRecognition();
  const [kj, setKj] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [meal, setMeal] = useState("snack");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"log" | "goals">("log");
  const [goalKj, setGoalKj] = useState("");
  const [goalProtein, setGoalProtein] = useState("");
  const [goalCarbs, setGoalCarbs] = useState("");
  const [goalFat, setGoalFat] = useState("");
  const [foods, setFoods] = useState<FoodLibraryItem[]>([]);
  const [loggingPresetId, setLoggingPresetId] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    const [todayData, goalsData, foodsData] = await Promise.all([
      fetch(`${API_BASE_URL}/nutrition/today`).then((r) => r.json()).catch(() => null),
      fetch(`${API_BASE_URL}/nutrition/goals`).then((r) => r.json()).catch(() => null),
      fetch(`${API_BASE_URL}/nutrition/foods`).then((r) => r.json()).catch(() => []),
    ]);
    if (todayData) {
 setToday(todayData as DailyTotals);
}
    if (goalsData) {
      setGoals(goalsData as Goals);
      setGoalKj(String((goalsData as Goals).daily_kj));
      setGoalProtein(String((goalsData as Goals).protein_g));
      setGoalCarbs(String((goalsData as Goals).carbs_g));
      setGoalFat(String((goalsData as Goals).fat_g));
    }
    setFoods(Array.isArray(foodsData) ? foodsData as FoodLibraryItem[] : []);
  };

  useEffect(() => {
 void load();
}, []);

  useEffect(() => {
    const handler = (): void => {
 void load();
};
    window.addEventListener(NUTRITION_REFRESH_EVENT, handler);
    return () => window.removeEventListener(NUTRITION_REFRESH_EVENT, handler);
  }, []);

  useEffect(() => {
    if (transcript) {
 setName(transcript); reset();
}
  }, [transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLog = async (): Promise<void> => {
    if (!name.trim() || !kj) {
 return;
}
    setSaving(true);
    try {
      await fetch(`${API_BASE_URL}/nutrition/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          kj: parseFloat(kj),
          protein_g: parseFloat(protein) || 0,
          carbs_g: parseFloat(carbs) || 0,
          fat_g: parseFloat(fat) || 0,
          meal_label: meal,
        }),
      });
      setName(""); setKj(""); setProtein(""); setCarbs(""); setFat("");
      await load();
      window.dispatchEvent(new CustomEvent(NUTRITION_REFRESH_EVENT));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    await fetch(`${API_BASE_URL}/nutrition/${id}`, { method: "DELETE" });
    await load();
  };

  const handleSaveGoals = async (): Promise<void> => {
    await fetch(`${API_BASE_URL}/nutrition/goals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daily_kj: parseInt(goalKj) || 9000,
        protein_g: parseInt(goalProtein) || 120,
        carbs_g: parseInt(goalCarbs) || 250,
        fat_g: parseInt(goalFat) || 70,
      }),
    });
    await load();
  };

  const handleLogPreset = async (food: FoodLibraryItem): Promise<void> => {
    setLoggingPresetId(food.id);
    try {
      await fetch(`${API_BASE_URL}/nutrition/log/from-food`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_id: food.id,
          qty: 1,
          meal_label: meal || food.meal_label,
        }),
      });
      await load();
    } finally {
      setLoggingPresetId(null);
    }
  };

  const kjPct = goals.daily_kj > 0 ? Math.min(((today?.total_kj ?? 0) / goals.daily_kj) * 100, 100) : 0;

  const cardStyle: React.CSSProperties = {
    padding: "1.25rem",
    borderRadius: "16px",
    background: "var(--surface)",
    border: "1px solid var(--border-subtle)",
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>

      {/* Daily kJ progress */}
      <div style={{ ...cardStyle, display: "grid", gap: "0.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <strong style={{ fontSize: "1.1rem" }}>Today</strong>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            {Math.round(today?.total_kj ?? 0)} / {goals.daily_kj} kJ
          </span>
        </div>
        <div style={{ height: "10px", borderRadius: "5px", background: "var(--border-subtle)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${kjPct}%`, background: kjPct > 100 ? "var(--state-overdue)" : "var(--accent)", transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
          <MacroBar label="Protein" value={today?.total_protein_g ?? 0} goal={goals.protein_g} color="#3b82f6" />
          <MacroBar label="Carbs" value={today?.total_carbs_g ?? 0} goal={goals.carbs_g} color="var(--state-warn)" />
          <MacroBar label="Fat" value={today?.total_fat_g ?? 0} goal={goals.fat_g} color="#8b5cf6" />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {(["log", "goals"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "0.4rem 1rem",
              borderRadius: "999px",
              border: "1.5px solid",
              borderColor: tab === t ? "var(--accent)" : "var(--border)",
              background: tab === t ? "var(--accent)" : "transparent",
              color: tab === t ? "white" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
            }}
          >
            {t === "log" ? "Log food" : "Goals"}
          </button>
        ))}
      </div>

      {tab === "log" && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {foods.length > 0 && (
            <div style={cardStyle}>
              <div style={{ display: "grid", gap: "0.25rem", marginBottom: "0.75rem" }}>
                <strong>Starter food library</strong>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                  Protected basics ship with every install so quick logging works from day one.
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.6rem" }}>
                {foods
                  .filter((food) => food.is_preset)
                  .map((food) => (
                    <button
                      key={food.id}
                      onClick={() => void handleLogPreset(food)}
                      disabled={loggingPresetId === food.id}
                      style={{
                        textAlign: "left",
                        padding: "0.75rem 0.85rem",
                        borderRadius: "14px",
                        border: "1px solid var(--border-subtle)",
                        background: "var(--surface-2)",
                        color: "var(--text-primary)",
                        cursor: "pointer",
                        display: "grid",
                        gap: "0.22rem",
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{food.name}</span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                        {Math.round(food.kj)} kJ · {food.unit} · {Math.round(food.protein_g)}p · {Math.round(food.carbs_g)}c · {Math.round(food.fat_g)}f
                      </span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)" }}>
                        {loggingPresetId === food.id ? "Logging…" : "Log 1 serving"}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
          <div style={cardStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <Input
                value={listening ? interim || name : name}
                onChange={(e) => setName(e.currentTarget.value)}
                placeholder={listening ? "Listening…" : "Food name"}
              />
              <VoiceButton listening={listening} supported={supported} onToggle={() => (listening ? stop() : start())} size="sm" title="Speak food name" />
              <select
                value={meal}
                onChange={(e) => setMeal(e.currentTarget.value)}
                style={{ padding: "0.75rem", borderRadius: "14px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "inherit" }}
              >
                {["breakfast", "lunch", "dinner", "snack"].map((m) => (
                  <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <Input value={kj} onChange={(e) => setKj(e.currentTarget.value)} placeholder="kJ" type="number" min="0" />
              <Input value={protein} onChange={(e) => setProtein(e.currentTarget.value)} placeholder="Protein g" type="number" min="0" />
              <Input value={carbs} onChange={(e) => setCarbs(e.currentTarget.value)} placeholder="Carbs g" type="number" min="0" />
              <Input value={fat} onChange={(e) => setFat(e.currentTarget.value)} placeholder="Fat g" type="number" min="0" />
            </div>
            <Button onClick={() => void handleLog()} disabled={saving || !name.trim() || !kj} style={{ width: "100%" }}>
              {saving ? "Logging…" : "Log"}
            </Button>
          </div>

          {/* Today's entries */}
          {today?.entries && today.entries.length > 0 && (
            <div style={cardStyle}>
              <strong style={{ display: "block", marginBottom: "0.75rem" }}>Today's log</strong>
              {today.entries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: "0.5rem",
                    alignItems: "center",
                    padding: "0.5rem 0",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 500 }}>{entry.name}</span>
                    <span style={{ marginLeft: "0.5rem", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                      {entry.meal_label}
                    </span>
                  </div>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {Math.round(entry.kj)} kJ · {Math.round(entry.protein_g)}p · {Math.round(entry.carbs_g)}c · {Math.round(entry.fat_g)}f
                  </span>
                  <button
                    onClick={() => void handleDelete(entry.id)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: "0.9rem" }}
                    aria-label="Remove entry"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "goals" && (
        <div style={{ ...cardStyle, display: "grid", gap: "0.75rem" }}>
          <strong>Daily targets</strong>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>Energy (kJ)</label>
              <Input value={goalKj} onChange={(e) => setGoalKj(e.currentTarget.value)} type="number" min="0" />
            </div>
            <div>
              <label style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>Protein (g)</label>
              <Input value={goalProtein} onChange={(e) => setGoalProtein(e.currentTarget.value)} type="number" min="0" />
            </div>
            <div>
              <label style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>Carbs (g)</label>
              <Input value={goalCarbs} onChange={(e) => setGoalCarbs(e.currentTarget.value)} type="number" min="0" />
            </div>
            <div>
              <label style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>Fat (g)</label>
              <Input value={goalFat} onChange={(e) => setGoalFat(e.currentTarget.value)} type="number" min="0" />
            </div>
          </div>
          <Button onClick={() => void handleSaveGoals()} style={{ justifySelf: "start" }}>Save goals</Button>
        </div>
      )}
    </div>
  );
}

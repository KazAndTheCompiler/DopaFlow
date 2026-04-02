import { useContext } from "react";
import { AppDataContext } from "../../App";
import BadgeGallery from "../../components/gamification/BadgeGallery";
import LevelBadge from "../../components/gamification/LevelBadge";
import XPBar from "../../components/gamification/XPBar";

export default function GamificationView(): JSX.Element {
  const app = useContext(AppDataContext);
  if (!app) return <div>App context unavailable.</div>;

  const { level, badges, earnedCount } = app.gamification;

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          padding: "1.25rem",
          borderRadius: "18px",
          background: "var(--surface)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {level && <LevelBadge level={level.level} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.4rem" }}>
            {level ? `Level ${level.level}` : "Loading…"}
          </div>
          {level && (
            <XPBar
              totalXp={level.total_xp}
              level={level.level}
              progress={level.progress}
              xpToNext={level.xp_to_next}
            />
          )}
        </div>
        <div style={{ textAlign: "right", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{earnedCount}</div>
          <div>badges earned</div>
        </div>
      </div>

      <div
        style={{
          padding: "1.25rem",
          borderRadius: "18px",
          background: "var(--surface)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <BadgeGallery badges={badges} />
      </div>
    </div>
  );
}

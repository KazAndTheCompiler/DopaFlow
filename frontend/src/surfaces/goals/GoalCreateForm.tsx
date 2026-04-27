import {
  goalButtonStyle,
  goalCardStyle,
  goalInputStyle,
  type GoalCreateFormProps,
} from "./GoalsShared";

export function GoalCreateForm({
  title,
  description,
  horizon,
  milestoneInput,
  creating,
  inputRef,
  onTitleChange,
  onDescriptionChange,
  onHorizonChange,
  onMilestoneInputChange,
  onCreate,
}: GoalCreateFormProps): JSX.Element {
  return (
    <section style={{ ...goalCardStyle, display: "grid", gap: "0.85rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 800,
            letterSpacing: "0.06em",
            color: "var(--accent)",
          }}
        >
          GL
        </span>
        <strong
          style={{ fontSize: "var(--text-lg)", color: "var(--text-primary)" }}
        >
          New goal
        </strong>
      </div>
      <div style={{ display: "grid", gap: "0.4rem" }}>
        <label
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-secondary)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Title
        </label>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onCreate()}
          placeholder="e.g. Launch side project"
          style={goalInputStyle}
          className="goal-input"
        />
      </div>
      <div style={{ display: "grid", gap: "0.4rem" }}>
        <label
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-secondary)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="What does success look like?"
          rows={2}
          style={{
            ...goalInputStyle,
            resize: "vertical",
            fontFamily: "inherit",
          }}
          className="goal-textarea"
        />
      </div>
      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Horizon
          </label>
          <select
            value={horizon}
            onChange={(e) =>
              onHorizonChange(e.target.value as GoalCreateFormProps["horizon"])
            }
            style={{ ...goalInputStyle, cursor: "pointer" }}
            className="goal-select"
          >
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="quarter">This quarter</option>
            <option value="year">This year</option>
          </select>
        </div>
        <div style={{ flex: "1 1 280px", display: "grid", gap: "0.4rem" }}>
          <label
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Milestones (one per line)
          </label>
          <textarea
            value={milestoneInput}
            onChange={(e) => onMilestoneInputChange(e.target.value)}
            placeholder={"Research\nBuild MVP\nLaunch"}
            rows={2}
            style={{
              ...goalInputStyle,
              resize: "vertical",
              fontFamily: "inherit",
            }}
            className="goal-textarea"
          />
        </div>
      </div>
      <button
        onClick={onCreate}
        disabled={!title.trim() || creating}
        style={{
          ...goalButtonStyle,
          padding: "0.55rem 1.4rem",
          borderRadius: "10px",
          border: "none",
          background: title.trim() ? "var(--accent)" : "var(--border-subtle)",
          color: "var(--text-inverted)",
          cursor: title.trim() ? "pointer" : "not-allowed",
          fontWeight: 600,
          alignSelf: "start",
          fontSize: "var(--text-sm)",
          boxShadow: title.trim() ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
        }}
        onMouseEnter={(e) => {
          if (title.trim()) {
            e.currentTarget.style.background = "var(--accent)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }
        }}
        onMouseLeave={(e) => {
          if (title.trim()) {
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
            e.currentTarget.style.transform = "translateY(0)";
          }
        }}
      >
        {creating ? "…" : "+ Create goal"}
      </button>
    </section>
  );
}

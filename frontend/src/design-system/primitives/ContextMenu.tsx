import type { ReactNode } from "react";

export interface ContextMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
}

export interface ContextMenuProps {
  anchor: ReactNode;
  items: ContextMenuItem[];
}

export function ContextMenu({ anchor, items }: ContextMenuProps): JSX.Element {
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {anchor}
      <div
        style={{
          position: "absolute",
          top: "calc(100% + 0.5rem)",
          right: 0,
          minWidth: "180px",
          padding: "0.4rem",
          borderRadius: "16px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            onClick={item.onSelect}
            style={{
              width: "100%",
              border: 0,
              background: "transparent",
              textAlign: "left",
              padding: "0.6rem 0.75rem",
              cursor: "pointer",
              borderRadius: "12px",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ContextMenu;

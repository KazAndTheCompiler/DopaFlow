import { mobileNavRoutes, type AppRoute } from "../appRoutes";

type MobileNavItem = (typeof mobileNavRoutes)[number] | { id: "more"; label: string; icon: string };

interface ShellMobileNavProps {
  route: AppRoute;
  mobileMenuOpen: boolean;
  pressedItemId: string | null;
  onNavigate: (route: AppRoute) => void;
  onPressedItemChange: (route: string | null) => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}

const mobileItems: readonly MobileNavItem[] = [...mobileNavRoutes, { id: "more", label: "More", icon: "••" }];

export function ShellMobileNav({
  route,
  mobileMenuOpen,
  pressedItemId,
  onNavigate,
  onPressedItemChange,
  onToggleMenu,
  onCloseMenu,
}: ShellMobileNavProps): JSX.Element {
  const clearPressedItem = (itemId: string): void => {
    onPressedItemChange(pressedItemId === itemId ? null : pressedItemId);
  };

  return (
    <nav
      data-testid="mobile-nav"
      style={{
        display: "flex",
        alignItems: "stretch",
        background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, white 4%), var(--surface))",
        borderTop: "1px solid var(--border)",
        paddingBottom: "max(0.25rem, env(safe-area-inset-bottom, 0px))",
        boxShadow: "0 -10px 24px rgba(0,0,0,0.08)",
        position: "relative",
        zIndex: 1,
      }}
    >
      {mobileItems.map((item) => {
        const isMenuButton = item.id === "more";
        const isActive = !isMenuButton && item.id === route;
        const isPressed = pressedItemId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              if (isMenuButton) {
                onToggleMenu();
                return;
              }
              onCloseMenu();
              onNavigate(item.id);
            }}
            onTouchStart={() => onPressedItemChange(item.id)}
            onTouchEnd={() => clearPressedItem(item.id)}
            onTouchCancel={() => clearPressedItem(item.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.18rem",
              border: "none",
              background: "transparent",
              color: isMenuButton
                ? mobileMenuOpen ? "var(--accent)" : "var(--text-muted)"
                : isActive ? "var(--accent)" : "var(--text-muted)",
              cursor: "pointer",
              padding: "0.55rem 0.2rem 0.4rem",
              fontSize: "0.7rem",
              minHeight: "44px",
              transform: isPressed ? "scale(0.92)" : "scale(1)",
              transition: "transform 100ms ease, color 140ms ease",
            }}
          >
            <span
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "10px",
                display: "grid",
                placeItems: "center",
                background: isMenuButton
                  ? mobileMenuOpen
                    ? "color-mix(in srgb, var(--accent) 14%, var(--surface))"
                    : "color-mix(in srgb, var(--surface) 74%, white 26%)"
                  : isActive
                    ? "color-mix(in srgb, var(--accent) 14%, var(--surface))"
                    : "color-mix(in srgb, var(--surface) 74%, white 26%)",
                fontWeight: 800,
                letterSpacing: "0.02em",
              }}
            >
              {item.icon}
            </span>
            <span style={{ fontSize: "9px", fontWeight: isActive ? 700 : 600 }}>{item.label}</span>
            <span
              aria-hidden="true"
              style={{
                width: isMenuButton
                  ? mobileMenuOpen ? "14px" : "4px"
                  : isActive ? "14px" : "4px",
                height: "4px",
                borderRadius: "999px",
                background: isMenuButton
                  ? mobileMenuOpen ? "var(--accent)" : "transparent"
                  : isActive ? "var(--accent)" : "transparent",
                transition: "width 160ms ease, background 160ms ease",
              }}
            />
          </button>
        );
      })}
    </nav>
  );
}

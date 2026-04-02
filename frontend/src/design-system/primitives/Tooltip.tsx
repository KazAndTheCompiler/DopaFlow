import type { PropsWithChildren } from "react";

export interface TooltipProps {
  text: string;
}

export function Tooltip({ children, text }: PropsWithChildren<TooltipProps>): JSX.Element {
  return (
    <span title={text} style={{ borderBottom: "1px dotted var(--text-muted)", cursor: "help" }}>
      {children}
    </span>
  );
}

export default Tooltip;


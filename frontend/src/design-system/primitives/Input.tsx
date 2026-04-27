import { forwardRef, useState } from "react";
import type { InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { style, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      ref={ref}
      {...props}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      style={{
        width: "100%",
        padding: "0.72rem 0.9rem",
        borderRadius: "12px",
        border: `1px solid ${focused ? "var(--accent)" : "var(--border)"}`,
        background: focused
          ? "color-mix(in srgb, var(--surface) 78%, white 22%)"
          : "var(--surface-2)",
        color: "var(--text)",
        outline: "none",
        boxShadow: focused
          ? "0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent)"
          : "none",
        transition:
          "border-color 150ms ease, box-shadow 150ms ease, background 150ms ease",
        ...(style ?? {}),
      }}
    />
  );
});

export default Input;

import { useState } from 'react';
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function Button({
  children,
  style,
  variant = 'primary',
  disabled,
  ...props
}: PropsWithChildren<ButtonProps>): JSX.Element {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const palette =
    variant === 'primary'
      ? {
          background: 'var(--button-primary-fill, var(--accent))',
          color: 'var(--button-primary-text, var(--text-inverted))',
          border: '1px solid var(--button-primary-edge, transparent)',
          boxShadow:
            'var(--button-primary-glow, 0 1px 3px color-mix(in srgb, var(--accent) 40%, transparent)), inset 0 1px 0 color-mix(in srgb, white 15%, transparent)',
        }
      : variant === 'secondary'
        ? {
            background: 'var(--button-secondary-fill, var(--surface-2))',
            color: 'var(--button-secondary-text, var(--text))',
            border: '1px solid var(--button-secondary-edge, var(--border))',
            boxShadow: '0 1px 2px color-mix(in srgb, black 6%, transparent)',
          }
        : {
            background: 'var(--button-quiet-fill, transparent)',
            color: 'var(--button-quiet-text, var(--text))',
            border: '1px solid var(--border)',
            boxShadow: 'none',
          };

  return (
    <button
      disabled={disabled}
      {...props}
      onMouseEnter={(event) => {
        setIsHovered(true);
        props.onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        setIsHovered(false);
        setIsPressed(false);
        props.onMouseLeave?.(event);
      }}
      onMouseDown={(event) => {
        setIsPressed(true);
        props.onMouseDown?.(event);
      }}
      onMouseUp={(event) => {
        setIsPressed(false);
        props.onMouseUp?.(event);
      }}
      style={{
        padding: '0.6rem 1.1rem',
        borderRadius: '10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 500,
        fontSize: 'var(--text-sm)',
        letterSpacing: '0.01em',
        opacity: disabled ? 0.45 : 1,
        transform: disabled
          ? 'none'
          : isPressed
            ? 'translateY(1px) scale(0.985)'
            : 'translateY(0) scale(1)',
        filter: disabled ? 'none' : isHovered ? 'brightness(1.04)' : 'none',
        transition:
          'transform 140ms ease, filter 140ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease',
        ...palette,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export default Button;

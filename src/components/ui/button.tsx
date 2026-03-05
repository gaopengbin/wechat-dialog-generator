import * as React from "react"

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'success' | 'warning';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  default: { background: '#18181b', color: '#fafafa' },
  destructive: { background: '#ef4444', color: '#fff' },
  outline: { background: '#fff', color: '#333', border: '1px solid #d9d9d9' },
  secondary: { background: '#f4f4f5', color: '#18181b' },
  ghost: { background: 'transparent', color: '#333' },
  success: { background: '#07c160', color: '#fff' },
  warning: { background: '#f59e0b', color: '#fff' },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  default: { height: 36, padding: '0 16px', fontSize: 14 },
  sm: { height: 32, padding: '0 12px', fontSize: 13 },
  lg: { height: 40, padding: '0 24px', fontSize: 14 },
  icon: { height: 36, width: 36, padding: 0, fontSize: 14 },
};

const baseStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  whiteSpace: 'nowrap', borderRadius: 6, fontWeight: 500,
  border: 'none', cursor: 'pointer', transition: 'opacity 0.2s, box-shadow 0.2s',
  outline: 'none', fontFamily: 'inherit', lineHeight: 1,
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'default', style, disabled, ...props }, ref) => {
    const vs = variantStyles[variant];
    const ss = sizeStyles[size];
    return (
      <button
        ref={ref}
        disabled={disabled}
        style={{
          ...baseStyle, ...vs, ...ss, ...style,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = '0.85'; }}
        onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.opacity = '1'; }}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }

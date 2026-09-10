import * as React from 'react'
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cn } from '@/lib/utils'
import './foundation.css'

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'success' | 'warning'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'default', className, disabled, style, type = 'button', ...props }, ref) =>
    <ButtonPrimitive ref={ref} type={type} data-slot="button" className={cn('ui-button', `ui-button-${variant}`, `ui-button-${size}`, className)} disabled={disabled}
      style={disabled ? { ...style, background: 'var(--control-disabled)', color: 'var(--control-muted)', opacity: 1 } : style} {...props} />
)
Button.displayName = 'Button'
export { Button }

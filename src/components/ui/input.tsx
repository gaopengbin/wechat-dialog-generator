import { forwardRef, type InputHTMLAttributes } from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'
import { cn } from '@/lib/utils'
import './foundation.css'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <InputPrimitive ref={ref} data-slot="input" className={cn('ui-input', className)} {...props} />)
Input.displayName = 'Input'

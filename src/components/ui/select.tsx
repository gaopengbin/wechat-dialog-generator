import { Select as SelectPrimitive } from '@base-ui/react/select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import './foundation.css'

// shadcn Base UI composition, adapted to the toolbox's light-green tokens.
// Source: https://ui.shadcn.com/docs/components/base/select
const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
  return <SelectPrimitive.Trigger data-slot="select-trigger" className={cn('ui-select-trigger', className)} {...props}>
    {children}<SelectPrimitive.Icon render={<ChevronDown size={15} />} />
  </SelectPrimitive.Trigger>
}

function SelectContent({ className, children, ...props }: SelectPrimitive.Popup.Props) {
  return <SelectPrimitive.Portal>
    <SelectPrimitive.Positioner className="ui-select-positioner" side="bottom" align="start" sideOffset={6} collisionPadding={8} alignItemWithTrigger={false}>
      <SelectPrimitive.Popup data-slot="select-content" className={cn('ui-select-content', className)} {...props}>
        <SelectPrimitive.ScrollUpArrow className="ui-select-scroll"><ChevronUp size={14} /></SelectPrimitive.ScrollUpArrow>
        <SelectPrimitive.List>{children}</SelectPrimitive.List>
        <SelectPrimitive.ScrollDownArrow className="ui-select-scroll"><ChevronDown size={14} /></SelectPrimitive.ScrollDownArrow>
      </SelectPrimitive.Popup>
    </SelectPrimitive.Positioner>
  </SelectPrimitive.Portal>
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return <SelectPrimitive.Item data-slot="select-item" className={cn('ui-select-item', className)} {...props}>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="ui-select-check"><Check size={15} /></SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
}

interface SelectFieldProps {
  value: string
  onValueChange: (value: string) => void
  options: readonly { value: string; label: ReactNode; disabled?: boolean }[]
  placeholder?: string
  disabled?: boolean
  id?: string
  name?: string
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

/** Domain convenience wrapper. The visible control is Base UI, never a native select. */
function SelectField({ value, onValueChange, options, placeholder, disabled, name, ...triggerProps }: SelectFieldProps) {
  return <Select value={value} items={options} disabled={disabled} name={name} modal={false} onValueChange={next => { if (next !== null) onValueChange(next) }}>
    <SelectTrigger {...triggerProps}><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent><SelectGroup>{options.map(option => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectGroup></SelectContent>
  </Select>
}

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectField }

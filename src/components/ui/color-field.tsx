import { useId, useRef, useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { Check, ChevronDown, X } from 'lucide-react'
import { Input } from './input'
import { SelectField } from './select'
import { Button } from './button'
import './color-field.css'

const palette = ['#95ec69', '#07c160', '#c8f2df', '#75877f', '#ffffff', '#ededed', '#f5f5f5', '#262626', '#dcecff', '#b8d6ff', '#fce4ec', '#ffd5c2', '#fef3c7', '#e8def8', '#c7e7e5', '#718096']

function normalizeHex(value: string) {
  const input = value.trim().replace(/^#/, '')
  if (/^[\da-f]{3}$/i.test(input)) return `#${input.split('').map(character => character.repeat(2)).join('').toLowerCase()}`
  return /^[\da-f]{6}$/i.test(input) ? `#${input.toLowerCase()}` : null
}

interface ColorFieldProps {
  value: string
  onValueChange: (value: string) => void
  'aria-label': string
  id?: string
  disabled?: boolean
}

/** Branded color selection without an operating-system color dialog. */
export function ColorField({ value, onValueChange, 'aria-label': label, id, disabled = false }: ColorFieldProps) {
  const inputId = useId()
  const [draft, setDraft] = useState(value)
  const [invalid, setInvalid] = useState(false)
  const actionsRef = useRef<Popover.Root.Actions | null>(null)

  const apply = (candidate: string) => {
    if (disabled) return
    const normalized = normalizeHex(candidate)
    if (!normalized) { setInvalid(true); return }
    setInvalid(false)
    onValueChange(normalized)
    actionsRef.current?.close()
  }

  return (
    <Popover.Root key={disabled ? 'disabled' : 'enabled'} modal={false} actionsRef={actionsRef} onOpenChange={open => {
      if (open) { setDraft(value); setInvalid(false) }
    }}>
      <Popover.Trigger id={id} className="color-field-trigger" disabled={disabled} aria-label={label}>
        <span className="color-field-swatch" style={{ backgroundColor: value }} />
        <span className="color-field-value">{value.toUpperCase()}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="color-field-positioner" side="bottom" align="start" sideOffset={6} collisionPadding={8}>
          <Popover.Popup className="color-field-popup">
            <div className="color-field-heading">
              <Popover.Title>{label}</Popover.Title>
              <Popover.Close className="color-field-close" aria-label="关闭颜色选择"><X size={15} /></Popover.Close>
            </div>
            <Popover.Description className="color-field-description">选择常用颜色，或输入自定义色值。</Popover.Description>
            <div className="color-field-palette" aria-label="常用颜色">
              {palette.map(color => <Button variant="ghost" type="button" key={color} className="color-field-option" style={{ backgroundColor: color, padding: 0, height: 25 }} aria-label={`选择颜色 ${color.toUpperCase()}`} aria-pressed={normalizeHex(value) === color} disabled={disabled} onClick={() => apply(color)}>
                {normalizeHex(value) === color && <span className="color-field-selected"><Check size={12} /></span>}
              </Button>)}
            </div>
            <label className="color-field-label" htmlFor={inputId}>HEX 色值</label>
            <div className="color-field-hex-row">
              <Input id={inputId} aria-label={`${label} HEX 色值`} value={draft} maxLength={7} spellCheck={false} autoComplete="off" disabled={disabled} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${inputId}-error` : undefined} onChange={event => { setDraft(event.target.value); setInvalid(false) }} onKeyDown={event => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); apply(draft) }
              }} />
              <Button type="button" className="color-field-apply" disabled={disabled} onClick={() => apply(draft)}>应用</Button>
            </div>
            {invalid && <p className="color-field-error" id={`${inputId}-error`} role="alert">请输入有效的 HEX 色值，例如 #95EC69。</p>}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

const hours = Array.from({ length: 24 }, (_, hour) => ({ value: String(hour).padStart(2, '0'), label: String(hour).padStart(2, '0') }))
const minutes = Array.from({ length: 60 }, (_, minute) => ({ value: String(minute).padStart(2, '0'), label: String(minute).padStart(2, '0') }))

export function TimeField({ value, onValueChange, 'aria-label': label, id, disabled = false }: ColorFieldProps) {
  const [hour = '00', minute = '00'] = /^\d{2}:\d{2}$/.test(value) ? value.split(':') : ['00', '00']
  return <div className="time-field" role="group" aria-label={label}>
    <SelectField id={id} value={hour} disabled={disabled} aria-label={`${label}小时`} options={hours} onValueChange={next => onValueChange(`${next}:${minute}`)} />
    <span aria-hidden="true">:</span>
    <SelectField value={minute} disabled={disabled} aria-label={`${label}分钟`} options={minutes} onValueChange={next => onValueChange(`${hour}:${next}`)} />
  </div>
}

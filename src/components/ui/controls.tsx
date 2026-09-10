import type { ReactNode } from 'react';
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { Slider as SliderPrimitive } from '@base-ui/react/slider';
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';
import { Check, ChevronDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import './controls.css';

// Base UI composition follows the official shadcn base-nova registry.
// Product tokens preserve the toolbox's light-green theme in every state.
type WithClassName<Props> = Omit<Props, 'className'> & { className?: string };

export function Checkbox({ className, indeterminate, ...props }: WithClassName<CheckboxPrimitive.Root.Props>) {
  return (
    <CheckboxPrimitive.Root data-slot="checkbox" className={cn('ui-checkbox', className)} indeterminate={indeterminate} {...props}>
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="ui-checkbox-indicator">
        {indeterminate ? <Minus aria-hidden="true" size={13} strokeWidth={3} /> : <Check aria-hidden="true" size={13} strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function Switch({ className, ...props }: WithClassName<SwitchPrimitive.Root.Props>) {
  return (
    <SwitchPrimitive.Root data-slot="switch" className={cn('ui-switch', className)} {...props}>
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className="ui-switch-thumb" />
    </SwitchPrimitive.Root>
  );
}

type SliderProps = WithClassName<SliderPrimitive.Root.Props<number>>;

export function Slider({ className, min = 0, max = 100, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...props }: SliderProps) {
  return (
    <SliderPrimitive.Root data-slot="slider" className={cn('ui-slider', className)} min={min} max={max} thumbAlignment="edge" {...props}>
      <SliderPrimitive.Control className="ui-slider-control">
        <SliderPrimitive.Track data-slot="slider-track" className="ui-slider-track">
          <SliderPrimitive.Indicator data-slot="slider-range" className="ui-slider-range" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb data-slot="slider-thumb" className="ui-slider-thumb" aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

type DisclosureProps = WithClassName<Omit<CollapsiblePrimitive.Root.Props, 'title'>> & {
  title: ReactNode;
};

export function Disclosure({ title, children, className, ...props }: DisclosureProps) {
  return (
    <CollapsiblePrimitive.Root data-slot="collapsible" className={cn('ui-disclosure', className)} {...props}>
      <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" className="ui-disclosure-trigger">
        <span>{title}</span><ChevronDown className="ui-disclosure-chevron" size={16} aria-hidden="true" />
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Panel data-slot="collapsible-content" className="ui-disclosure-panel" keepMounted>
        <div className="ui-disclosure-content">{children}</div>
      </CollapsiblePrimitive.Panel>
    </CollapsiblePrimitive.Root>
  );
}

export function Tabs({ className, orientation = 'horizontal', ...props }: WithClassName<TabsPrimitive.Root.Props>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('ui-tabs', className)} orientation={orientation} {...props} />;
}

export function TabsList({ className, variant = 'default', ...props }: WithClassName<TabsPrimitive.List.Props> & { variant?: 'default' | 'line' }) {
  return <TabsPrimitive.List data-slot="tabs-list" data-variant={variant} className={cn('ui-tabs-list', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: WithClassName<TabsPrimitive.Tab.Props>) {
  return <TabsPrimitive.Tab data-slot="tabs-trigger" className={cn('ui-tabs-trigger', className)} {...props} />;
}

export function TabsContent({ className, ...props }: WithClassName<TabsPrimitive.Panel.Props>) {
  return <TabsPrimitive.Panel data-slot="tabs-content" className={cn('ui-tabs-content', className)} {...props} />;
}

type SegmentedControlProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: ReactNode; disabled?: boolean }[];
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
};

export function SegmentedControl({ value, onValueChange, options, className, ...props }: SegmentedControlProps) {
  return (
    <ToggleGroupPrimitive data-slot="toggle-group" className={cn('ui-segmented-control', className)} value={[value]} multiple={false} onValueChange={(values) => { if (values[0]) onValueChange(values[0]); }} {...props}>
      {options.map((option) => <TogglePrimitive key={option.value} data-slot="toggle-group-item" className="ui-segmented-item" value={option.value} disabled={option.disabled}>{option.label}</TogglePrimitive>)}
    </ToggleGroupPrimitive>
  );
}

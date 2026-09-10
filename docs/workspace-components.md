# Workpage component migration

## Scope

Workpage editing controls use shared shadcn-style compositions built on `@base-ui/react` 1.8.0. The toolbox's existing light-green Vercel-style layout is preserved. This document records the component migration and its original local verification; the components are included in the v0.1.0 release preparation. Production deployment completion is verified separately. The component migration itself does not migrate accounts or quota.

Sources inspected before implementation:

- https://ui.shadcn.com/docs/components/base/select
- https://ui.shadcn.com/r/styles/base-nova/select.json
- https://ui.shadcn.com/r/styles/base-nova/alert-dialog.json
- https://ui.shadcn.com/r/styles/base-nova/progress.json
- https://base-ui.com/react/components/select

## Component boundaries

- `ui/select.tsx`: composable Select primitives and a controlled `SelectField` convenience wrapper. Nonmodal, bottom/start placement, 6px offset, 8px viewport collision padding, `alignItemWithTrigger={false}`. Keyboard, item selection, dismissal and focus restoration come from Base UI.
- `ui/controls.tsx`: Checkbox, Switch, Slider, Disclosure, Tabs and single-selection SegmentedControl. Persistent workpage panels use `keepMounted` so navigation does not discard editing state.
- `ui/color-field.tsx`: nonmodal Popover with preset palette and validated 3/6-digit HEX entry. Invalid values do not update the preview. `TimeField` uses two SelectFields rather than an operating-system time picker.
- `ui/confirm-dialog.tsx`: AlertDialog for clearing a batch, deleting a local draft and confirming same-template sharing. Cancel is initially focused; Escape cancels; focus returns to the invoking control.
- `ui/input.tsx`, `textarea.tsx`, `button.tsx`, `progress.tsx`: shared field/action/progress components.
- `ui/foundation.css`: root-level green tokens so portaled controls and inline controls share the same colors, focus and disabled states.

Visible workpage native selects, color/time pickers, checkboxes, range sliders, details/summary and browser confirm prompts were replaced. Hidden native file inputs remain for the operating-system file chooser; Base UI's hidden accessibility/form inputs remain intact. HTML used to render the simulated WeChat image is not application control UI and is intentionally preserved.

Batch controls receive explicit `disabled` and guarded callbacks. A disabled fieldset alone is not sufficient for portaled composite controls. Export rendering, job IDs, debit idempotency, retries and ZIP download behavior are preserved.

## Original local verification (2026-09-10)

- `npm test`: 31 tests pass.
- `npm run build`, `npm run lint`: pass. Vite still reports a non-blocking large bundle warning.
- `scripts/workspace-smoke.mjs`: 27 checks across seven tools at 1440px, 1024px and 390px; route history, draft continuity, internal scrolling and fixed preview.
- `scripts/component-smoke.mjs`: dropdown placement/selection/Escape/outside click, no scroll lock or layout shift, keyboard Switch/Slider, invalid/valid HEX, AlertDialog cancellation and focus restoration, mobile popup bounds, long minute menu keyboard navigation, and visible-native-control inventory.
- `scripts/batch-chat-smoke.mjs`: real PNG/ZIP generation, standard/long captures, repeat download without extra debit, invalid edit without debit, corrected retry, paid-row lock, page-switch state and confirmation dialog.
- `scripts/scene-workspace-smoke.mjs`: local draft refresh plus real desktop/mobile PNGs. Moments remains 780×1608; payment remains 780×1548; simulated-content watermark retained.

Browser checks run in isolated guest contexts with external requests blocked. They do not use the user's cookies or real account/payment endpoints. Desktop and 390px screenshots were visually inspected.

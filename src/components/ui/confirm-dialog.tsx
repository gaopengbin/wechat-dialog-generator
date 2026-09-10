import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Button } from './button'
import './foundation.css'

export function ConfirmDialog({ open, onOpenChange, title, description, onConfirm, confirmText = '确认' }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; onConfirm: () => void; confirmText?: string
}) {
  return <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
    <AlertDialog.Portal><AlertDialog.Backdrop className="ui-confirm-backdrop" />
      <AlertDialog.Popup className="ui-confirm-popup">
        <AlertDialog.Title className="ui-confirm-title">{title}</AlertDialog.Title>
        <AlertDialog.Description className="ui-confirm-description">{description}</AlertDialog.Description>
        <div className="ui-confirm-actions"><AlertDialog.Close render={<Button variant="outline" />}>取消</AlertDialog.Close><Button onClick={onConfirm}>{confirmText}</Button></div>
      </AlertDialog.Popup>
    </AlertDialog.Portal>
  </AlertDialog.Root>
}

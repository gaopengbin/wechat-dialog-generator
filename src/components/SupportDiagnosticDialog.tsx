import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Check, Copy, ShieldCheck, Stethoscope } from 'lucide-react'
import { Button } from './ui/button'
import { AccountApiError, createSupportDiagnosticCode, type SupportDiagnosticCode } from '@/lib/account-api'
import type { ExportLog } from '@/lib/export-log'
import { supportLocalReport } from '@/lib/support-diagnostic'
import './ui/foundation.css'

export function SupportDiagnosticDialog({ record, onClose, onRequestLogin }: {
  record: ExportLog | null
  onClose: () => void
  onRequestLogin?: () => void
}) {
  const [code, setCode] = useState<SupportDiagnosticCode | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [copied, setCopied] = useState(false)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => { pending.current?.abort() }, [record?.id])
  function close() { pending.current?.abort(); setCode(null); setBusy(false); setError(''); setNeedsLogin(false); setCopied(false); onClose() }
  async function generate() {
    if (!record || busy) return
    const controller = new AbortController(); pending.current = controller
    setBusy(true); setError(''); setNeedsLogin(false)
    try { const result = await createSupportDiagnosticCode(record.actionId || record.id, controller.signal, supportLocalReport(record)); if (!controller.signal.aborted) setCode(result) }
    catch (failure) { if (!controller.signal.aborted) { setNeedsLogin(failure instanceof AccountApiError && failure.status === 401); setError(failure instanceof Error ? failure.message : '暂时无法生成诊断码，请稍后重试。') } }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  async function copy() {
    if (!code) return
    try { await navigator.clipboard.writeText(`请帮我诊断这次导出：${code.code}`); setCopied(true); setError('') }
    catch { setError('复制未成功，可以手动选择诊断码复制。') }
  }
  return <Dialog.Root open={Boolean(record)} onOpenChange={open => { if (!open) close() }}>
    <Dialog.Portal><Dialog.Backdrop className="ui-confirm-backdrop" /><Dialog.Popup className="ui-confirm-popup support-diagnostic-dialog">
      <Dialog.Title className="ui-confirm-title"><Stethoscope size={20} /> 授权核对这次导出</Dialog.Title>
      <Dialog.Description className="ui-confirm-description">仅在公众号客服需要核对个人记录时使用。生成一个 30 分钟有效的诊断码，发送到公众号「老高 Vibe Coding」，授权核对这一条导出。普通使用问题直接在公众号私信提问，不需要诊断码。</Dialog.Description>
      <p className="support-diagnostic-privacy"><ShieldCheck size={16} /> 不上传聊天、头像或生成图片，不扣除导出额度；不会授权查询其他导出。</p>
      {record && <p className="support-diagnostic-operation">操作编号 <code>{record.actionId || record.id}</code></p>}
      {code && <div className="support-diagnostic-code" role="status"><span>复制后，粘贴到公众号私信</span><code>{code.code}</code><small>有效至 {new Date(code.expires_at).toLocaleTimeString('zh-CN', { hour12: false })} · 首次使用后绑定该对话</small></div>}
      <p className="support-diagnostic-warning">诊断码相当于这一条记录的临时查询凭证，请勿公开。客服不需要你的密码或邮箱验证码。</p>
      {error && <p className="export-log-error" role="alert">{error}</p>}
      <div className="ui-confirm-actions"><Dialog.Close render={<Button variant="outline" />}>关闭</Dialog.Close>
        {needsLogin && onRequestLogin ? <Button onClick={() => { close(); onRequestLogin() }}>前往登录</Button> : code ? <Button onClick={() => void copy()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? '已复制' : '复制诊断消息'}</Button> : <Button disabled={busy} onClick={() => void generate()}>{busy ? '生成中…' : '同意并生成诊断码'}</Button>}
      </div>
    </Dialog.Popup></Dialog.Portal>
  </Dialog.Root>
}

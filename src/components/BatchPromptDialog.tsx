import { useId, useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Check, Copy, Sparkles, X } from 'lucide-react'
import { batchLimit } from '@/lib/batch'
import { buildBatchPrompt, DEFAULT_BATCH_PROMPT } from '@/lib/batch-prompt'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import './BatchPromptDialog.css'

export function BatchPromptDialog({ disabled = false }: { disabled?: boolean }) {
  const id = useId()
  const [topic, setTopic] = useState(DEFAULT_BATCH_PROMPT.topic)
  const [count, setCount] = useState(String(DEFAULT_BATCH_PROMPT.count))
  const [roles, setRoles] = useState(DEFAULT_BATCH_PROMPT.roles)
  const [copiedPrompt, setCopiedPrompt] = useState('')
  const [copyError, setCopyError] = useState(false)
  const [copying, setCopying] = useState(false)
  const outputRef = useRef<HTMLTextAreaElement>(null)
  const validCount = /^\d+$/.test(count) && Number(count) >= 1 && Number(count) <= batchLimit
  const prompt = buildBatchPrompt({ topic, count: Number(count), roles })
  const copied = copiedPrompt === prompt && validCount && !copyError

  async function copyPrompt() {
    if (!validCount || copying) return
    setCopying(true)
    setCopyError(false)
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPrompt(prompt)
    } catch {
      setCopyError(true)
      outputRef.current?.focus()
      outputRef.current?.select()
    } finally {
      setCopying(false)
    }
  }

  return <Dialog.Root onOpenChange={open => { if (open) { setCopyError(false); setCopiedPrompt('') } }}>
    <Dialog.Trigger disabled={disabled} render={<Button size="sm" variant="outline" />}><Sparkles size={14} /> 模板 Prompt</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="batch-prompt-backdrop" />
      <Dialog.Popup className="batch-prompt-dialog">
        <header className="batch-prompt-heading">
          <Dialog.Title>批量聊天模板 Prompt</Dialog.Title>
          <Dialog.Close render={<Button size="sm" variant="ghost" aria-label="关闭模板 Prompt" />}><X size={18} /></Dialog.Close>
        </header>
        <Dialog.Description className="batch-prompt-description">填写需求 → 复制给豆包 / DeepSeek 等 AI → 将 AI 返回的聊天文本粘贴到导入区。这里仅提供提示词，不会调用 AI 或扣除导出额度。</Dialog.Description>
        <div className="batch-prompt-body">
          <div className="batch-prompt-fields">
            <label className="batch-prompt-topic" htmlFor={`${id}-topic`}>主题 / 场景<Input id={`${id}-topic`} value={topic} maxLength={300} placeholder={DEFAULT_BATCH_PROMPT.topic} onChange={e => { setTopic(e.target.value); setCopyError(false) }} /></label>
            <label htmlFor={`${id}-count`}>聊天组数<Input id={`${id}-count`} inputMode="numeric" value={count} maxLength={3} aria-invalid={!validCount} aria-describedby={`${id}-count-hint`} onChange={e => { setCount(e.target.value); setCopyError(false) }} /></label>
            <label className="batch-prompt-roles" htmlFor={`${id}-roles`}>参与角色<Input id={`${id}-roles`} value={roles} maxLength={200} placeholder={DEFAULT_BATCH_PROMPT.roles} onChange={e => { setRoles(e.target.value); setCopyError(false) }} /></label>
          </div>
          <p id={`${id}-count-hint`} className={validCount ? 'batch-prompt-hint' : 'batch-prompt-error'}>{validCount ? '每次 1–50 组；姓名用顿号分隔，第一位为主要视角，导入后可在“头像与角色”调整。' : '请输入 1–50 之间的整数，再复制 Prompt。'}</p>
          <label className="batch-prompt-output-label" htmlFor={`${id}-output`}>完整 Prompt <span>可直接复制</span></label>
          <Textarea ref={outputRef} id={`${id}-output`} aria-label="完整批量聊天 Prompt" className="batch-prompt-output" readOnly value={validCount ? prompt : '请先填写有效的聊天组数（1–50），即可生成完整 Prompt。'} spellCheck={false} />
        </div>
        <footer className="batch-prompt-footer">
          <p role="status" className={copyError ? 'batch-prompt-error' : 'batch-prompt-hint'}>{copyError ? '复制失败，已选中完整 Prompt，请按 Ctrl+C / 长按复制。' : copied ? '已复制。将它发给 AI，再导入 AI 返回的聊天文本。' : '只导入 AI 的回复，不要把这段 Prompt 当作聊天记录导入。'}</p>
          <Button disabled={!validCount || copying} onClick={() => void copyPrompt()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copying ? '正在复制…' : copied ? '已复制 Prompt' : '复制 Prompt'}</Button>
        </footer>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}

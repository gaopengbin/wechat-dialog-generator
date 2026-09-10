import { parseChatRecord } from './parser'
import type { ChatUser, ChatMessage, PhoneSettings } from '../types'
export type CaptureMode = 'standard' | 'long'
export type ChatContent = { title: string; body: string }
export type ChatSnapshot = { users: ChatUser[]; messages: ChatMessage[]; selfId: number | null; settings: PhoneSettings }
export const batchLimit = 50

// AI replies often turn --- into a Markdown rule and collapse message newlines.
// Keep this recovery local to batch import; ordinary single-chat parsing is unchanged.
const inlineSender = /(?<=[。！？!?；;])[ \t]+(?=(?:\*\*)?[\p{L}_][\p{L}\p{N}_·-]{0,19}(?:\*\*)?[：:])/gu
const startsWithSender = /^(?:\*\*)?[\p{L}_][\p{L}\p{N}_·-]{0,19}(?:\*\*)?[：:]/u
function normalizeBatchBody(body: string): string {
  return body.split('\n').flatMap(raw => {
    let line = raw.trim().replace(/\\$/, '').trimEnd()
    const heading = line.match(/^#{2,6}\s+(.+)$/)
    const candidate = heading?.[1] ?? line
    const withoutTime = candidate.replace(/^(?:\*\*)?【[^】]+】(?:\*\*)?\s*/, '')
    const boundaries = [...withoutTime.matchAll(inlineSender)].length
    // A wrongly styled paragraph is not a new chat title. Plain paragraphs need
    // at least three message markers to avoid splitting a normal inline label.
    const paragraph = startsWithSender.test(withoutTime) && (boundaries >= 2 || (!!heading && boundaries >= 1))
    if (heading && (paragraph || /^(?:\*\*)?【/.test(candidate))) line = candidate
    if (paragraph) line = line.replace(inlineSender, '\n')
    return line.replace(/^((?:\*\*)?【[^】]+】(?:\*\*)?)[ \t]+/, '$1\n').split('\n')
  }).join('\n').trim()
}

export function parseBatch(text: string): ChatContent[] {
  const source = text.trim().replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
    .replace(/^```(?:text|plaintext|markdown|md)?[ \t]*\n([\s\S]*?)\n```[ \t]*$/i, '$1')
  const contents: ChatContent[] = []
  let title: string | undefined
  let lines: string[] = []
  const flush = () => {
    if (title === undefined && !lines.some(line => line.trim())) return
    contents.push({ title: title ?? `对话 ${contents.length + 1}`, body: normalizeBatchBody(lines.join('\n')) })
    title = undefined
    lines = []
  }
  for (const raw of source.split('\n')) {
    const line = raw.trim()
    if (/^(?:[-－—–]\s*){2,}$/.test(line) || /^(?:\*\s*){3,}$/.test(line) || /^(?:_\s*){3,}$/.test(line) || /^={3,}$/.test(line)) {
      flush()
      continue
    }
    const heading = line.match(/^#{1,6}(?:\s+(.*))?$/)
    if (heading && normalizeBatchBody(line) === line) {
      flush()
      title = (heading[1] ?? '').trim()
    } else {
      lines.push(line)
    }
  }
  flush()
  if (!contents.length) throw new Error('请先输入对话，用“# 聊天标题”或独立一行的 --- 分隔每组聊天。')
  if (contents.length > batchLimit) throw new Error(`每批最多 ${batchLimit} 张，请拆成多批制作。`)
  contents.forEach((content, index) => validateChat(content, index + 1))
  return contents
}
export function validateChat(card: ChatContent, index = 1) {
  if (!card.title.trim()) throw new Error(`第 ${index} 张缺少标题。`)
  if (Array.from(card.title).length > 40) throw new Error(`第 ${index} 张标题请控制在 40 字以内。`)
  if (card.body.length > 10000) throw new Error(`第 ${index} 组对话请控制在 10000 字以内。`)
  const parsed = parseChatRecord(card.body)
  if (!parsed.users.length || !parsed.messages.some(m => m.type !== 'time')) throw new Error(`第 ${index} 组没有有效对话，请按“姓名：消息内容”填写。`)
  if (parsed.messages.length > 150) throw new Error(`第 ${index} 组超过 150 条消息，请拆分后导入。`)
}
export function chatSnapshot(content: ChatContent, settings: PhoneSettings, avatars: ChatUser[], originalSelf: number | null): ChatSnapshot {
  validateChat(content)
  const parsed = parseChatRecord(content.body)
  const users = parsed.users.map(user => ({ ...user, avatar: avatars.find(a => a.name === user.name)?.avatar || (user.name === '我' ? avatars.find(a => a.id === originalSelf)?.avatar : null) || null }))
  const selfName = avatars.find(a => a.id === originalSelf)?.name
  return { ...parsed, users, selfId: users.find(u => u.name === selfName)?.id ?? users[0]?.id ?? null, settings: { ...settings, contactName: content.title } }
}
export function cardFilename(index: number, title: string) {
  // Filesystem names must exclude control characters as well as path separators.
  // eslint-disable-next-line no-control-regex
  return `${String(index + 1).padStart(3, '0')}_${title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 40) || '卡片'}.png`
}

// Uncompressed ZIP: PNG is already compressed. Keep dependencies and peak memory small.
export function zipImages(files: { name: string; bytes: Uint8Array }[]) {
  const encoder = new TextEncoder()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  const directory: Uint8Array<ArrayBuffer>[] = []
  let offset = 0
  for (const file of files) {
    const name = encoder.encode(file.name)
    const crc = crc32(file.bytes)
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x800, true)
    lv.setUint32(14, crc, true); lv.setUint32(18, file.bytes.length, true); lv.setUint32(22, file.bytes.length, true)
    lv.setUint16(26, name.length, true); local.set(name, 30)
    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true)
    cv.setUint32(16, crc, true); cv.setUint32(20, file.bytes.length, true); cv.setUint32(24, file.bytes.length, true)
    cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); central.set(name, 46)
    chunks.push(local, new Uint8Array(file.bytes)); directory.push(central)
    offset += local.length + file.bytes.length
  }
  const end = new Uint8Array(22); const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true)
  ev.setUint32(12, directory.reduce((sum, entry) => sum + entry.length, 0), true); ev.setUint32(16, offset, true)
  return new Blob([...chunks, ...directory, end], { type: 'application/zip' })
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export type BatchJob = { id: string; content: ChatContent; mode: CaptureMode; snapshot?: ChatSnapshot; selected: boolean; state: 'ready' | 'working' | 'done' | 'error'; locked?: boolean; dirty?: boolean; error?: string; bytes?: Uint8Array }
// A failed/ambiguous debit keeps the same id for retry; rendered successes stay cached.
export async function runBatch(jobs: BatchJob[], deps: {
  render: (job: BatchJob) => Promise<Uint8Array>
  debit: (id: string) => Promise<void>
  cancelled: () => boolean
  update: () => void
  complete: (id: string) => void
  result?: (job: BatchJob) => void
}) {
  for (const job of jobs.filter(j => j.selected && j.state !== 'done')) {
    if (deps.cancelled()) break
    job.state = 'working'; job.error = undefined; deps.update()
    try {
      const bytes = await deps.render(job)
      if (deps.cancelled()) { job.state = 'ready'; deps.update(); break }
      job.locked = true
      await deps.debit(job.id)
      job.bytes = bytes; job.state = 'done'; deps.update()
      // Reward confirmation/telemetry must not turn a charged, cached image into a retry.
      try { deps.complete(job.id) } catch { /* Image remains available for download. */ }
    } catch (error) {
      job.state = 'error'; job.error = error instanceof Error ? error.message : '生成失败，请重试'; deps.update()
      // On debit uncertainty, stop the queue rather than issuing more potentially charged requests.
      if (job.locked) break
    } finally {
      try { deps.result?.(job) } catch { /* Logging must not affect quota or retries. */ }
    }
  }
}

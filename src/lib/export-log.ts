import type { WechatTool } from './product-analytics'

export const exportLogDatabase = 'wechat-toolbox-export-log'
export const exportLogChanged = 'wechat-toolbox:export-log-changed'
export const exportLogError = 'wechat-toolbox:export-log-error'
export type ExportOutcome = 'pending' | 'generated' | 'download_requested' | 'copied' | 'failed' | 'cancelled'
export type ExportMode = 'standard' | 'long' | 'clipboard' | 'zip'
export interface ExportLog {
  id: string
  tool: WechatTool
  mode: ExportMode
  filename: string
  count: number
  startedAt: string
  finishedAt?: string
  outcome: ExportOutcome
  note: string
}
export const exportOutcomes: Record<ExportOutcome, string> = {
  pending: '结果未确认', generated: '已生成', download_requested: '已发起下载', copied: '已复制', failed: '失败', cancelled: '未导出',
}
export const exportModes: Record<ExportMode, string> = { standard: '标准 PNG', long: '长图 PNG', clipboard: '剪贴板', zip: 'ZIP 打包' }

async function withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(exportLogDatabase, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('logs', { keyPath: 'id' })
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result) }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('日志数据库被其他页面占用'))
  })
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction('logs', mode)
      const request = operation(tx.objectStore('logs'))
      tx.oncomplete = () => resolve(request.result)
      tx.onabort = () => reject(tx.error || new Error('日志保存中断'))
      tx.onerror = () => reject(tx.error || new Error('日志保存失败'))
    })
  } finally { database.close() }
}
export async function listExportLogs() {
  const records = await withStore<ExportLog[]>('readonly', store => store.getAll())
  return records.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}
export async function clearExportLogs() {
  await withStore('readwrite', store => store.clear())
  window.dispatchEvent(new Event(exportLogChanged))
}
async function writeExportLog(record: ExportLog) {
  await withStore('readwrite', store => store.put(record))
  window.dispatchEvent(new Event(exportLogChanged))
}

// Independent of analytics/account APIs: metadata stays in this browser. Log
// failures never convert a successful export into a failed export or a retry.
export function createExportLogger(write: (record: ExportLog) => Promise<unknown>, onError: () => void) {
  return (input: Pick<ExportLog, 'tool' | 'mode'> & Partial<Pick<ExportLog, 'filename' | 'count'>>) => {
    const record: ExportLog = { id: crypto.randomUUID(), tool: input.tool, mode: input.mode, filename: input.filename || '', count: input.count ?? 1, startedAt: new Date().toISOString(), outcome: 'pending', note: '' }
    const safelyWrite = (value: ExportLog) => Promise.resolve().then(() => write(value)).catch(() => { try { onError() } catch { /* reporting is best effort */ } })
    let tail = safelyWrite({ ...record })
    let finished = false
    return {
      id: record.id,
      finish(outcome: Exclude<ExportOutcome, 'pending'>, note = '') {
        if (finished) return tail
        finished = true
        const result = { ...record, outcome, note, finishedAt: new Date().toISOString() }
        tail = tail.then(() => safelyWrite(result))
        return tail
      },
    }
  }
}
export const beginExportLog = createExportLogger(writeExportLog, () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(exportLogError))
})

export function filterExportLogs(records: ExportLog[], filters: { tool: string; outcome: string; days: string; search: string }, now = new Date()) {
  const cutoff = new Date(now)
  cutoff.setHours(0, 0, 0, 0)
  if (filters.days === '7') cutoff.setDate(cutoff.getDate() - 6)
  const search = filters.search.trim().toLocaleLowerCase()
  return records.filter(record => (filters.tool === 'all' || record.tool === filters.tool)
    && (filters.outcome === 'all' || record.outcome === filters.outcome)
    && (filters.days === 'all' || new Date(record.startedAt) >= cutoff)
    && (!search || record.filename.toLocaleLowerCase().includes(search)))
}

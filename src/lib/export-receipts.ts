import { withRequestTimeout } from './request-timeout'
// Only successful local exports enter this outbox. Never store credentials,
// image bytes or chat content, and never call quota/consume from this module.
export interface ExportReceipt {
  actionId: string
  userId: string
  createdAt: number
  attempts: number
  nextAttemptAt: number
  blocked?: 'auth' | 'invalid'
}
export interface ReceiptIdentity { userId: string; credential: string }
export interface ReceiptStore {
  list(): ExportReceipt[]
  put(item: ExportReceipt): boolean
  remove(item: ExportReceipt): void
}
const prefix = 'wechat-toolbox:export-receipt:v1:'
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
function valid(item: ExportReceipt) {
  return item && typeof item.userId === 'string' && item.userId.length > 0 && item.userId.length <= 128 &&
    typeof item.actionId === 'string' && uuid.test(item.actionId) &&
    Number.isFinite(item.createdAt) && Number.isSafeInteger(item.attempts) && item.attempts >= 0 &&
    Number.isFinite(item.nextAttemptAt) && [undefined, 'auth', 'invalid'].includes(item.blocked)
}

export function createReceiptStore(storage: () => Storage, namespace = prefix): ReceiptStore {
  const key = (item: Pick<ExportReceipt, 'userId' | 'actionId'>) => namespace + encodeURIComponent(item.userId) + ':' + item.actionId
  const memory = new Map<string, ExportReceipt>()
  const removed = new Set<string>()
  return {
    list() {
      const items = new Map<string, ExportReceipt>()
      try {
        const disk = storage()
        for (let i = 0; i < disk.length; i++) {
          const name = disk.key(i)
          if (!name?.startsWith(namespace) || removed.has(name)) continue
          try {
            const item = JSON.parse(disk.getItem(name) || 'null') as ExportReceipt
            if (valid(item) && name === key(item)) items.set(name, item)
          } catch { /* An invalid entry cannot block other receipts. */ }
        }
      } catch { /* In-memory retry remains available when storage is blocked. */ }
      for (const [name, item] of memory) items.set(name, item)
      return [...items.values()]
    },
    put(item) {
      memory.set(key(item), { ...item })
      removed.delete(key(item))
      try { storage().setItem(key(item), JSON.stringify(item)); return true } catch { return false }
    },
    remove(item) {
      memory.delete(key(item)); removed.add(key(item))
      try { storage().removeItem(key(item)) } catch { /* Replays remain server-idempotent. */ }
    },
  }
}

export function createExportReceiptQueue(options: {
  store: ReceiptStore
  identity: () => ReceiptIdentity | null
  confirm: (actionId: string, identity: ReceiptIdentity, signal?: AbortSignal) => Promise<unknown>
  attemptTimeoutMs?: number
  online?: () => boolean
  now?: () => number
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>
  cancel?: (timer: ReturnType<typeof setTimeout>) => void
  onPending?: () => void
  onAuthRequired?: () => void
  onRejected?: () => void
  onStorageUnavailable?: () => void
}) {
  const now = options.now || Date.now
  const schedule = options.schedule || setTimeout
  const cancel = options.cancel || clearTimeout
  const authFailures = new Map<string, string>() // memory only, never persisted
  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight: Promise<void> | null = null
  let activeAttempt: { controller: AbortController; deadline: number } | null = null
  let stopped = false, storageWarning = false
  const persist = (item: ExportReceipt) => {
    if (!options.store.put(item) && !storageWarning) {
      storageWarning = true
      try { options.onStorageUnavailable?.() } catch { /* Notification is best effort. */ }
    }
  }
  function eligible() {
    const identity = options.identity()
    if (!identity || !identity.credential || options.online?.() === false ||
      authFailures.get(identity.userId) === identity.credential) return []
    return options.store.list().filter(item => item.userId === identity.userId && item.blocked !== 'invalid' &&
      !(item.blocked === 'auth' && authFailures.get(item.userId) === identity.credential))
  }
  function arm() {
    if (timer !== undefined) cancel(timer)
    timer = undefined
    if (stopped) return
    const items = eligible()
    if (!items.length) return
    const due = Math.min(...items.map(item => item.blocked === 'auth' ? 0 : item.nextAttemptAt))
    timer = schedule(() => { timer = undefined; void flush() }, Math.max(0, due - now()))
  }
  async function run() {
    // Serial attempts and bounded batches avoid bursts when reconnecting.
    for (const item of eligible().filter(item => item.blocked === 'auth' || item.nextAttemptAt <= now())
      .sort((a, b) => a.createdAt - b.createdAt).slice(0, 10)) {
      if (stopped) break
      const identity = options.identity()
      if (!identity || identity.userId !== item.userId || options.online?.() === false) break
      if (authFailures.get(item.userId) === identity.credential) break
      if (item.blocked !== 'auth' && item.nextAttemptAt > now()) continue
      try {
        const attempt = { controller: new AbortController(), deadline: now() + (options.attemptTimeoutMs ?? 25_000) }
        activeAttempt = attempt
        await withRequestTimeout(signal => options.confirm(item.actionId, identity, signal), options.attemptTimeoutMs ?? 25_000, attempt.controller.signal)
        options.store.remove(item)
      } catch (error) {
        if (stopped) break // Keep the same pending ID; do not notify after unmount.
        const e = error as { status?: number; code?: string }
        const next: ExportReceipt = { ...item, blocked: undefined, attempts: item.attempts + 1,
          nextAttemptAt: now() + Math.min(300_000, 2000 * 2 ** Math.min(item.attempts, 8)) }
        if (e?.status === 401 || e?.status === 403 || e?.code === 'account_changed') {
          next.blocked = 'auth'; authFailures.set(item.userId, identity.credential)
        } else if (e?.status && e.status >= 400 && e.status < 500 && ![408, 429].includes(e.status)) {
          next.blocked = 'invalid' // Retain evidence; never create a replacement debit.
        }
        persist(next)
        if (item.attempts === 0 || next.blocked === 'invalid' || next.blocked === 'auth') try {
          if (next.blocked === 'invalid') options.onRejected?.()
          else if (next.blocked === 'auth') {
            const current = options.identity()
            if (current?.userId === identity.userId && current.credential === identity.credential) options.onAuthRequired?.()
          }
          else options.onPending?.()
        } catch { /* Best effort. */ }
      } finally { activeAttempt = null }
    }
  }
  function flush(): Promise<void> {
    if (stopped) return Promise.resolve()
    if (inFlight) return inFlight
    inFlight = run().finally(() => {
      inFlight = null
      arm()
    })
    return inFlight
  }
  return {
    enqueue(actionId: string, userId: string) {
      const item: ExportReceipt = { actionId, userId, createdAt: now(), attempts: 0, nextAttemptAt: now() }
      if (!valid(item)) return
      if (!options.store.list().some(x => x.userId === userId && x.actionId === actionId)) persist(item)
      void flush()
    },
    flush,
    resume() {
      if (activeAttempt && activeAttempt.deadline <= now()) {
        activeAttempt.controller.abort(new DOMException('确认同步已超时', 'TimeoutError'))
        return (inFlight || Promise.resolve()).then(() => flush())
      }
      return flush()
    },
    start() { stopped = false; void flush() },
    stop() { stopped = true; activeAttempt?.controller.abort(); if (timer !== undefined) cancel(timer); timer = undefined },
  }
}

// Closed vocabulary only: never send exception text, stack, URLs or user content.
export function exportReason(error: unknown): string {
  try {
    const e = error as { name?: string; message?: string }
    const text = String(e?.message || '')
    if (/16000|对话过长/.test(text)) return 'image_too_large'
    if (e?.name === 'SecurityError' || /taint|cross.origin/i.test(text)) return 'security'
    if (e?.name === 'NotAllowedError') return 'permission'
    if (e?.name === 'QuotaExceededError') return 'storage_full'
    if (e?.name === 'TimeoutError') return 'timeout'
    if (e?.name === 'AbortError') return 'aborted'
    if (/fetch|network|load.*image/i.test(text)) return 'resource_load'
    if (e?.name === 'TypeError') return 'type_error'
  } catch { /* hostile or unusual exception objects */ }
  return 'unknown'
}

export function browserFamily(ua: string): string {
  for (const [name, pattern] of [
    ['wechat', /MicroMessenger\/(\d+)/], ['edge', /Edg(?:A|iOS)?\/(\d+)/],
    ['chrome', /(?:Chrome|CriOS)\/(\d+)/], ['firefox', /(?:Firefox|FxiOS)\/(\d+)/],
    ['safari', /Version\/(\d+).*Safari/],
  ] as const) {
    const match = ua.match(pattern)
    if (match) return `${name}-${match[1].slice(0, 3)}`
  }
  return 'unknown'
}

export type ExportStage = 'render' | 'authorize' | 'encode' | 'download' | 'clipboard' | 'zip'

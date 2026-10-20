// Closed vocabulary only: never send exception text, stack, URLs or user content.
export function exportReason(error: unknown): string {
  try {
    const e = error as { name?: string; message?: string }
    const text = String(e?.message || '')
    if ((error as { exportReason?: string })?.exportReason && ['preview_missing','resource_load','render_failed'].includes((error as { exportReason: string }).exportReason)) return (error as { exportReason: string }).exportReason
    if (/16000|对话过长/.test(text)) return 'image_too_large'
    if (e?.name === 'SecurityError' || /taint|cross.origin/i.test(text)) return 'security'
    if (e?.name === 'NotAllowedError') return 'permission'
    if (e?.name === 'QuotaExceededError') return 'storage_full'
    if (e?.name === 'TimeoutError') return 'timeout'
    if (e?.name === 'AbortError') return 'aborted'
    if (/fetch|network|load.*image|Resource .*not found/i.test(text) || (error as { type?: string })?.type === 'error') return 'resource_load'
    if (e?.name === 'TypeError') return 'type_error'
  } catch { /* hostile or unusual exception objects */ }
  return 'unknown'
}

export function exportDetails(error: unknown): { error_kind: string; render_step: string } {
  try {
    const e = error as { name?: string; type?: string; renderStep?: string; diagnosticKind?: string }
    const kind = error == null ? 'missing_exception' : e?.type === 'error' ? 'resource_event'
      : typeof DOMException !== 'undefined' && error instanceof DOMException ? 'dom_exception'
      : error instanceof Error ? 'error' : 'non_error'
    return { error_kind: ['missing_exception','resource_event','dom_exception','error','non_error'].includes(e?.diagnosticKind || '') ? e.diagnosticKind! : kind, render_step: ['preview','asset_embed','svg_rasterize','capture'].includes(e?.renderStep || '') ? e.renderStep! : 'none' }
  } catch { return { error_kind: 'non_error', render_step: 'none' } }
}

export function renderFailure(error: unknown, step = 'capture') {
  const reason = exportReason(error)
  return Object.assign(new Error('图片渲染失败，请刷新后重试或重新上传图片。'), {
    exportReason: reason === 'unknown' ? 'render_failed' : reason,
    renderStep: (error as { renderStep?: string })?.renderStep || (step !== 'capture' ? step : (error as { type?: string })?.type === 'error' ? 'svg_rasterize' : step),
    diagnosticKind: exportDetails(error).error_kind,
  })
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

// Closed vocabulary only: never send exception text, stack, URLs or user content.
export function exportReason(error: unknown): string {
  try {
    const e = error as { name?: string; message?: string }
    const text = String(e?.message || '')
    if ((error as { exportReason?: string })?.exportReason && ['preview_missing','resource_load','render_failed','image_too_large','security','permission','storage_full','timeout','aborted','type_error'].includes((error as { exportReason: string }).exportReason)) return (error as { exportReason: string }).exportReason
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

export const captureDiagnosticValues: Record<string, readonly string[]> = {
  failure_code: ['asset_fetch','asset_http','asset_decode','asset_timeout','asset_embed','svg_build','svg_decode','canvas_context','canvas_draw','capture_timeout'],
  asset_kind: ['avatar','message','background','chrome','other'],
  asset_scheme: ['data','blob','same_origin','remote','other'],
  asset_phase: ['fetch','body','decode','pixels','embed'],
  capture_size: ['phone','long','over_limit'],
}

export function exportDetails(error: unknown): { error_kind: string; render_step: string; [key: string]: string } {
  try {
    const e = error as { name?: string; type?: string; renderStep?: string; diagnosticKind?: string; captureInfo?: Record<string, unknown> }
    const kind = error == null ? 'missing_exception' : e?.type === 'error' ? 'resource_event'
      : typeof DOMException !== 'undefined' && error instanceof DOMException ? 'dom_exception'
      : error instanceof Error ? 'error' : 'non_error'
    const metadata: Record<string,string> = {}
    for (const [key, values] of Object.entries(captureDiagnosticValues)) {
      const value = e?.captureInfo?.[key]
      if (typeof value === 'string' && values.includes(value)) metadata[key] = value
    }
    return { error_kind: ['missing_exception','resource_event','dom_exception','error','non_error'].includes(e?.diagnosticKind || '') ? e.diagnosticKind! : kind, render_step: ['preview','asset_embed','svg_rasterize','capture'].includes(e?.renderStep || '') ? e.renderStep! : 'none', ...metadata }
  } catch { return { error_kind: 'non_error', render_step: 'none' } }
}

export function renderFailure(error: unknown, step = 'capture') {
  const reason = exportReason(error)
  const message = reason === 'image_too_large'
    ? '本组长图超过 16000 像素，请拆成多组或改用标准截图后重试；本次未扣额度。'
    : reason === 'resource_load'
      ? exportDetails(error).asset_scheme === 'remote'
        ? '外链图片无法用于导出，可能是网络或跨域限制。请将原图下载后重新上传；本次未扣额度。'
        : '图片资源加载失败，请检查网络或重新上传相关图片后重试；本次未扣额度。'
      : '图片渲染失败，请刷新后重试或重新上传图片。'
  return Object.assign(new Error(message), {
    exportReason: reason === 'unknown' ? 'render_failed' : reason,
    renderStep: (error as { renderStep?: string })?.renderStep || (step !== 'capture' ? step : (error as { type?: string })?.type === 'error' ? 'svg_rasterize' : step),
    diagnosticKind: exportDetails(error).error_kind,
    captureInfo: exportDetails(error),
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

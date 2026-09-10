import { trackProductEvent } from './product-analytics'
export const growthEvents = ['promotion_viewed', 'promotion_clicked', 'share_dialog_viewed', 'share_action', 'account_form_viewed', 'account_form_closed', 'account_request', 'invite_landing_viewed'] as const
export type GrowthEvent = typeof growthEvents[number]
export function growthReason(error: unknown) {
  const e = error as { status?: number; code?: string; name?: string }
  if (e?.name === 'AbortError') return 'cancelled'
  if (e?.name === 'TimeoutError') return 'timeout'
  if (e?.status === 429) return 'rate_limit'
  if (e?.code === 'invalid_email_code') return 'invalid_code'
  if (e?.status === 401 || e?.status === 403) return 'auth'
  if (e?.status && e.status >= 500) return 'server'
  if (e?.status && e.status >= 400) return 'validation'
  return 'network'
}
export function trackGrowthEvent(event: GrowthEvent, properties: Record<string, string> = {}) {
  void trackProductEvent(event, properties)
}
export async function measureGrowthRequest<T>(action: string, operation: () => Promise<T>, emit = trackGrowthEvent) {
  emit('account_request', { action, outcome: 'started', reason: 'none' })
  try {
    const result = await operation()
    emit('account_request', { action, outcome: action.startsWith('code_') ? 'accepted' : 'succeeded', reason: 'none' })
    return result
  } catch (error) {
    emit('account_request', { action, outcome: 'failed', reason: growthReason(error) })
    throw error
  }
}

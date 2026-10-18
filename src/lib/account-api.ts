import { measureGrowthRequest } from './growth-analytics'
import { withRequestTimeout } from './request-timeout'
const apiRoot = import.meta.env.VITE_ACCOUNT_API_ENDPOINT ||
  (['gaopengbin.github.io', 'chat.laogao.xyz'].includes(window.location.hostname)
    ? 'https://laogao.xyz/platform-api/v1'
    : 'http://127.0.0.1:9092/platform-api/v1')

const tokenStorageKey = 'wechat-dialog-generator:account-token'
const authenticatedCredentials = new Map<string, string>()
export type ExportIdentity = { userId: string | null; credential: string }
export function captureExportIdentity(session: AccountSession | null): ExportIdentity {
  return { userId: session?.user.id ?? null, credential: session ? authenticatedCredentials.get(session.user.id) ?? '\u0000' : '' }
}
export function isExportIdentityCurrent(identity: ExportIdentity) {
  return token() === identity.credential
}
export function assertExportIdentity(identity: ExportIdentity) {
  if (!isExportIdentityCurrent(identity)) throw new AccountApiError(409, 'account_changed', '登录状态已变化，操作已停止。请刷新账户状态后，在原账号重试。')
}

export function requireExportLogin(identity: ExportIdentity) {
  if (!identity.userId || !identity.credential) throw new AccountApiError(401, 'login_required', '请先登录后导出，编辑内容和预览会保留。')
  assertExportIdentity(identity)
}

export interface AccountUser {
  id: string
  email: string
  display_name: string
  created_at: string
  email_verified_at: string | null
}

export interface ExportQuota {
  daily_limit: number
  daily_used: number
  daily_remaining: number
  bonus_remaining: number
  paid_remaining?: number
  membership?: { active: boolean; expires_at: string | null }
  total_remaining: number
  resets_at: string
}

export interface AccountSession {
  user: AccountUser
  quota: ExportQuota
}

export class AccountApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function token() {
  try {
    return localStorage.getItem(tokenStorageKey) ?? ''
  } catch {
    return ''
  }
}

function request<T>(path: string, options: RequestInit = {}, credential?: string): Promise<T> {
  const actions: Record<string, string> = { '/auth/register': 'register', '/auth/login': 'login', '/auth/email/verify': 'bind', '/auth/password/reset': 'reset', '/growth/invite': 'invite_create', '/growth/revoke': 'invite_revoke', '/growth/visit': 'invite_visit', '/quota/complete': 'export_complete' }
  let action = actions[path]
  if (path === '/auth/email-code') {
    const purpose = JSON.parse(String(options.body || '{}')).purpose
    if (['register', 'bind', 'reset'].includes(purpose)) action = `code_${purpose}`
  }
  if (!action) return rawRequest<T>(path, options, credential)
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const trace = { request_id: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''), stage: 'sending',
    ...(path === '/quota/complete' ? { action_id: String(JSON.parse(String(options.body || '{}')).action_id) } : {}) }
  return measureGrowthRequest(action, () => rawRequest<T>(path, options, credential, trace), undefined, trace)
}
async function rawRequest<T>(path: string, options: RequestInit = {}, credential?: string, trace?: { request_id: string; stage: string }) {
  if (credential !== undefined) assertExportIdentity({ userId: null, credential })
  const sessionToken = credential ?? token()
  try {
    return await withRequestTimeout(async signal => {
      const response = await fetch(`${apiRoot}${path}`, {
        ...options,
        ...(path === '/quota/complete' ? { keepalive: true } : {}),
        signal,
        headers: {
          ...(options.body ? { 'content-type': 'application/json' } : {}),
          ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
          ...options.headers,
          ...(trace ? { 'x-client-request-id': trace.request_id } : {}),
        },
      })
      if (trace) trace.stage = 'headers_received'
      const payload = await response.json().catch(error => {
        if (signal.aborted) throw error
        if (response.ok) throw new Error('服务响应不完整，请重试')
        return {}
      }) as T & {
        error?: { code?: string; message?: string }
      }
      if (trace) trace.stage = 'response_received'
      if (!response.ok) {
        throw new AccountApiError(
          response.status,
          payload.error?.code ?? 'request_failed',
          payload.error?.message ?? '请求失败，请稍后重试',
        )
      }
      return payload
    }, 20000, options.signal)
  } catch (error) {
    const failure = error instanceof TypeError ? new TypeError('暂时无法连接服务，请检查网络后重试。') : error
    if (trace && failure instanceof Error) failure.message += `（排查编号：${trace.request_id}）`
    throw failure
  }
}

function saveToken(value: string) {
  localStorage.setItem(tokenStorageKey, value)
}

export async function registerAccount(email: string, password: string, displayName: string, challenge_id: string, code: string) {
  const result = await request<AccountSession & { token: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name: displayName, challenge_id, code, invite_code: pendingInvite() }),
  })
  saveToken(result.token)
  authenticatedCredentials.set(result.user.id, result.token)
  return { user: result.user, quota: result.quota }
}

export async function loginAccount(email: string, password: string) {
  const result = await request<AccountSession & { token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  saveToken(result.token)
  authenticatedCredentials.set(result.user.id, result.token)
  return { user: result.user, quota: result.quota }
}

export async function restoreAccount() {
  const credential = token()
  if (!credential) return null
  try {
    const session = await request<AccountSession>('/auth/me', {}, credential)
    if (token() !== credential) return null
    authenticatedCredentials.set(session.user.id, credential)
    return session
  } catch (error) {
    if (error instanceof AccountApiError && error.status === 401) {
      if (token() === credential) localStorage.removeItem(tokenStorageKey)
      return null
    }
    throw error
  }
}

export async function logoutAccount() {
  try {
    await request<{ ok: boolean }>('/auth/logout', { method: 'POST' })
  } finally {
    localStorage.removeItem(tokenStorageKey)
  }
}

export async function consumeAccountExport(action_id: string = crypto.randomUUID(), identity?: ExportIdentity) {
  if (!token()) throw new AccountApiError(401, 'login_required', '请先登录后导出，编辑内容和预览会保留。')
  if (identity) requireExportLogin(identity)
  const result = await request<{ consumed: boolean; source: string; quota: ExportQuota }>('/quota/consume', {
    method: 'POST',
    body: JSON.stringify({ action_id }),
  }, identity?.credential)
  return { quota: result.quota, action_id }
}

const post = <T>(path: string, body: object) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })
export type PaymentProduct = { id: string; amount_fen: number; credits: number; subject: string; kind?: 'credits' | 'membership'; duration_days?: number; regular_amount_fen?: number; purchasable?: boolean }
export type PaymentCampaign = { active: boolean; starts_at: string; ends_at: string; server_now: string }
export type PaymentState = 'pending' | 'paid' | 'closed' | 'refunding' | 'refunded'
export type PaymentTiming = { expires_at?: string; checkout_expired?: boolean; server_now?: string }
export type PaymentOrder = PaymentTiming & { id: string; product_id: string; amount_fen: number; credits: number; state: PaymentState; created_at: string; paid_at: string | null; kind?: 'credits' | 'membership'; duration_days?: number; subject?: string }
export const getPaymentProducts = () => request<{ available: boolean; products: PaymentProduct[]; campaign?: PaymentCampaign | null }>('/payments/products')
const paymentPost = <T>(path: string, body: object, identity?: ExportIdentity) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }, identity?.credential)
export const getPaymentOrders = (identity?: ExportIdentity) => request<{ orders: PaymentOrder[] }>('/payments/orders', {}, identity?.credential)
export const createPaymentOrder = (product_id: string, request_id: string, expected_amount_fen?: number, identity?: ExportIdentity) => paymentPost<PaymentTiming & { order_id: string; state: PaymentState; checkout_url?: string }>('/payments/orders', { product_id, request_id, ...(expected_amount_fen === undefined ? {} : { expected_amount_fen }) }, identity)
export const refreshPaymentOrder = (order_id: string, identity?: ExportIdentity) => paymentPost<PaymentTiming & { order_id: string; state: PaymentState; quota: ExportQuota }>('/payments/refresh', { order_id }, identity)
export const resumePaymentOrder = (order_id: string, identity?: ExportIdentity) => paymentPost<PaymentTiming & { order_id: string; state: PaymentState; checkout_url?: string }>('/payments/checkout', { order_id }, identity)
export const requestEmailCode = (email: string, purpose: 'register' | 'bind' | 'reset') => post<{ challenge_id: string; retry_after: number; message: string }>('/auth/email-code', { email, purpose })
export const verifyAccountEmail = (email: string, challenge_id: string, code: string) => post<AccountSession & { granted: number }>('/auth/email/verify', { email, challenge_id, code })
export const resetAccountPassword = (email: string, password: string, challenge_id: string, code: string) => post<{ ok: boolean }>('/auth/password/reset', { email, password, challenge_id, code })
export type Reward = { kind: string; amount: number; created_at: string }
export const getRewards = () => request<{ rewards: Reward[] }>('/rewards')
export type Growth = { links: { code: string; created_at: string; revoked_at: string | null }[]; invited: number; rewarded: number }
export const getGrowth = () => request<Growth>('/growth')
export const createInvite = () => post<{ code: string }>('/growth/invite', {})
export const revokeInvite = (code: string) => post('/growth/revoke', { code })
export const visitInvite = (code: string) => post('/growth/visit', { code })
export const completeAccountExport = (action_id: string, identity?: ExportIdentity) => {
  if (identity) assertExportIdentity(identity)
  return request<{ ok: boolean }>('/quota/complete', { method: 'POST', body: JSON.stringify({ action_id }) }, identity?.credential)
    .then(result => { if (result?.ok !== true) throw new Error('导出确认响应不完整'); return result })
}
export function pendingInvite() {
  try {
    const code = new URL(window.location.href).searchParams.get('invite')
    if (code && /^[\w-]{16}$/.test(code)) sessionStorage.setItem('toolbox:invite', JSON.stringify({ code, at: Date.now() }))
    const stored = JSON.parse(sessionStorage.getItem('toolbox:invite') || 'null') as { code: string; at: number } | null
    return stored && Date.now() - stored.at < 7 * 86400000 ? stored.code : ''
  } catch { return '' }
}

export async function redeemFollowBonus(code: string) {
  return request<{ granted: number; quota: ExportQuota }>('/quota/redeem', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export function loggedOutQuota(): ExportQuota {
  return {
    daily_limit: 0,
    daily_used: 0,
    daily_remaining: 0,
    bonus_remaining: 0,
    total_remaining: 0,
    resets_at: '',
  }
}

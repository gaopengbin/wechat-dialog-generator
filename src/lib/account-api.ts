const apiRoot = import.meta.env.VITE_ACCOUNT_API_ENDPOINT ||
  (['gaopengbin.github.io', 'chat.laogao.xyz'].includes(window.location.hostname)
    ? 'https://laogao.xyz/platform-api/v1'
    : 'http://127.0.0.1:9092/platform-api/v1')

const tokenStorageKey = 'wechat-dialog-generator:account-token'
const guestUsageStorageKey = 'wechat-dialog-generator:guest-export-usage'

export interface AccountUser {
  id: string
  email: string
  display_name: string
  created_at: string
}

export interface ExportQuota {
  daily_limit: number
  daily_used: number
  daily_remaining: number
  bonus_remaining: number
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

async function request<T>(path: string, options: RequestInit = {}) {
  const sessionToken = token()
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
      ...options.headers,
    },
  })
  const payload = await response.json().catch(() => ({})) as T & {
    error?: { code?: string; message?: string }
  }
  if (!response.ok) {
    throw new AccountApiError(
      response.status,
      payload.error?.code ?? 'request_failed',
      payload.error?.message ?? '请求失败，请稍后重试',
    )
  }
  return payload
}

function saveToken(value: string) {
  localStorage.setItem(tokenStorageKey, value)
}

export async function registerAccount(email: string, password: string, displayName: string) {
  const result = await request<AccountSession & { token: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name: displayName }),
  })
  saveToken(result.token)
  return { user: result.user, quota: result.quota }
}

export async function loginAccount(email: string, password: string) {
  const result = await request<AccountSession & { token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  saveToken(result.token)
  return { user: result.user, quota: result.quota }
}

export async function restoreAccount() {
  if (!token()) return null
  try {
    return await request<AccountSession>('/auth/me')
  } catch (error) {
    if (error instanceof AccountApiError && error.status === 401) {
      localStorage.removeItem(tokenStorageKey)
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

export async function consumeAccountExport() {
  const result = await request<{ consumed: boolean; source: string; quota: ExportQuota }>('/quota/consume', {
    method: 'POST',
    body: JSON.stringify({ action_id: crypto.randomUUID() }),
  })
  return result.quota
}

export async function redeemFollowBonus(code: string) {
  return request<{ granted: number; quota: ExportQuota }>('/quota/redeem', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

function localDay() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function guestQuota(): ExportQuota {
  const day = localDay()
  let used = 0
  try {
    const stored = JSON.parse(localStorage.getItem(guestUsageStorageKey) ?? '{}') as { day?: string; used?: number }
    if (stored.day === day) used = Math.max(0, Math.min(10, Number(stored.used) || 0))
  } catch {
    used = 0
  }
  const tomorrow = new Date()
  tomorrow.setHours(24, 0, 0, 0)
  return {
    daily_limit: 10,
    daily_used: used,
    daily_remaining: 10 - used,
    bonus_remaining: 0,
    total_remaining: 10 - used,
    resets_at: tomorrow.toISOString(),
  }
}

export function consumeGuestExport() {
  const current = guestQuota()
  if (current.daily_remaining <= 0) {
    throw new AccountApiError(402, 'quota_exhausted', '今日 10 次免费导出额度已用完，登录后可继续领取额度')
  }
  const next = current.daily_used + 1
  localStorage.setItem(guestUsageStorageKey, JSON.stringify({ day: localDay(), used: next }))
  return guestQuota()
}

const endpoint = import.meta.env.VITE_PRODUCT_ANALYTICS_ENDPOINT ||
  (['gaopengbin.github.io', 'chat.laogao.xyz'].includes(window.location.hostname)
    ? 'https://laogao.xyz/platform-api/v1/product-events'
    : '')

const visitorStorageKey = 'wechat-dialog-generator:analytics-visitor'
const sessionStorageKey = 'wechat-dialog-generator:analytics-session'
const attributionStorageKey = 'wechat-dialog-generator:analytics-attribution'

type EventName =
  | 'page_view'
  | 'dialog_created'
  | 'image_exported'
  | 'project_created'
  | 'project_reopened'
  | 'project_duplicated'
  | 'official_account_prompt_viewed'
  | 'official_account_id_copied'
  | 'shared_template_created'
  | 'shared_template_opened'
type Properties = Record<string, string>

function identifier(storage: Storage, key: string) {
  const existing = storage.getItem(key)
  if (existing) return existing
  const value = crypto.randomUUID()
  storage.setItem(key, value)
  return value
}

function acquisition(): Properties {
  const parameters = new URLSearchParams(window.location.search)
  let firstTouch: Properties = {}

  try {
    const stored = sessionStorage.getItem(attributionStorageKey)
    if (stored) firstTouch = JSON.parse(stored) as Properties
  } catch {
    firstTouch = {}
  }

  if (Object.keys(firstTouch).length === 0) {
    let referrerHost = ''
    try {
      referrerHost = document.referrer ? new URL(document.referrer).hostname : ''
    } catch {
      referrerHost = ''
    }
    firstTouch = {
      ...(referrerHost ? { referrer_host: referrerHost.slice(0, 128) } : {}),
      ...(parameters.get('utm_source') ? { source: parameters.get('utm_source')!.slice(0, 64) } : {}),
      ...(parameters.get('utm_medium') ? { medium: parameters.get('utm_medium')!.slice(0, 64) } : {}),
      ...(parameters.get('utm_campaign') ? { campaign: parameters.get('utm_campaign')!.slice(0, 96) } : {}),
    }
    try {
      sessionStorage.setItem(attributionStorageKey, JSON.stringify(firstTouch))
    } catch {
      // Storage can be unavailable in privacy modes; current-page attribution still works.
    }
  }

  return {
    path: window.location.pathname.slice(0, 256),
    ...firstTouch,
  }
}

export function messageCountBucket(count: number) {
  if (count <= 5) return '1-5'
  if (count <= 20) return '6-20'
  if (count <= 50) return '21-50'
  return '51+'
}

export function participantCountBucket(count: number) {
  if (count <= 1) return '1'
  if (count === 2) return '2'
  if (count <= 5) return '3-5'
  return '6+'
}

export async function trackProductEvent(event: EventName, properties: Properties = {}) {
  if (!endpoint) return
  try {
    const payload = {
      schema_version: 1,
      product: 'wechat-dialog-generator',
      events: [{
        event_id: crypto.randomUUID(),
        event,
        occurred_at: new Date().toISOString(),
        visitor_id: identifier(localStorage, visitorStorageKey),
        session_id: identifier(sessionStorage, sessionStorageKey),
        properties: { ...acquisition(), ...properties },
      }],
    }
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
  } catch {
    // Analytics must never interrupt image generation or local-only editing.
  }
}

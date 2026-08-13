(() => {
  if (!['chat.laogao.xyz', 'gaopengbin.github.io'].includes(location.hostname)) return
  const endpoint = 'https://laogao.xyz/geod-telemetry/v1/product-events'
  const visitorKey = 'wechat-dialog-generator:analytics-visitor'
  const sessionKey = 'wechat-dialog-generator:analytics-session'
  const attributionKey = 'wechat-dialog-generator:analytics-attribution'

  const identifier = (storage, key) => {
    const existing = storage.getItem(key)
    if (existing) return existing
    const value = crypto.randomUUID()
    storage.setItem(key, value)
    return value
  }

  const params = new URLSearchParams(location.search)
  let firstTouch = {}
  try {
    firstTouch = JSON.parse(sessionStorage.getItem(attributionKey) || '{}')
  } catch { firstTouch = {} }
  if (!Object.keys(firstTouch).length) {
    let referrerHost = ''
    try { referrerHost = document.referrer ? new URL(document.referrer).hostname : '' } catch { referrerHost = '' }
    firstTouch = {
      ...(referrerHost ? { referrer_host: referrerHost.slice(0, 128) } : {}),
      ...(params.get('utm_source') ? { source: params.get('utm_source').slice(0, 64) } : {}),
      ...(params.get('utm_medium') ? { medium: params.get('utm_medium').slice(0, 64) } : {}),
      ...(params.get('utm_campaign') ? { campaign: params.get('utm_campaign').slice(0, 96) } : {}),
    }
    try { sessionStorage.setItem(attributionKey, JSON.stringify(firstTouch)) } catch { /* no-op */ }
  }

  const payload = {
    schema_version: 1,
    product: 'wechat-dialog-generator',
    events: [{
      event_id: crypto.randomUUID(),
      event: 'page_view',
      occurred_at: new Date().toISOString(),
      visitor_id: identifier(localStorage, visitorKey),
      session_id: identifier(sessionStorage, sessionKey),
      properties: { path: location.pathname.slice(0, 256), ...firstTouch },
    }],
  }
  fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})
})()

export function safeCheckoutUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || !['openapi.alipay.com', 'openapi-sandbox.dl.alipaydev.com'].includes(url.hostname) || url.username || url.password || url.port || url.pathname !== '/gateway.do') throw new Error('收银台地址异常，请勿付款，联系支持核对。')
  return url.href
}

// Reserve the tab during the click, before the network await loses user activation.
// Detach opener immediately; never pass account tokens to the new document.
export function reserveCheckoutWindow(openWindow: () => Window | null = () => window.open('about:blank', '_blank')) {
  let popup: Window | null = null
  let handedOff = false
  const close = () => {
    if (handedOff) return
    const pending = popup
    popup = null
    try { pending?.close() } catch { /* Browser may revoke the window handle. */ }
  }
  try {
    popup = openWindow()
    if (popup) {
      popup.opener = null
      popup.document.title = '正在打开支付宝收银台'
      popup.document.body.textContent = '正在准备支付宝收银台，请稍候。付款后请回到工具箱查询到账。'
      popup.document.body.style.cssText = 'margin:40px;font:16px/1.8 system-ui,sans-serif;color:#24382c;background:#f3f9f5;'
    }
  } catch { close(); popup = null }
  return {
    close,
    navigate(value: string) {
      const url = safeCheckoutUrl(value)
      try {
        if (!popup || popup.closed) return false
        popup.location.replace(url)
        handedOff = true
        return true
      } catch { close(); return false }
    },
  }
}

export function paymentError(error: unknown) {
  const code = (error as { code?: string })?.code
  const messages: Record<string, string> = {
    not_found: '当前账号服务尚未上线充值接口，暂时不能购买。已有免费和奖励额度不受影响。',
    payments_unavailable: '支付宝充值暂未开放，请稍后再试。',
    email_verification_required: '请先在账户面板完成邮箱验证。',
    too_many_pending_orders: '有未完成订单，请先核对订单，不要重复付款。',
    payment_daily_limit: '今日收款额度已达上限，请稍后再试。',
    payment_query_unavailable: '暂未查到可靠结果，请稍后再次查单，不要重复付款。',
    invalid_payment_product: '套餐已变更，请刷新后重试。',
    payment_product_paused: '该套餐暂时停售，请选择其他套餐。已有订单不受影响。',
    payment_price_changed: '首发活动状态或套餐价格已更新，请刷新套餐，确认新价格后再购买。',
  }
  return (code && messages[code]) || (error instanceof TypeError || (error as Error)?.name === 'TimeoutError' ? '网络请求未完成，请重试核对订单，不要重复付款。' : error instanceof Error ? error.message : '请求未完成，请稍后重试。')
}

// Keep the idempotency key before sending a request, including across reloads.
// Failure to persist must prevent order creation, not risk duplicate orders.
export function paymentIntentKey(userId: string, productId: string) {
  return `toolbox:payment-intent:${encodeURIComponent(userId)}:${encodeURIComponent(productId)}`
}

export function hasPaymentIntent(userId: string, productId: string, orderId: string) {
  try {
    const key = paymentIntentKey(userId, productId)
    return Boolean(sessionStorage.getItem(key)) && sessionStorage.getItem(`${key}:order`) === orderId
  } catch { return false }
}

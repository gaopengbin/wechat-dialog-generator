import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => {
    localStorage.setItem('wechat-dialog-generator:announcement-read', '2026-09-10-account-v1')
    localStorage.setItem('wechat-dialog-generator:account-token', 'mock-token')
    for (const [product, order] of [['paid', 'known-paid'], ['closed', 'known-closed'], ['unknown', ''], ['different', 'another-order']]) {
      const key = `toolbox:payment-intent:test-user:${product}`
      sessionStorage.setItem(key, `old-${product}`)
      if (order) sessionStorage.setItem(`${key}:order`, order)
    }
  })
  const created = []
  const quota = { daily_limit: 10, daily_remaining: 10, daily_used: 0, bonus_remaining: 0, total_remaining: 10 }
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === 'http://127.0.0.1:4178') return route.continue()
    if (url.origin === 'https://openapi.alipay.com') return route.fulfill({ body: 'Mock checkout; no payment' })
    if (!url.pathname.startsWith('/platform-api/v1/')) return route.abort()
    const send = body => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (url.pathname.endsWith('/auth/me')) return send({ user: { id: 'test-user', display_name: '测试', email: 'test@example.test', email_verified_at: '2026-09-10' }, quota })
    if (url.pathname.endsWith('/payments/products')) return send({ available: true, products: [{ id: 'paid', subject: '次数包', amount_fen: 300, credits: 100 }] })
    if (url.pathname.endsWith('/payments/orders')) {
      if (route.request().method() === 'POST') {
        created.push(route.request().postDataJSON())
        return send({ order_id: 'new-order', state: 'pending', checkout_url: 'https://openapi.alipay.com/gateway.do?mock=1' })
      }
      return send({ orders: ['paid', 'closed', 'unknown', 'different'].map(product => ({ id: `known-${product}`, product_id: product, state: product === 'closed' ? 'closed' : 'paid', amount_fen: 300, credits: 100, created_at: '2026-09-10', paid_at: '2026-09-10' })) })
    }
    return send({ rewards: [], links: [], invited: 0, rewarded: 0 })
  })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4178/?page=exports')
  await page.getByRole('button', { name: '账户：测试，剩余 10 次', exact: true }).click()
  await page.getByRole('button', { name: '支付宝充值 · 余额 0 次', exact: true }).click()
  await page.getByRole('button', { name: '购买 100 次', exact: true }).waitFor()
  const keys = await page.evaluate(() => Object.fromEntries(['paid', 'closed', 'unknown', 'different'].map(product => [product, sessionStorage.getItem(`toolbox:payment-intent:test-user:${product}`)])))
  assert.deepEqual(keys, { paid: null, closed: null, unknown: 'old-unknown', different: 'old-different' })
  await page.getByRole('button', { name: '购买 100 次', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '已自动打开支付宝收银台' }).waitFor()
  assert.equal(created.length, 1)
  assert.notEqual(created[0].request_id, 'old-paid')
  const other = await context.newPage()
  await other.goto('http://127.0.0.1:4178/?page=exports')
  await other.evaluate(() => localStorage.setItem('wechat-dialog-generator:account-token', 'other-account-token'))
  await page.getByRole('button', { name: '购买 100 次', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '登录状态已变化' }).waitFor()
  assert.equal(created.length, 1, 'stale payment dialog must not create an order using the new account token')
  console.log('PASS: terminal matching history clears paid/closed intents; unknown/mismatched intents preserved; first subsequent purchase uses new ID; cross-tab account change blocks new purchase, all APIs mocked')
} finally { await browser.close() }

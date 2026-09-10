import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const output = 'C:/Users/Administrator/Documents/test/outputs/payment-ui'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' })
const checks = [], errors = []
try {
  // All account/payment requests are mocked; no real tokens, orders or money.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => localStorage.setItem('wechat-dialog-generator:announcement-read', '2026-09-10-account-v1'))
  await context.addInitScript(() => localStorage.setItem('wechat-dialog-generator:account-token', 'isolated-test-token'))
  let available = false, verified = true, orders = [], paid = 0, failCreate = false, queries = 0
  const ids = []
  const quota = () => ({ daily_limit: 10, daily_used: 0, daily_remaining: 10, bonus_remaining: 20, paid_remaining: paid, total_remaining: 30 + paid, resets_at: '2026-09-11' })
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === 'http://127.0.0.1:4178') return route.continue()
    if (url.origin === 'https://openapi.alipay.com' && url.pathname === '/gateway.do' && url.search === '?test=1') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>Isolated checkout</title><p>模拟收银台，不会付款</p>' })
    if (!url.pathname.startsWith('/platform-api/v1/')) return route.abort()
    const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) })
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    const path = url.pathname.split('/v1')[1]
    if (path === '/auth/me') return send({ user: { id: 'test-user', display_name: '测试用户', email: 'test@example.com', email_verified_at: verified ? '2026-09-10' : null }, quota: quota() })
    if (path === '/rewards') return send({ rewards: [] })
    if (path === '/growth') return send({ links: [], invited: 0, rewarded: 0 })
    if (path === '/payments/products') return available ? send({ available: true, products: [{ id: 'exports100', subject: '导出次数包', amount_fen: 300, credits: 100 }] }) : send({ error: { code: 'not_found', message: 'not found' } }, 404)
    if (path === '/payments/orders' && route.request().method() === 'GET') return send({ orders })
    if (path === '/payments/orders') {
      const body = route.request().postDataJSON()
      assert.deepEqual(Object.keys(body).sort(), ['expected_amount_fen', 'product_id', 'request_id'])
      assert.equal(body.expected_amount_fen, 300)
      ids.push(body.request_id)
      orders = [{ id: 'LG-test-order', product_id: 'exports100', amount_fen: 300, credits: 100, state: 'pending', created_at: '2026-09-10T12:00:00Z', paid_at: null }]
      if (failCreate) { failCreate = false; return route.abort() }
      return send({ order_id: 'LG-test-order', state: 'pending', checkout_url: 'https://openapi.alipay.com/gateway.do?test=1' })
    }
    if (path === '/payments/refresh') {
      queries++
      if (queries > 1) { orders[0].state = 'paid'; paid = 100 }
      return send({ order_id: 'LG-test-order', state: orders[0].state, quota: quota() })
    }
    if (path === '/payments/checkout') {
      assert.equal(route.request().postDataJSON().order_id, 'LG-test-order')
      return send({ order_id: 'LG-test-order', state: 'pending', checkout_url: 'https://openapi.alipay.com/gateway.do?test=1' })
    }
    return send({})
  })
  const page = await context.newPage()
  const popups = []
  page.on('popup', popup => popups.push(popup))
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:4178/?page=exports')
  await page.getByRole('button', { name: '账户：测试用户，剩余 30 次', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '充值额度 · 支付宝', exact: true }).count(), 0)
  const card = page.locator('.studio-quota-card')
  await card.hover(); await page.waitForTimeout(180)
  const contrast = await card.evaluate(el => {
    const luminance = color => { const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4); return values[0] * .2126 + values[1] * .7152 + values[2] * .0722 }
    const background = getComputedStyle(el).backgroundColor, b = luminance(background)
    return [...el.querySelectorAll('span,strong,small,p')].map(node => { const color = getComputedStyle(node).color, c = luminance(color); return { color, background, ratio: (Math.max(b, c) + .05) / (Math.min(b, c) + .05) } })
  })
  assert.ok(contrast.every(value => value.ratio >= 4.5), JSON.stringify(contrast))
  await card.screenshot({ path: `${output}/quota-hover.png` })
  await card.focus()
  assert.equal(await card.evaluate(el => getComputedStyle(el).outlineStyle), 'solid')
  await page.getByRole('button', { name: '账户：测试用户，剩余 30 次', exact: true }).click()
  const account = page.locator('.account-dialog')
  await account.waitFor(); await page.waitForTimeout(300)
  const gridBox = await account.locator('.account-quota-grid').boundingBox(), billingBox = await account.locator('.account-billing').boundingBox()
  assert.ok(billingBox.y - gridBox.y - gridBox.height >= 15)
  await page.screenshot({ path: `${output}/account-desktop.png`, fullPage: true })
  await page.getByRole('button', { name: '支付宝充值 · 余额 0 次', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '充值与订单', exact: true })
  await dialog.getByRole('alert').filter({ hasText: '尚未上线充值接口' }).waitFor()
  await page.screenshot({ path: `${output}/unavailable.png`, fullPage: true })
  checks.push('account-only entry exposes unavailable backend honestly, without fake products or payment')
  available = true
  await dialog.getByRole('button', { name: '刷新套餐与订单' }).click()
  await dialog.getByRole('button', { name: '购买 100 次' }).waitFor()
  await page.screenshot({ path: `${output}/catalog.png`, fullPage: true })
  failCreate = true
  await dialog.getByRole('button', { name: '购买 100 次' }).click()
  await dialog.getByRole('alert').filter({ hasText: '网络请求未完成' }).waitFor()
  await page.waitForTimeout(100)
  assert.equal(popups.length, 1); assert.equal(popups[0].isClosed(), true)
  await dialog.getByRole('button', { name: '购买 100 次' }).click()
  await dialog.getByRole('link', { name: '打开支付宝收银台' }).waitFor()
  await dialog.getByRole('status').filter({ hasText: '已自动打开支付宝收银台' }).waitFor()
  assert.equal(popups.length, 2)
  await popups[1].waitForURL('https://openapi.alipay.com/gateway.do?test=1')
  assert.equal(await popups[1].evaluate(() => window.opener === null), true)
  await page.bringToFront()
  assert.equal(ids.length, 2); assert.equal(ids[0], ids[1])
  assert.equal(await dialog.getByRole('button', { name: '购买 100 次' }).isDisabled(), true)
  await dialog.getByRole('button', { name: '继续付款' }).click()
  await dialog.getByRole('status').filter({ hasText: '已恢复原订单收银台' }).waitFor()
  assert.equal(ids.length, 2)
  assert.equal(popups.length, 3)
  await popups[2].waitForURL('https://openapi.alipay.com/gateway.do?test=1')
  await page.bringToFront()
  // Explicitly simulate popup blocking: recovery must keep the same order and link.
  await page.evaluate(() => { window.open = () => null })
  await dialog.getByRole('button', { name: '继续付款' }).click()
  await dialog.getByRole('status').filter({ hasText: '浏览器未能自动打开' }).waitFor()
  assert.equal(ids.length, 2); assert.equal(popups.length, 3)
  assert.equal(await dialog.getByRole('link', { name: '打开支付宝收银台' }).count(), 1)
  await page.screenshot({ path: `${output}/checkout-fallback.png`, fullPage: true })
  checks.push('automatic checkout popup opens after create and resume with no opener; failed request closes blank tab; blocked popup preserves manual link and existing order')
  await dialog.getByRole('button', { name: '查询到账' }).click()
  await dialog.getByRole('status').filter({ hasText: '暂未确认付款' }).waitFor()
  assert.equal(paid, 0)
  await dialog.getByRole('button', { name: '查询到账' }).click()
  await dialog.getByRole('status').filter({ hasText: '充值额度已同步到账' }).waitFor()
  await page.getByRole('button', { name: '账户：测试用户，剩余 130 次', exact: true, includeHidden: true }).waitFor()
  assert.equal(await dialog.locator('.payment-balance strong').innerText(), '100 次')
  checks.push('ambiguous create retries same id, pending order blocks duplicate purchases, verified query updates account quota exactly once')
  // Simulate a second order settled by a server callback, without a client query.
  paid = 200
  orders.push({ ...orders[0], id: 'LG-test-callback-order' })
  await dialog.getByRole('button', { name: '刷新套餐与订单' }).click()
  await page.getByRole('button', { name: '账户：测试用户，剩余 230 次', exact: true, includeHidden: true }).waitFor()
  assert.equal(await dialog.locator('.payment-balance strong').innerText(), '200 次')
  checks.push('refresh synchronizes callback-settled balance from the server, without creating or querying another payment')
  await dialog.getByRole('button', { name: '关闭充值' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '账户：测试用户，剩余 230 次', exact: true }).click()
  await account.waitFor(); await page.waitForTimeout(300)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: `${output}/account-mobile.png`, fullPage: true })
  await page.getByRole('button', { name: '支付宝充值 · 余额 200 次', exact: true }).click()
  await dialog.getByText('已支付 · 已到账', { exact: true }).first().waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true })
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  checks.push('mobile account entry, persisted order history, dialog Escape, no horizontal overflow')
  verified = false
  await page.reload()
  await page.getByRole('button', { name: '账户：测试用户，剩余 230 次', exact: true }).click()
  await page.getByRole('button', { name: '支付宝充值 · 余额 200 次', exact: true }).click()
  await dialog.getByRole('button', { name: '购买 100 次' }).waitFor()
  assert.equal(await dialog.getByRole('button', { name: '购买 100 次' }).isDisabled(), true)
  await dialog.getByRole('button', { name: '验证邮箱后充值' }).click()
  await page.getByRole('button', { name: '验证邮箱并领取 20 次' }).waitFor()
  checks.push('unverified account cannot purchase and is routed to email verification')
  assert.deepEqual(errors, [])
  checks.push('no outside recharge entry; quota hover text contrast >= 4.5; keyboard focus visible; billing gap >= 15px; desktop/mobile account layout')
  await writeFile(`${output}/report.json`, JSON.stringify({ checks, contrast, errors }, null, 2))
  console.log(JSON.stringify({ checks, errors }, null, 2))
} finally { await browser.close() }

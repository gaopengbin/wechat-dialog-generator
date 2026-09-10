import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const output = 'C:/Users/Administrator/Documents/test/outputs/membership-ui'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  await context.addInitScript(() => localStorage.setItem('wechat-dialog-generator:announcement-read', '2026-09-10-account-v1'))
  await context.addInitScript(() => localStorage.setItem('wechat-dialog-generator:account-token', 'isolated-membership-test'))
  let member = false, expired = false, created = 0
  const start = Date.now(), end = start + 30 * 86400000
  const products = [
    { id: 'exports-100', kind: 'credits', subject: '100 次包', credits: 100, amount_fen: 300, regular_amount_fen: 600 },
    { id: 'member-month', kind: 'membership', subject: '30 天月卡', credits: 0, duration_days: 30, amount_fen: 1200, regular_amount_fen: 1900 },
    { id: 'member-year', kind: 'membership', subject: '365 天年卡', credits: 0, duration_days: 365, amount_fen: 4900, regular_amount_fen: 7900 },
    { id: 'member-day', kind: 'membership', subject: '24 小时日卡', credits: 0, duration_days: 1, amount_fen: 300, regular_amount_fen: 600 },
  ]
  const quota = () => ({ daily_limit: 10, daily_used: 10, daily_remaining: 0, bonus_remaining: 0, paid_remaining: 0, total_remaining: 0, resets_at: '', membership: { active: member, expires_at: member ? new Date(end).toISOString() : null } })
  let orders = []
  await context.route('**/*', route => {
    const req = route.request(), url = new URL(req.url())
    if (url.origin === 'http://127.0.0.1:4178') return route.continue()
    const send = data => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) })
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    const path = url.pathname.split('/v1')[1]
    if (path === '/auth/me') return send({ user: { id: 'test-member', display_name: '测试会员', email: 'test@example.test', email_verified_at: new Date(start).toISOString() }, quota: quota() })
    if (path === '/payments/products') return send({ available: true, products: products.map(p => ({ ...p, amount_fen: expired ? p.regular_amount_fen : p.amount_fen, purchasable: !(expired && p.id === 'member-year') })), campaign: { active: !expired, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), server_now: new Date(start).toISOString() } })
    if (path === '/payments/orders' && req.method() === 'GET') return send({ orders })
    if (path === '/payments/orders') {
      const body = req.postDataJSON(); assert.equal(body.product_id, 'member-month'); assert.equal(body.expected_amount_fen, 1200); created++
      orders = [{ ...products[1], product_id: 'member-month', id: 'isolated-member-order', state: 'pending', created_at: new Date(start).toISOString() }]
      return send({ order_id: orders[0].id, state: 'pending', checkout_url: 'https://openapi.alipay.com/gateway.do?isolated-test=1' })
    }
    if (path === '/payments/refresh') { member = true; orders[0].state = 'paid'; return send({ order_id: orders[0].id, state: 'paid', quota: quota() }) }
    if (path === '/rewards') return send({ rewards: [] })
    if (path === '/growth') return send({ links: [] })
    return route.abort()
  })
  const page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('http://127.0.0.1:4178/?tool=batch')
  await page.getByRole('button', { name: '账户：测试会员，剩余 0 次', exact: true }).waitFor()
  await page.getByRole('button', { name: '账户：测试会员，剩余 0 次', exact: true }).click()
  await page.getByRole('button', { name: '支付宝充值 · 余额 0 次', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '充值与订单', exact: true })
  await dialog.getByText('限时首发优惠 · 30 天', { exact: true }).waitFor()
  assert.equal(await dialog.getByRole('button', { name: '购买24 小时日卡', exact: true }).count(), 0)
  assert.equal(await dialog.getByText('计划常规价 ¥79.00', { exact: true }).count(), 1)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true })
  await dialog.getByRole('button', { name: '只用一天？查看 24 小时日卡', exact: true }).click()
  await dialog.getByRole('button', { name: '购买24 小时日卡', exact: true }).waitFor()
  await dialog.getByRole('button', { name: '购买30 天月卡', exact: true }).click()
  await dialog.getByRole('link', { name: '打开支付宝收银台', exact: true }).waitFor()
  await dialog.getByRole('button', { name: '查询到账', exact: true }).click()
  await dialog.getByText(/会员生效中/).waitFor()
  await dialog.getByRole('button', { name: '关闭充值', exact: true }).click()
  await page.getByRole('button', { name: '账户：测试会员，会员不限次', exact: true }).waitFor()
  assert.equal(await page.locator('.batch-error').count(), 0)
  await page.getByRole('button', { name: '账户：测试会员，会员不限次', exact: true }).click()
  await page.getByRole('button', { name: '支付宝充值 · 余额 0 次', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await dialog.getByText(/会员生效中/).waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true })
  expired = true
  await dialog.getByRole('button', { name: '刷新套餐与订单', exact: true }).click()
  await dialog.getByRole('button', { name: '暂时停售', exact: true }).waitFor()
  assert.equal(await dialog.getByRole('button', { name: '暂时停售', exact: true }).isDisabled(), true)
  assert.equal(await dialog.getByText('限时首发优惠 · 30 天', { exact: true }).count(), 0)
  assert.equal(created, 1); assert.deepEqual(errors, [])
  const report = { fourPlans: true, fixed30DayLaunch: true, memberWithZeroCredits: true, dayExpandable: true, expiredYearDisabled: true, desktopAndMobile: true, allPaymentsMocked: true, errors }
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report))
} finally { await browser.close() }

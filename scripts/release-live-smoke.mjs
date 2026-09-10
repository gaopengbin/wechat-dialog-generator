import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const base = process.env.RELEASE_SMOKE_URL || 'https://chat.laogao.xyz/'
const origin = new URL(base).origin
const output = process.env.RELEASE_SMOKE_OUTPUT || 'C:/Users/Administrator/Documents/test/outputs/release-live'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' })
const errors = [], catalogReads = [], scripts = []
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => localStorage.setItem('wechat-dialog-generator:account-token', 'isolated-release-readonly'))
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin === origin && request.method() === 'GET') return route.continue()
    const send = data => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (request.method() !== 'GET') return route.abort()
    if (url.pathname.endsWith('/v1/auth/me')) return send({ user: { id: 'release-readonly', display_name: '发布验收', email: 'release@example.test', email_verified_at: '2026-09-10' }, quota: { daily_limit: 10, daily_used: 0, daily_remaining: 10, bonus_remaining: 0, paid_remaining: 0, total_remaining: 10, resets_at: '' } })
    if (url.pathname.endsWith('/v1/rewards')) return send({ rewards: [] })
    if (url.pathname.endsWith('/v1/growth')) return send({ links: [], invited: 0, rewarded: 0 })
    if (url.pathname.endsWith('/v1/payments/orders')) return send({ orders: [] })
    if (url.origin === 'https://laogao.xyz' && url.pathname === '/platform-api/v1/payments/products') { catalogReads.push(url.href); return route.continue() }
    return route.abort()
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()) })
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByRole('dialog', { name: '注册与登录，更清楚一点' }).waitFor()
  await page.screenshot({ path: `${output}/announcement.png` })
  await page.getByRole('button', { name: '我知道了', exact: true }).click()
  for (const tool of ['chat', 'batch', 'moments', 'payment', 'redpacket', 'profile', 'group']) {
    await page.goto(`${base}?tool=${tool}`, { waitUntil: 'networkidle' })
    assert.equal(await page.locator('.studio-tool-page:not([hidden])').count(), 1)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  }
  await page.goto(`${base}?tool=batch`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '模板 Prompt', exact: true }).waitFor()
  await page.screenshot({ path: `${output}/batch.png` })
  await page.goto(`${base}?page=exports`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: '还没有导出记录' }).waitFor()
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '账户：发布验收，剩余 10 次', exact: true }).click()
  await page.getByRole('button', { name: '支付宝充值 · 余额 0 次', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '充值与订单', exact: true })
  for (const price of ['¥3.00', '¥12.00', '¥49.00']) await dialog.getByText(price, { exact: true }).waitFor()
  await dialog.getByText('限时首发优惠 · 30 天', { exact: true }).waitFor()
  await page.screenshot({ path: `${output}/payment-desktop.png` })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: `${output}/payment-mobile.png` })
  assert.ok(catalogReads.length > 0)
  assert.deepEqual(errors, [])
  const report = { base, liveFrontend: true, allSevenRoutes: true, exportLogRefresh: true, announcement: true, liveCatalog: true, accountMocked: true, realWritesBlocked: true, scripts: [...new Set(scripts)], catalogReads, errors }
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }

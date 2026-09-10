import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const output = 'C:/Users/Administrator/Documents/test/outputs/payment-live'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => localStorage.setItem('wechat-dialog-generator:announcement-read', '2026-09-10-account-v1'))
  // Isolated unverified mock account to exercise the account-only entry.
  // The only real external request allowed is the public catalog; no real token.
  await context.addInitScript(() => localStorage.setItem('wechat-dialog-generator:account-token', 'isolated-readonly-ui'))
  const traffic = []
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin === 'http://127.0.0.1:4178') return route.continue()
    if (url.pathname.endsWith('/v1/auth/me')) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ user: { id: 'isolated-readonly', display_name: '隔离测试', email: 'test@example.test', email_verified_at: null }, quota: { daily_limit: 10, daily_used: 0, daily_remaining: 10, bonus_remaining: 0, paid_remaining: 0, total_remaining: 10, resets_at: '' } }) })
    if (url.pathname.endsWith('/v1/rewards')) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"rewards":[]}' })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (url.pathname.endsWith('/v1/payments/orders')) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"orders":[]}' })
    if (url.origin === 'https://laogao.xyz' && url.pathname === '/platform-api/v1/payments/products' && ['GET', 'OPTIONS'].includes(request.method())) { traffic.push({ method: request.method(), path: url.pathname }); return route.continue() }
    return route.abort()
  })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4178/?page=exports')
  await page.getByRole('button', { name: '账户：隔离测试，剩余 10 次', exact: true }).click()
  await page.getByRole('button', { name: '支付宝充值 · 余额 0 次', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '充值与订单', exact: true })
  await dialog.getByText('¥3.00', { exact: true }).waitFor()
  await dialog.getByText('限时首发优惠 · 30 天', { exact: true }).waitFor()
  await dialog.getByText('¥12.00', { exact: true }).waitFor()
  await dialog.getByText('¥49.00', { exact: true }).waitFor()
  assert.equal(await dialog.getByRole('button', { name: '购买 100 次', exact: true }).isDisabled(), true)
  assert.equal(await dialog.getByRole('alert').count(), 0)
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true })
  await dialog.getByRole('button', { name: '只用一天？查看 24 小时日卡', exact: true }).click()
  assert.equal(await dialog.getByRole('button', { name: '购买24 小时日卡', exact: true }).isDisabled(), true)
  const report = { liveCatalog: true, launchDays: 30, pricesFen: [300,1200,4900,300], credits: 100, accountMocked: true, unverifiedPurchaseDisabled: true, traffic, noRealOrderOrPayment: true }
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} finally { await browser.close() }

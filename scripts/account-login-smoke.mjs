import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' })
const output = 'C:/Users/Administrator/Documents/test/outputs/account-login'
await mkdir(output, { recursive: true })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const calls = [], errors = []
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === 'http://127.0.0.1:4178') return route.continue()
    if (!url.pathname.startsWith('/platform-api/v1/')) return route.abort()
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (url.pathname.endsWith('/auth/login')) {
      calls.push('login')
      return send({ error: { code: 'invalid_credentials', message: '邮箱或密码不正确。首次使用请先注册；已有账号请确认注册邮箱，或使用“忘记密码”找回。' } }, 401)
    }
    if (url.pathname.endsWith('/auth/email-code')) {
      calls.push(route.request().postDataJSON().purpose)
      return send({ challenge_id: 'isolated-test-challenge', retry_after: 60, message: '若此邮箱已注册并验证，重置验证码将发送至邮箱。首次使用请先注册。' })
    }
    return send({ available: false, products: [] })
  })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('http://127.0.0.1:4178/?page=exports')
  await page.getByRole('dialog', { name: '注册与登录，更清楚一点' }).getByRole('button', { name: '我知道了' }).click()
  await page.getByRole('button', { name: /账户：未登录/ }).click()
  const dialog = page.getByRole('dialog', { name: '登录后继续创作' })
  await dialog.locator('input[type="email"]').fill('new-user@example.test')
  await dialog.getByLabel('密码', { exact: true }).fill('wrong-password')
  await dialog.locator('button[type="submit"], .account-primary-button').click()
  await dialog.getByRole('alert').filter({ hasText: '邮箱或密码不正确' }).waitFor()
  await dialog.getByRole('button', { name: '注册', exact: true }).click()
  const panel = page.locator('.account-dialog')
  assert.equal(await panel.getByRole('alert').count(), 0, 'old login error must not leak into registration')
  assert.equal(await panel.locator('input[type="email"]').inputValue(), 'new-user@example.test')
  assert.ok(await panel.getByRole('button', { name: '验证并注册 · 领取 20 次' }).isDisabled())
  await panel.getByRole('button', { name: '登录', exact: true }).first().click()
  await panel.getByRole('button', { name: '忘记密码？' }).click()
  await panel.getByText(/仅向已注册并验证的邮箱发送/).waitFor()
  await panel.getByRole('button', { name: '获取验证码', exact: true }).click()
  await panel.getByRole('status').filter({ hasText: '首次使用请先注册' }).waitFor()
  assert.deepEqual(calls, ['login', 'reset'])
  await page.screenshot({ path: `${output}/reset-desktop.png` })
  await panel.getByRole('button', { name: '首次使用？去注册', exact: true }).click()
  assert.equal(await panel.getByRole('alert').count(), 0)
  assert.equal(await panel.locator('input[type="email"]').inputValue(), 'new-user@example.test')
  assert.ok(await panel.getByRole('button', { name: '获取验证码', exact: true }).isEnabled())
  assert.ok(await panel.getByRole('button', { name: '验证并注册 · 领取 20 次' }).isDisabled())
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${output}/register-mobile.png` })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  assert.deepEqual(errors, [])
  console.log('PASS: failed login -> register, preserved email, reset guidance, purpose change clears challenge/cooldown, mobile layout; all external requests mocked')
} finally { await browser.close() }

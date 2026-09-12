import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' })
try {
  const page = await browser.newPage()
  await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4198' ? route.continue() : route.abort())
  await page.goto('http://127.0.0.1:4198/')
  const result = await page.evaluate(async () => {
    Object.defineProperty(AbortSignal, 'timeout', { configurable: true, value: undefined })
    const api = await import('/src/lib/account-api.ts')
    const analytics = await import('/src/lib/product-analytics.ts')
    const calls = []
    const session = { token: 'mock-token', user: { id: 'mock-user', email: 'test@example.test' }, quota: {} }
    window.fetch = async (url, options) => {
      calls.push({ path: new URL(url, location.href).pathname, signal: options.signal instanceof AbortSignal })
      return new Response(JSON.stringify(String(url).includes('email-code') ? { challenge_id: 'mock', retry_after: 60 } : session), { status: 200 })
    }
    await api.requestEmailCode('test@example.test', 'register')
    await api.registerAccount('test@example.test', 'test-password', 'test', 'mock', '123456')
    await api.loginAccount('test@example.test', 'test-password')
    const tracked = await analytics.sendProductEnvelope('https://example.test/events', {})
    window.fetch = async () => { throw new TypeError('Failed to fetch') }
    let error = ''
    try { await api.loginAccount('test@example.test', 'test-password') } catch (e) { error = e.message }
    return { calls, tracked, error }
  })
  assert.deepEqual(result.calls.map(c => c.path), ['/platform-api/v1/auth/email-code', '/platform-api/v1/auth/register', '/platform-api/v1/auth/login', '/events'])
  assert.ok(result.calls.every(c => c.signal))
  assert.equal(result.tracked, true)
  assert.match(result.error, /暂时无法连接服务/)
  console.log('PASS: browser without AbortSignal.timeout: code, registration, login, analytics and Chinese network error; all requests mocked')
} finally { await browser.close() }

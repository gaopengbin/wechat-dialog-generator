import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' })
const origin = 'http://127.0.0.1:4178'
const storageKey = 'wechat-dialog-generator:account-token'
const account = (name, remaining = name === 'A' ? 10 : 90) => ({ user: { id: name, display_name: name, email: `${name}@example.test`, email_verified_at: '2026-09-10' }, quota: { daily_limit: 10, daily_used: 0, daily_remaining: 10, bonus_remaining: remaining - 10, paid_remaining: 0, total_remaining: remaining, resets_at: '2026-09-11' } })
try {
  for (const initial of ['A', 'guest']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await context.addInitScript(({ initial, storageKey }) => {
      localStorage.setItem('wechat-dialog-generator:announcement-read', '2026-09-10-account-v1')
      if (initial !== 'guest' && !localStorage.getItem(storageKey)) localStorage.setItem(storageKey, initial)
    }, { initial, storageKey })
    const calls = [], errors = []
    await context.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin === origin) return route.continue()
      if (!url.pathname.startsWith('/platform-api/v1/')) return route.abort()
      const send = body => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
      if (url.pathname.endsWith('/auth/me')) return send(account(route.request().headers().authorization?.slice(7) || 'A'))
      if (url.pathname.endsWith('/quota/consume')) { calls.push(route.request().headers().authorization); return send({ quota: account('B').quota }) }
      return send({ rewards: [], links: [], invited: 0, rewarded: 0 })
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${origin}/?tool=batch`)
    if (initial === 'A') await page.getByRole('button', { name: '账户：A，剩余 10 次', exact: true }).waitFor()
    await page.evaluate(() => {
      const toBlob = HTMLCanvasElement.prototype.toBlob
      HTMLCanvasElement.prototype.toBlob = function (...args) {
        window.releaseCapture = () => toBlob.apply(this, args)
      }
    })
    await page.locator('#batch-input').fill('# 测试\n我：这是一条测试消息。')
    await page.getByRole('button', { name: '添加到批量队列', exact: true }).click()
    await page.getByRole('checkbox', { name: '确认按聊天图片张数使用额度' }).check()
    await page.getByRole('button', { name: '导出所选 ZIP', exact: true }).click()
    await page.waitForFunction(() => typeof window.releaseCapture === 'function')
    // A real second same-origin tab changes storage while rendering is awaiting encoding.
    const other = await context.newPage()
    await other.goto(`${origin}/?page=exports`)
    await other.evaluate(key => localStorage.setItem(key, 'B'), storageKey)
    await page.evaluate(() => window.releaseCapture())
    await page.getByRole('alert').filter({ hasText: '登录状态已变化' }).waitFor()
    assert.deepEqual(calls, [], `${initial} -> B must not debit B`)
    assert.equal(await page.evaluate(() => localStorage.getItem('wechat-dialog-generator:guest-export-usage')), null, 'guest debit must also stop')
    assert.deepEqual(errors, [])
    await context.close()
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => {
    localStorage.setItem('wechat-dialog-generator:announcement-read', '2026-09-10-account-v1')
    localStorage.setItem('wechat-dialog-generator:account-token', 'A')
  })
  let releaseDebit
  const calls = []
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === origin) return route.continue()
    if (!url.pathname.startsWith('/platform-api/v1/')) return route.abort()
    const send = body => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (url.pathname.endsWith('/auth/me')) return send(account('A'))
    if (url.pathname.endsWith('/auth/login')) return send({ ...account('B'), token: 'B' })
    if (url.pathname.endsWith('/quota/consume')) {
      calls.push(route.request().headers().authorization)
      await new Promise(resolve => { releaseDebit = resolve })
      return send({ quota: account('A', 9).quota })
    }
    return send({ rewards: [], links: [], invited: 0, rewarded: 0 })
  })
  const page = await context.newPage()
  await page.goto(`${origin}/?tool=batch`)
  await page.getByRole('button', { name: '账户：A，剩余 10 次', exact: true }).waitFor()
  await page.locator('#batch-input').fill('# 第一组\n我：测试。\n---\n# 第二组\n我：测试。')
  await page.getByRole('button', { name: '添加到批量队列', exact: true }).click()
  await page.getByRole('checkbox', { name: '确认按聊天图片张数使用额度' }).check()
  await page.getByRole('button', { name: '导出所选 ZIP', exact: true }).click()
  for (let attempt = 0; !releaseDebit && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(typeof releaseDebit, 'function')
  await page.getByRole('button', { name: '账户：A，剩余 10 次', exact: true }).click()
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await page.getByRole('button', { name: /账户：未登录/ }).click()
  await page.locator('.account-dialog input[type=email]').fill('B@example.test')
  await page.locator('.account-dialog input[type=password]').fill('test-password')
  await page.locator('.account-primary-button').click()
  await page.getByRole('button', { name: '账户：B，剩余 90 次', exact: true }).waitFor()
  releaseDebit()
  await page.getByRole('status').filter({ hasText: '1 组未完成' }).waitFor()
  assert.deepEqual(calls, ['Bearer A'], 'in-flight A request stays bound; next item never charges B')
  assert.equal(await page.getByRole('button', { name: '账户：B，剩余 90 次', exact: true }).count(), 1, 'A response cannot overwrite B quota')
  await context.close()
  console.log('PASS: delayed render A/guest -> cross-tab B causes no debit; delayed A debit + UI login B keeps B quota and stops next item; all APIs mocked')
} finally { await browser.close() }

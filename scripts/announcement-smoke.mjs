import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' })
const output = 'C:/Users/Administrator/Documents/test/outputs/announcement'
await mkdir(output, { recursive: true })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4178' ? route.continue() : route.abort())
  const page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('http://127.0.0.1:4178/?page=exports')
  const dialog = page.getByRole('dialog', { name: '注册与登录，更清楚一点' })
  await dialog.waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${output}/desktop.png` })
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  assert.ok(await page.getByRole('button', { name: '更新公告', exact: true }).evaluate(el => el === document.activeElement))
  await page.reload()
  await page.getByRole('button', { name: '更新公告', exact: true }).waitFor()
  assert.equal(await dialog.count(), 0, 'dismissal persists after refresh')
  assert.equal(await page.locator('[aria-label="未读公告"]').count(), 0)
  await page.getByRole('button', { name: '更新公告', exact: true }).click()
  await dialog.waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${output}/mobile.png` })
  const dimensions = await dialog.boundingBox()
  assert.ok(dimensions.x >= 0 && dimensions.x + dimensions.width <= 390)
  assert.ok(dimensions.y >= 0 && dimensions.y + dimensions.height <= 844)
  await dialog.getByRole('button', { name: '我知道了' }).click()
  await page.getByRole('button', { name: '更新公告', exact: true }).waitFor()
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.getByRole('button', { name: /账户：未登录/ }).click()
  await page.getByRole('dialog', { name: '登录后继续创作' }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '更新公告', exact: true }).click()
  await dialog.getByRole('button', { name: '关闭更新公告' }).click()
  // An older notice is not treated as an acknowledgement of this version.
  await page.evaluate(() => localStorage.setItem('wechat-dialog-generator:announcement-read', 'older-version'))
  await page.reload()
  await dialog.waitFor()
  await dialog.getByRole('button', { name: '我知道了' }).click()
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem
    Storage.prototype.getItem = function(key) { if (key.includes('announcement-read')) throw new Error('blocked'); return get.call(this, key) }
    Storage.prototype.setItem = function(key, value) { if (key.includes('announcement-read')) throw new Error('blocked'); return set.call(this, key, value) }
  })
  await page.reload()
  await dialog.waitFor()
  await dialog.getByRole('button', { name: '我知道了' }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.deepEqual(errors, [])
  console.log('PASS: automatic notice, Escape/focus restoration, persistent dismissal, manual reopening, version change, blocked storage, account dialog, desktop/mobile; external requests blocked')
} finally { await browser.close() }

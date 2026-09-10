import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const output = process.env.SCENE_SMOKE_OUTPUT || 'C:/Users/Administrator/Documents/test/outputs/scene-workspace'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' })
const results = []
try {
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
    // No account state: the only quota use is this fresh browser's guest allowance.
    const context = await browser.newContext({ viewport, acceptDownloads: true })
    await context.addInitScript(() => localStorage.setItem('wechat-dialog-generator:announcement-read', '2026-09-10-account-v1'))
    await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4178' ? route.continue() : route.abort())
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    for (const kind of ['moments', 'payment']) {
      await page.goto(`http://127.0.0.1:4178/?tool=${kind}`)
      const form = page.locator(kind === 'moments' ? '#moments-editor' : `#scene-${kind}-editor`)
      await form.waitFor()
      await page.waitForTimeout(250)
      if (kind === 'moments') await form.getByRole('tab', { name: '发布身份', exact: true }).click()
      const nameField = form.getByLabel(kind === 'moments' ? '昵称' : '收款方', { exact: true })
      const name = `${viewport.name}布局回归示例`
      await nameField.fill(name)
      if (kind === 'moments') {
        await form.getByRole('tab', { name: '动态内容', exact: true }).click()
        await form.locator('textarea.moments-content-input').fill('布局回归示例：编辑区独立滚动，右侧预览固定。仅为本地虚构测试内容。')
        await form.getByLabel('所在位置', { exact: true }).fill('示例地点')
      } else {
        await form.getByLabel('金额', { exact: true }).fill('12.34')
        await form.getByLabel('转账说明', { exact: true }).fill('布局回归示例 · 仅为模拟测试')
      }
      await page.waitForTimeout(950)
      await page.reload()
      await form.waitFor()
      await page.waitForTimeout(350)
      if (kind === 'moments') await form.getByRole('tab', { name: '发布身份', exact: true }).click()
      assert.equal(await nameField.inputValue(), name, 'Local draft should survive refresh')
      await page.screenshot({ path: `${output}/${kind}-${viewport.name}-editor.png`, fullPage: true })
      if (viewport.name === 'mobile') await page.getByRole('button', { name: '预览与导出', exact: true }).click()
      const preview = page.locator('.workspace-preview:visible')
      await preview.waitFor()
      await page.waitForTimeout(200)
      const boundsBefore = await preview.boundingBox()
      if (viewport.name === 'desktop') {
        await page.locator('.workspace-editor-scroll:visible').evaluate(node => { node.scrollTop = node.scrollHeight })
        await page.waitForTimeout(100)
        assert.deepEqual(await preview.boundingBox(), boundsBefore, 'Preview stays fixed when editor scrolls')
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No page horizontal overflow')
      const previewScroll = await preview.locator('.workspace-preview-body').evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth }))
      assert.equal(previewScroll.scrollWidth <= previewScroll.width, true, 'Scaled scene must not introduce horizontal scrolling inside preview')
      assert.equal(await preview.locator('.wechat-chrome-watermark').innerText(), '模拟界面 · 非真实微信内容')
      const measurement = await preview.locator('.scene-workspace-preview').evaluate(node => ({ clientWidth: node.clientWidth, clientHeight: node.clientHeight, boundingWidth: node.getBoundingClientRect().width }))
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
      await preview.getByRole('button', { name: kind === 'moments' ? '导出朋友圈图片' : '导出模拟页面', exact: true }).click()
      const download = await downloadPromise
      const file = `${output}/${kind}-${viewport.name}-export.png`
      await download.saveAs(file)
      const png = await readFile(file)
      assert.equal(png.subarray(1, 4).toString(), 'PNG')
      const width = png.readUInt32BE(16)
      const height = png.readUInt32BE(20)
      assert.equal(width, 780, 'Scaled preview must not shrink the 390px export canvas at pixelRatio 2')
      assert.ok(height > 900)
      await page.screenshot({ path: `${output}/${kind}-${viewport.name}-preview.png`, fullPage: true })
      results.push({ kind, viewport: viewport.name, width, height, bytes: png.length, measurement, savedAfterRefresh: true })
    }
    assert.deepEqual(errors, [])
    await context.close()
  }
  for (const kind of ['moments', 'payment']) {
    const images = results.filter(result => result.kind === kind)
    assert.deepEqual(images.map(({ width, height }) => [width, height])[0], images.map(({ width, height }) => [width, height])[1], 'Desktop and mobile exports should have identical dimensions')
  }
  await writeFile(`${output}/report.json`, `${JSON.stringify(results, null, 2)}\n`)
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser.close()
}

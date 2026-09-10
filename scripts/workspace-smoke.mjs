import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const playwrightModule = process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const executablePath = process.env.CHROMIUM_PATH || 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const output = process.env.WORKSPACE_SMOKE_OUTPUT || 'C:/Users/Administrator/Documents/test/outputs/workspace-layout'
const base = process.env.WORKSPACE_SMOKE_URL || 'http://127.0.0.1:4178/'
const origin = new URL(base).origin
const { chromium } = await import(pathToFileURL(playwrightModule).href)
const tools = [
  ['chat', '聊天生成器'], ['batch', '批量聊天图'], ['moments', '朋友圈生成器'],
  ['payment', '支付与转账'], ['redpacket', '红包详情'], ['profile', '个人资料'], ['group', '群信息'],
]
const report = { passed: true, checks: [], failures: [], pageErrors: [], blockedExternalOrigins: [], screenshots: [] }
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath })

try {
  // This isolated context never uses user cookies or authenticates. No exports are triggered.
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => localStorage.setItem('wechat-dialog-generator:announcement-read', '2026-09-10-account-v1'))
  const blockedOrigins = new Set()
  await context.route('**/*', route => {
    const requestOrigin = new URL(route.request().url()).origin
    if (requestOrigin === origin) return route.continue()
    blockedOrigins.add(requestOrigin)
    return route.abort()
  })
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
  page.on('pageerror', error => report.pageErrors.push(error.message))

  const active = () => page.locator('.studio-tool-page:not([hidden])')
  const screenshot = async name => {
    const path = `${output}/${name}.png`
    await page.locator('.toast-msg').waitFor({ state: 'hidden' })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path, fullPage: true })
    report.screenshots.push(path)
  }
  const check = async (name, run) => {
    try {
      await run()
      report.checks.push(name)
      console.log(`PASS ${name}`)
    } catch (error) {
      report.passed = false
      report.failures.push({ name, error: error.message })
      console.error(`FAIL ${name}: ${error.message}`)
    }
  }
  const assertRoute = async (id, title) => {
    await page.waitForFunction(tool => new URL(location.href).searchParams.get('tool') === tool, id)
    await page.locator('.studio-work-title').filter({ hasText: title }).waitFor({ state: 'attached' })
    assert.equal(await active().count(), 1, 'exactly one work page must be visible')
  }
  const navigate = async id => {
    await page.locator(`.studio-tool-nav a[href*="tool=${id}"]`).click()
    await assertRoute(id, tools.find(([tool]) => tool === id)[1])
  }
  const geometry = () => page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    body: { width: document.body.scrollWidth, height: document.body.scrollHeight },
  }))

  await page.goto(base)
  await check('home has seven independent tool links', async () => {
    await page.locator('.studio-tool-grid').waitFor()
    assert.equal(await page.locator('.studio-tool-grid a').count(), 7)
    for (const [id] of tools) assert.equal(await page.locator(`.studio-tool-grid a[href*="tool=${id}"]`).count(), 1)
  })

  await check('tool pages support browser back, forward and refresh', async () => {
    await page.locator('.studio-tool-grid a[href*="tool=chat"]').click()
    await assertRoute('chat', '聊天生成器')
    await navigate('batch')
    await page.goBack()
    await assertRoute('chat', '聊天生成器')
    await page.goForward()
    await assertRoute('batch', '批量聊天图')
    await page.reload()
    await assertRoute('batch', '批量聊天图')
  })

  await check('direct resources page loads a template into the chat work page', async () => {
    await page.goto(new URL('?page=resources', base).href)
    await page.locator('.studio-resources h1').filter({ hasText: '模板与使用指南' }).waitFor()
    await page.getByRole('button', { name: '使用这个模板' }).first().click()
    await assertRoute('chat', '聊天生成器')
    assert.match(await active().getByPlaceholder('在此粘贴聊天记录文本，或点击上方按钮导入文件...').inputValue(), /周末有空吗/)
    await active().getByRole('button', { name: '解析并导入', exact: true }).click()
    assert.ok((await active().locator('.wc-bubble').count()) > 0)
  })

  await check('chat import and dedicated editor sections work without losing content', async () => {
    await navigate('chat')
    await active().getByRole('tab', { name: '聊天内容', exact: true }).click()
    await active().getByPlaceholder('在此粘贴聊天记录文本，或点击上方按钮导入文件...').fill('我：工作空间布局测试，仅为虚构示例。\n测试伙伴：预览固定在右侧。\n我：切换工具后仍保留这些内容。')
    await active().getByRole('button', { name: '解析并导入', exact: true }).click()
    assert.equal(await active().locator('.wc-bubble').count(), 3)
    for (const label of ['手机样式', '角色头像', '本地草稿']) {
      const button = active().getByRole('tab', { name: label, exact: true })
      await button.click()
      assert.equal(await button.getAttribute('aria-selected'), 'true')
      const section = active().locator('.chat-section-content:not([hidden])')
      assert.equal(await section.count(), 1)
      assert.ok((await section.innerText()).trim().length > 0)
    }
    await active().getByRole('tab', { name: '聊天内容', exact: true }).click()
    await navigate('moments')
    await navigate('chat')
    assert.match(await active().locator('.wc-chat-content').innerText(), /工作空间布局测试/)
  })

  await check('right preview stays fixed while long editor content scrolls', async () => {
    await page.setViewportSize({ width: 1440, height: 560 })
    await navigate('chat')
    await active().getByRole('tab', { name: '手机样式', exact: true }).click()
    const editor = active().locator('.workspace-editor-scroll')
    const preview = active().locator('.workspace-preview')
    await editor.evaluate(node => { node.scrollTop = 0 })
    const before = await preview.boundingBox()
    const scroll = await editor.evaluate(node => {
      node.scrollTop = node.scrollHeight
      return { top: node.scrollTop, scrollHeight: node.scrollHeight, height: node.clientHeight }
    })
    const after = await preview.boundingBox()
    assert.ok(scroll.top > 0, `settings should exercise internal editor scrolling: ${JSON.stringify(scroll)}`)
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(before[key] - after[key]) < 1, `preview ${key} moved`)
    assert.ok(after.y >= 0 && after.y + after.height <= 561, 'preview must stay within viewport')
    await editor.evaluate(node => { node.scrollTop = 0 })
    await active().getByRole('tab', { name: '聊天内容', exact: true }).click()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await screenshot('desktop-chat')
  })

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    for (const [id] of tools) {
      await check(`${viewport.width}x${viewport.height} ${id}: bounded work page and accessible preview`, async () => {
        await navigate(id)
        if (viewport.width < 780) {
          await active().getByRole('button', { name: '预览与导出', exact: true }).click()
          assert.equal(await active().locator('.workspace-preview').isVisible(), true)
        }
        const dimensions = await geometry()
        assert.ok(dimensions.document.width <= viewport.width + 1, `horizontal page overflow: ${JSON.stringify(dimensions)}`)
        assert.ok(dimensions.document.height <= viewport.height + 1, `vertical page overflow: ${JSON.stringify(dimensions)}`)
        const previewBounds = await active().locator('.workspace-preview').boundingBox()
        assert.ok(previewBounds && previewBounds.height > 0 && previewBounds.width > 0, 'preview must have useful dimensions')
        if (viewport.width === 1440 && ['batch', 'moments', 'payment'].includes(id)) await screenshot(`desktop-${id}`)
        if (viewport.width === 390 && id === 'chat') await screenshot('mobile-chat')
        if (viewport.width < 780) {
          await active().getByRole('button', { name: '编辑内容', exact: true }).click()
          assert.equal(await active().locator('.workspace-editor-scroll').isVisible(), true)
          const editingDimensions = await geometry()
          assert.ok(editingDimensions.document.width <= viewport.width + 1, `mobile editor horizontal overflow: ${JSON.stringify(editingDimensions)}`)
          assert.ok(editingDimensions.document.height <= viewport.height + 1, `mobile editor vertical overflow: ${JSON.stringify(editingDimensions)}`)
        }
      })
    }
  }
  await check('no browser runtime errors', async () => assert.deepEqual(report.pageErrors, []))
  report.blockedExternalOrigins = [...blockedOrigins]
} finally {
  await browser.close()
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
}
console.log(JSON.stringify(report, null, 2))
if (!report.passed) process.exitCode = 1

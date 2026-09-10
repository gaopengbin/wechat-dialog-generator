import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(pathToFileURL('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const output = 'C:/Users/Administrator/Documents/test/outputs/batch-tabs-prompt'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' })
const report = { checks: [], layouts: [], errors: [] }
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  await context.addInitScript(() => localStorage.setItem('wechat-dialog-generator:announcement-read', '2026-09-10-account-v1'))
  // No real accounts, quota, clipboard contents, or external API traffic are used.
  await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4178' ? route.continue() : route.abort())
  await context.addInitScript(() => {
    window.testCopiedPrompt = ''
    window.testClipboardFail = false
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
      if (window.testClipboardFail) throw new Error('Clipboard permission denied')
      window.testCopiedPrompt = text
    } } })
  })
  const page = await context.newPage()
  page.on('pageerror', error => report.errors.push(error.message))
  const batch = page.locator('#batch-studio')
  const trigger = batch.getByRole('button', { name: '模板 Prompt', exact: true })
  const popup = page.getByRole('dialog', { name: '批量聊天模板 Prompt', exact: true })
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.goto('http://127.0.0.1:4178/?tool=batch')
  const importBefore = await page.locator('#batch-input').inputValue()
  await trigger.click()
  await popup.waitFor()
  await popup.getByLabel('主题 / 场景', { exact: true }).fill('客服咨询后的进度沟通')
  await popup.getByLabel('参与角色', { exact: true }).fill('我、小林、客户小何')
  await popup.getByLabel('聊天组数', { exact: true }).fill('12')
  const prompt = popup.getByRole('textbox', { name: '完整批量聊天 Prompt', exact: true })
  const expected = await prompt.inputValue()
  assert.ok(expected.includes('必须恰好输出 12 组'))
  assert.ok(expected.includes('客服咨询后的进度沟通'))
  assert.ok(expected.includes('参与角色：我、小林、客户小何'))
  await popup.getByRole('button', { name: '复制 Prompt', exact: true }).click()
  await popup.getByRole('button', { name: '已复制 Prompt', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.testCopiedPrompt), expected)
  for (const invalid of ['51', '0', '', '2.5', 'abc']) {
    await popup.getByLabel('聊天组数', { exact: true }).fill(invalid)
    assert.equal(await popup.getByRole('button', { name: '复制 Prompt', exact: true }).isDisabled(), true)
    assert.equal(await popup.getByLabel('聊天组数', { exact: true }).getAttribute('aria-invalid'), 'true')
  }
  await popup.getByLabel('聊天组数', { exact: true }).fill('3')
  await page.screenshot({ path: `${output}/prompt-desktop.png` })
  await popup.getByRole('button', { name: '关闭模板 Prompt', exact: true }).focus()
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press('Tab')
    await settle() // Base UI redirects its boundary focus guard on the next frame.
    assert.equal(await popup.evaluate(node => node.contains(document.activeElement)), true, 'Modal focus must stay inside the dialog')
  }
  await page.keyboard.press('Escape')
  await popup.waitFor({ state: 'hidden' })
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true)
  assert.equal(await page.locator('#batch-input').inputValue(), importBefore, 'Prompt must not overwrite the import text')
  report.checks.push('customized prompt, complete clipboard payload, count validation, focus trap and Escape restoration')

  await trigger.click()
  assert.equal(await popup.getByLabel('聊天组数', { exact: true }).inputValue(), '3', 'Dialog preferences survive reopening')
  await page.evaluate(() => { window.testClipboardFail = true })
  await popup.getByRole('button', { name: '复制 Prompt', exact: true }).click()
  await popup.getByText('复制失败，已选中完整 Prompt，请按 Ctrl+C / 长按复制。', { exact: true }).waitFor()
  assert.equal(await prompt.evaluate(node => document.activeElement === node && node.selectionStart === 0 && node.selectionEnd === node.value.length), true)
  await page.mouse.click(3, 3)
  await popup.waitFor({ state: 'hidden' })
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true)
  report.checks.push('clipboard failure selects complete text for manual copying; outside click restores focus')

  for (const height of [844, 450]) {
    await page.setViewportSize({ width: 390, height })
    await trigger.click()
    await popup.waitFor()
    assert.equal(await popup.getByText('复制失败，已选中完整 Prompt，请按 Ctrl+C / 长按复制。', { exact: true }).count(), 0, 'Reopening clears stale clipboard failure status')
    await settle()
    const bounds = await popup.boundingBox()
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 390 && bounds.y + bounds.height <= height)
    assert.equal(await popup.evaluate(node => node.scrollWidth <= node.clientWidth), true)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    const footer = await popup.locator('.batch-prompt-footer').boundingBox()
    assert.ok(footer.y + footer.height <= height, 'Copy action stays within the visible dialog')
    await page.screenshot({ path: `${output}/prompt-mobile-${height}.png` })
    await popup.getByRole('button', { name: '关闭模板 Prompt', exact: true }).click()
  }
  report.checks.push('390px mobile and short-height dialog fit, with visible copy action and no horizontal overflow')

  await page.setViewportSize({ width: 1366, height: 768 })
  await batch.getByRole('button', { name: '添加到批量队列', exact: true }).click()
  const detail = batch.locator('.batch-detail-tabs')
  const tab = name => detail.getByRole('tab', { name, exact: true })
  const source = batch.getByLabel('本组聊天记录', { exact: true })
  const name = batch.getByLabel('当前组聊天名称', { exact: true })
  await name.fill('批量 Tab 回归测试')
  const original = await source.inputValue()
  await source.fill('')
  assert.equal(await source.isVisible(), true, 'Clearing source must not switch to the copied-chat editor')
  await tab('头像与角色').click()
  await settle()
  assert.equal(await detail.locator(':scope > [role=tabpanel]:visible').count(), 1)
  assert.equal(await source.isVisible(), false)
  assert.equal(await batch.getByRole('alert').isVisible(), true, 'Unapplied-source warning remains visible across tabs')
  await detail.getByRole('button', { name: '设为自己', exact: true }).click()
  assert.ok(await detail.locator('.avatar-card').nth(1).innerText().then(text => text.includes('自己')))
  await tab('手机样式').click()
  const platform = detail.getByRole('combobox', { name: '系统样式', exact: true })
  await platform.click()
  await page.getByRole('option', { name: 'Android（Google）', exact: true }).click()
  await detail.getByRole('switch', { name: 'Wi-Fi', exact: true }).uncheck()
  await detail.getByLabel('聊天标题', { exact: true }).fill('同步后的聊天标题')
  await batch.locator('.batch-chat-row').nth(1).getByRole('button').click()
  assert.equal(await tab('手机样式').getAttribute('aria-selected'), 'true')
  assert.equal(await platform.innerText(), 'iOS', 'Each job retains independent settings')
  await batch.locator('.batch-chat-row').nth(0).getByRole('button').click()
  assert.equal(await platform.innerText(), 'Android（Google）')
  assert.equal(await detail.getByRole('switch', { name: 'Wi-Fi', exact: true }).isChecked(), false)
  await tab('聊天内容').click()
  assert.equal(await name.inputValue(), '同步后的聊天标题', 'Style and content tabs use the same chat title')
  assert.equal(await source.inputValue(), '')
  await source.fill(original + '\n我：切换 Tab 后保留这条修改。')
  await batch.getByRole('button', { name: '更新本组预览', exact: true }).click()
  assert.ok(await batch.locator('.batch-chat-preview').innerText().then(text => text.includes('切换 Tab 后保留这条修改。')))
  await tab('聊天内容').focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Space')
  assert.equal(await tab('头像与角色').getAttribute('aria-selected'), 'true')
  report.checks.push('one editing panel at a time, keyboard tabs, empty-source editing, per-job content/role/style persistence')

  for (const [width, height] of [[1366, 768], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height })
    for (const section of ['聊天内容', '头像与角色', '手机样式']) {
      await tab(section).click()
      await settle()
      assert.equal(await detail.locator(':scope > [role=tabpanel]:visible').count(), 1)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      const scroll = await batch.locator('.workspace-editor-scroll').evaluate(node => node.scrollHeight - node.clientHeight)
      if (width >= 1280 || section !== '手机样式') assert.ok(scroll <= 1, 'Desktop panels and mobile content/roles should fit without unnecessary scrolling')
      report.layouts.push({ width, height, section, editorScroll: scroll })
      await page.screenshot({ path: `${output}/tabs-${width}-${section}.png` })
    }
  }
  assert.deepEqual(report.errors, [])
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
}

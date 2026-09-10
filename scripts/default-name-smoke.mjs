import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { DEFAULT_MOMENT, SCENE_DEFAULT_FIELDS } from '../src/lib/demo-defaults.ts'

const { chromium } = await import(pathToFileURL('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const origin = 'http://127.0.0.1:4178'
const output = 'C:/Users/Administrator/Documents/test/outputs/default-names'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' })
const report = { cases: [], errors: [] }
const oldName = '高鹏彬'

try {
  for (const mode of ['fresh', 'legacy-default', 'edited-draft']) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
    await context.addInitScript(() => localStorage.setItem('wechat-dialog-generator:announcement-read', '2026-09-10-account-v1'))
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
    const page = await context.newPage()
    page.on('pageerror', error => report.errors.push(error.message))
    if (mode !== 'fresh') {
      // A same-origin source document starts no app timers. Seed only this isolated test browser.
      await page.goto(`${origin}/src/lib/demo-defaults.ts`)
      const moment = { ...structuredClone(DEFAULT_MOMENT), author: oldName, updatedAt: '2026-09-10T12:00:00.000Z' }
      const scenes = ['redpacket', 'profile', 'group'].map(id => {
        const fields = { ...SCENE_DEFAULT_FIELDS[id] }
        if (id === 'redpacket') fields.sender = oldName
        if (id === 'profile') { fields.nickname = oldName; fields.wechatId = 'gaopengbin' }
        // Seed the actual historical fixture, not a hybrid of old and new demos.
        if (id === 'group') fields.members = `${oldName},小林,阿杰,徐言岩,产品同学,设计师`
        if (mode === 'edited-draft') fields[id === 'redpacket' ? 'greeting' : id === 'profile' ? 'signature' : 'announcement'] = '用户自己修改的内容，必须保留'
        return { id, fields, updatedAt: moment.updatedAt, version: 1 }
      })
      if (mode === 'edited-draft') moment.content = '用户自己写的朋友圈，必须保留'
      await page.evaluate(({ moment, scenes }) => new Promise((resolve, reject) => {
        const request = indexedDB.open('wechat-dialog-generator', 3)
        request.onupgradeneeded = () => {
          const db = request.result
          db.createObjectStore('projects', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt')
          db.createObjectStore('moment-projects', { keyPath: 'id' })
          db.createObjectStore('scene-projects', { keyPath: 'id' })
        }
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction(['moment-projects', 'scene-projects'], 'readwrite')
          transaction.objectStore('moment-projects').put(moment)
          for (const scene of scenes) transaction.objectStore('scene-projects').put(scene)
          transaction.oncomplete = () => { db.close(); resolve() }
          transaction.onerror = () => { db.close(); reject(transaction.error) }
        }
      }), { moment, scenes })
    }
    for (const tool of ['moments', 'redpacket', 'profile', 'group']) {
      await page.goto(`${origin}/?tool=${tool}`)
      const form = page.locator(tool === 'moments' ? '#moments-editor' : `#scene-${tool}-editor`)
      await form.waitFor()
      await form.getByRole('status').filter({ hasText: '已自动保存' }).waitFor()
      if (tool === 'moments') await form.getByRole('tab', { name: '发布身份', exact: true }).click()
      const field = form.getByLabel(tool === 'moments' || tool === 'profile' ? '昵称' : tool === 'redpacket' ? '发送人' : '成员昵称', { exact: true })
      const value = await field.inputValue()
      assert.ok(value.includes(mode === 'edited-draft' ? oldName : '小明'), `${mode}/${tool}: correct demo or preserved name`)
      if (mode !== 'edited-draft') {
        const displayed = await page.locator('.studio-tool-page:not([hidden])').evaluate(node => node.innerText + '\n' + [...node.querySelectorAll('input,textarea')].map(input => input.value).join('\n'))
        assert.ok(!displayed.includes(oldName) && !displayed.includes('徐言岩') && !displayed.includes('gaopengbin'), `${mode}/${tool}: no personal demo name or ID`)
      }
      if (tool === 'profile') assert.equal(await form.getByLabel('微信号', { exact: true }).inputValue(), mode === 'edited-draft' ? 'gaopengbin' : 'xiaoming_demo')
      if (mode === 'fresh' && ['moments', 'profile'].includes(tool)) await page.screenshot({ path: `${output}/${tool}-defaults.png` })
      report.cases.push({ mode, tool, passed: true })
    }
    if (mode === 'fresh') {
      for (const tool of ['chat', 'batch', 'payment']) {
        await page.goto(`${origin}/?tool=${tool}`)
        await page.locator('.studio-tool-page:not([hidden])').waitFor()
        assert.ok(!(await page.locator('.studio-tool-page:not([hidden])').innerText()).includes(oldName))
      }
      await page.goto(`${origin}/?page=resources`)
      const teamTemplate = page.locator('.template-card').filter({ has: page.getByRole('heading', { name: '项目讨论', exact: true }) })
      await teamTemplate.getByRole('button', { name: '使用这个模板', exact: true }).click()
      await page.locator('#editor').waitFor()
      const source = await page.getByRole('textbox', { name: '聊天记录文本', exact: true }).inputValue()
      assert.ok(source.includes('小明') && !source.includes(oldName))
      report.cases.push({ mode, tool: 'team-template-import', passed: true })
    }
    // Read back auto-save, not just transient React state.
    const saved = await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('wechat-dialog-generator', 3)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['moment-projects', 'scene-projects'], 'readonly')
        const moment = transaction.objectStore('moment-projects').get('active')
        const scenes = transaction.objectStore('scene-projects').getAll()
        transaction.oncomplete = () => { db.close(); resolve({ moment: moment.result, scenes: scenes.result }) }
        transaction.onerror = () => { db.close(); reject(transaction.error) }
      }
    }))
    assert.equal(saved.moment.author, mode === 'edited-draft' ? oldName : '小明')
    if (mode === 'edited-draft') assert.equal(saved.moment.content, '用户自己写的朋友圈，必须保留')
    for (const scene of saved.scenes.filter(scene => scene.id !== 'payment')) {
      assert.ok(Object.values(scene.fields).some(value => value.includes(mode === 'edited-draft' ? oldName : '小明')))
      if (mode === 'edited-draft') assert.ok(Object.values(scene.fields).includes('用户自己修改的内容，必须保留'))
    }
    await context.close()
  }
  assert.deepEqual(report.errors, [])
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
}

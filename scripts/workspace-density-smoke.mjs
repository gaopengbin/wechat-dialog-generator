import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(pathToFileURL('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const verify = process.argv.includes('--verify')
const output = `C:/Users/Administrator/Documents/test/outputs/workspace-density/${verify ? 'after' : 'before'}`
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' })
const report = { cases: [], errors: [] }
try {
  const context = await browser.newContext()
  await context.addInitScript(() => localStorage.setItem('wechat-dialog-generator:announcement-read', '2026-09-10-account-v1'))
  await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4178' ? route.continue() : route.abort())
  const page = await context.newPage()
  page.on('pageerror', error => report.errors.push(error.message))
  const active = () => page.locator('.studio-tool-page:not([hidden])')
  const metrics = async () => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    return active().locator('.workspace-editor-scroll').evaluate(node => {
    const bounds = element => { if (!element) return null; const r = element.getBoundingClientRect(); return { top:r.top,bottom:r.bottom,height:r.height } }
    return { viewport:innerHeight, editor:bounds(node), scroll:node.scrollHeight-node.clientHeight, input:bounds(node.querySelector('#batch-input')), primary:bounds(node.querySelector('.batch-compose .batch-actions button')), header:bounds(document.querySelector('.studio-header')), preview:bounds(document.querySelector('.studio-tool-page:not([hidden]) .workspace-preview-header')) }
    })
  }
  for (const [width,height] of [[1678,886],[1366,768],[1280,720],[1024,768],[390,844]]) {
    await page.setViewportSize({ width,height })
    await page.goto('http://127.0.0.1:4178/?tool=batch')
    await active().getByRole('textbox',{name:'聊天记录',exact:true}).waitFor()
    await page.evaluate(() => document.fonts.ready)
    const entry = { tool:'batch-import',width,height,...await metrics() }
    report.cases.push(entry)
    if (verify) {
      assert.ok(entry.scroll <= 1, `${width}x${height}: import should fit without editor scroll: ${JSON.stringify(entry)}`)
      assert.ok(entry.primary.bottom <= height, 'import action reachable without scrolling')
      assert.ok(entry.input.height >= 150, 'compact layout must retain a useful input area')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true)
    }
    if ([1678,1366,390].includes(width)) await page.screenshot({path:`${output}/batch-${width}.png`})
    await active().getByRole('button',{name:'填入示例',exact:true}).click()
    await active().getByRole('button',{name:'添加到批量队列',exact:true}).click()
    await active().getByRole('textbox',{name:'当前组聊天名称',exact:true}).waitFor()
    const edit = { tool:'batch-edit',width,height,...await metrics() }
    report.cases.push(edit)
    if (verify && width >= 1024) assert.ok(edit.scroll <= 1, `${width}x${height}: default queue editing fits without editor scroll`)
    if ([1678,1366,390].includes(width)) await page.screenshot({path:`${output}/batch-edit-${width}.png`})
  }
  await page.setViewportSize({width:1366,height:768})
  await page.goto('http://127.0.0.1:4178/?tool=batch')
  await active().getByRole('textbox',{name:'聊天记录',exact:true}).fill(Array.from({length:50},(_,index)=>`# 测试组 ${index+1}\n我：本地密度测试\n伙伴：测试内容`).join('\n---\n'))
  await active().getByRole('button',{name:'添加到批量队列',exact:true}).click()
  await active().getByRole('textbox',{name:'当前组聊天名称',exact:true}).waitFor()
  const stress = {tool:'batch-50-jobs',width:1366,height:768,...await metrics()}
  report.cases.push(stress)
  if (verify) {
    assert.ok(stress.scroll <= 1, '50 jobs scroll inside the queue, not the editor')
    assert.equal(await active().locator('.batch-chat-list').evaluate(node=>node.scrollHeight>node.clientHeight),true)
  }
  for (const tool of ['chat','moments','payment','redpacket','profile','group']) {
    await page.goto(`http://127.0.0.1:4178/?tool=${tool}`)
    await active().locator('.workspace-editor-scroll').waitFor()
    if (tool==='chat') await active().getByRole('tab',{name:'手机样式',exact:true}).click()
    await page.evaluate(() => document.fonts.ready)
    const state = {tool,width:1366,height:768,...await metrics()}
    report.cases.push(state)
    if (verify) assert.ok(state.scroll <= 1, tool + ': default controls should fit at 1366x768')
    if (tool === 'moments') {
      for (const name of ['发布身份','点赞与评论','动态内容']) {
        await active().getByRole('tab',{name,exact:true}).click()
        const section = {tool:'moments-'+name,width:1366,height:768,...await metrics()}
        report.cases.push(section)
        if (verify) assert.ok(section.scroll <= 1, name + ': panel should fit')
      }
    }
    if (tool === 'chat') {
      await active().getByRole('tab',{name:'聊天内容',exact:true}).click()
      const content = {tool:'chat-import',width:1366,height:768,...await metrics()}
      report.cases.push(content)
      if (verify) assert.ok(content.scroll <= 1, 'Chat import default fits')
    }
    await page.screenshot({path:`${output}/${tool}-1366.png`})
  }
  assert.deepEqual(report.errors,[])
  console.log(JSON.stringify(report,null,2))
} finally { await browser.close(); await writeFile(`${output}/report.json`,JSON.stringify(report,null,2)) }

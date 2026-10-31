import assert from 'node:assert/strict'
import { mkdir,readFile,writeFile } from 'node:fs/promises'
import { chromium } from 'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const base=process.env.HOTFIX_URL||'http://127.0.0.1:4303/'
const origin=new URL(base).origin
const output=process.env.HOTFIX_OUTPUT||'C:/Users/Administrator/Documents/test/outputs/three-fixes-20261031/browser/flow'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
const report={browser:await browser.version(),base,checks:[],errors:[],reserves:[],completions:[],failedReports:[]}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true})
 const quota={daily_limit:10,daily_used:0,daily_remaining:10,bonus_remaining:38,paid_remaining:100,total_remaining:148,membership:{active:false,expires_at:null},resets_at:''}
 await context.addInitScript(()=>{
  localStorage.setItem('wechat-dialog-generator:account-token','isolated-paid-hotfix-test')
  localStorage.setItem('wechat-dialog-generator:official-account-export-prompted','1')
  window.testCopies=0;window.svgMode='normal'
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async()=>{window.testCopies++}}})
  const NativeImage=window.Image
  window.Image=class extends NativeImage {
   set src(value){
    const svg=value.startsWith('data:image/svg+xml')&&(value.startsWith('data:image/svg+xml;base64,')||value.includes('foreignObject'))
    if(svg&&(window.svgMode==='all'||window.svgMode==='percent'&&!value.includes(';base64,'))){queueMicrotask(()=>this.dispatchEvent(new Event('error')));return}
    super.src=value
   }
   get src(){return super.src}
  }
 })
 await context.route('**/*',async r=>{
  const req=r.request(),url=new URL(req.url()),path=url.pathname
  if(url.origin===origin&&req.method()==='GET')return r.continue()
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
  const send=data=>r.fulfill({status:200,contentType:'application/json',headers,body:JSON.stringify(data)})
  if(req.method()==='OPTIONS')return r.fulfill({status:204,headers})
  if(path.endsWith('/auth/me'))return send({user:{id:'isolated-paid-user',display_name:'验收测试',email:'test@example.test',email_verified_at:'2026-10-30'},quota})
  if(path.endsWith('/quota/reserve')){report.reserves.push(req.postDataJSON().action_id);return send({reserved:true,quota})}
  if(path.endsWith('/quota/complete')){report.completions.push(req.postDataJSON().action_id);return send({ok:true,quota})}
  if(path.endsWith('/quota/release'))return send({released:true,quota})
  if(req.method()==='POST'){try{const data=req.postDataJSON();if(JSON.stringify(data).includes('export_failed'))report.failedReports.push(data)}catch{/* non-JSON telemetry */}return send({ok:true,accepted:1})}
  if(path.endsWith('/rewards'))return send({rewards:[]})
  if(path.endsWith('/growth'))return send({links:[],invited:0,rewarded:0})
  if(path.endsWith('/payments/orders'))return send({orders:[]})
  return r.abort()
 })
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message))
 await page.goto(base+'?tool=chat',{waitUntil:'networkidle'})
 const dismiss=page.getByRole('button',{name:'我知道了',exact:true});if(await dismiss.count())await dismiss.click()
 const input=page.getByLabel('聊天记录文本',{exact:true})
 await input.fill('我：你好\u0001，这是复制来的隐藏字符测试😀\n小林：收到，图标和头像也需要完整。\n我：换页\u000b内容也要能导出。')
 await page.getByRole('button',{name:'解析并导入',exact:true}).click()
 await page.evaluate(()=>{
  const phone=document.querySelector('#editor .wc-phone');phone.setAttribute('extension:marker','private')
  phone.append(document.createComment('invalid -- comment'))
 })
 const download=async(name,file)=>{
  const waiter=page.waitForEvent('download',{timeout:45000})
  await page.getByRole('button',{name,exact:true}).click()
  const d=await waiter;await d.saveAs(output+'/'+file)
  const png=await readFile(output+'/'+file);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1125);assert.ok(png.readUInt32BE(20)>=2436)
 }
 await download('生成图片','standard.png')
 await page.getByRole('button',{name:'复制',exact:true}).click()
 await page.waitForFunction(()=>window.testCopies===1)
 await page.waitForFunction(()=>!document.querySelector('.chat-export-primary')?.disabled)
 await download('长截图','long.png')
 report.checks.push('Edge actual editor: invalid comments/unbound attributes plus pasted controls, CJK/emoji/avatars, standard PNG, long PNG and clipboard')
 await page.evaluate(()=>{window.svgMode='percent'})
 await download('生成图片','base64-recovery.png')
 report.checks.push('forced percent-encoded SVG decode rejection recovers using identical SVG bytes via base64; no second export operation')
 const reservedBefore=report.reserves.length
 await page.evaluate(()=>{window.svgMode='all'})
 await page.getByRole('button',{name:'生成图片',exact:true}).click()
 await page.getByText(/生成失败：图片渲染失败/).waitFor()
 assert.equal(report.reserves.length,reservedBefore)
 await page.evaluate(()=>{window.svgMode='normal'})
 await download('生成图片','retry.png')
 report.checks.push('both decode transports failing cannot request quota; next successful attempt recovers without poisoned image cache')
 assert.ok((await input.inputValue()).includes('\u0001'),'original editor input is unchanged')
 assert.equal(await page.evaluate(()=>document.querySelector('#editor .wc-phone').getAttribute('extension:marker')),'private')
 await page.locator('.studio-tool-nav').getByRole('link',{name:'批量聊天图',exact:true}).click()
 await page.locator('#batch-input').fill('# 隐藏字符一\n我：批量\u0001也需要正常导出😀\n小林：收到。\n---\n# 隐藏字符二\n我：另一张\u000b图片\n小雨：好。')
 await page.locator('#batch-import-panel').getByRole('button',{name:'添加到批量队列',exact:true}).click()
 await page.getByRole('checkbox',{name:'确认按聊天图片张数使用额度'}).check()
 const zipWait=page.waitForEvent('download',{timeout:45000})
 await page.getByRole('button',{name:'导出所选 ZIP',exact:true}).click()
 const zipFile=await zipWait;await zipFile.saveAs(output+'/batch.zip')
 const zip=await readFile(output+'/batch.zip');let count=0
 for(let offset=0;zip.readUInt32LE(offset)===0x04034b50;){const size=zip.readUInt32LE(offset+18),start=offset+30+zip.readUInt16LE(offset+26)+zip.readUInt16LE(offset+28);assert.equal(zip.subarray(start+1,start+4).toString(),'PNG');count++;offset=start+size}
 assert.equal(count,2)
 await page.waitForTimeout(300)
 assert.equal(new Set(report.reserves).size,7,'seven stable action IDs; batch delivery revalidates the same reservation IDs')
 assert.deepEqual([...report.completions].sort(),[...new Set(report.reserves)].sort(),'each delivered output confirmed once')
 assert.ok(report.reserves.slice(0,5).every(id=>report.reserves.filter(x=>x===id).length===1),'single-chat fallback does not reserve twice')
 report.checks.push('batch ZIP contains two valid PNGs; seven successful outputs each confirm one stable operation, batch revalidation reuses IDs, failed decode requests no quota; all real API writes blocked')
 assert.deepEqual(report.errors,[])
 await page.screenshot({path:output+'/edge-batch.png'})
 await writeFile(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}finally{await browser.close()}

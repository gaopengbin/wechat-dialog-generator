import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const out=process.argv[2]||'C:/Users/Administrator/Documents/test/outputs/export-render-fix-20261103/full-browser',base=process.argv[3]||'http://127.0.0.1:4301'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),writes=[],errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(r.request().method()!=='GET')writes.push(u.pathname);return u.origin===base&&r.request().method()==='GET'?r.continue():r.abort()})
 await page.goto(base+'/capture-regression.html');await page.locator('#run').click()
 await page.waitForFunction(()=>{try{return typeof JSON.parse(document.querySelector('#results').textContent).passed==='boolean'}catch{return false}},{},{timeout:90000})
 const result=JSON.parse(await page.locator('#results').innerText())
 await page.screenshot({path:out+'/regression.png',fullPage:true})
 const report={browser:await browser.version(),errors,writes,...result};await writeFile(out+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
 assert.equal(result.passed,true);assert.deepEqual(writes,[]);assert.deepEqual(errors,[])
}finally{await browser.close()}

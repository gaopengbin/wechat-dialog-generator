import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const output='C:/Users/Administrator/Documents/test/outputs/three-fixes-20261031/browser'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}})
 await context.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4303'&&r.request().method()==='GET'?r.continue():r.abort())
 const page=await context.newPage();await page.goto('http://127.0.0.1:4303/?tool=chat',{waitUntil:'networkidle'})
 const result=await page.evaluate(async()=>{
  const {captureChatPhone}=await import('/src/lib/capture-chat.ts')
  const {buildCaptureSvg}=await import('/src/lib/capture-svg-build.ts')
  const {validateCaptureSvg}=await import('/src/lib/capture-svg.ts')
  const {createExportLogger}=await import('/src/lib/export-log.ts')
  const phone=document.querySelector('#editor .wc-phone'),results=[],reports=[]
  const begin=createExportLogger(async()=>{},()=>{},p=>reports.push(p))
  let png
  for(const mode of ['baseline','illegal_comment','unbound_attribute','svg_nested_comment','bound_xlink','unbound_element']){
   const added=[],comment=document.createComment('invalid -- > <hidden> comment')
   if(mode==='illegal_comment'){phone.append(comment);added.push(comment)}
   if(mode==='unbound_attribute')phone.setAttribute('extension:marker','private value must never be reported')
   if(mode==='svg_nested_comment'){phone.querySelector('svg').append(comment);added.push(comment)}
   if(mode==='bound_xlink'){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','1');svg.setAttribute('height','1')
    const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('xlink:href','#test');svg.append(use);phone.append(svg);added.push(svg)
   }
   if(mode==='unbound_element'){const node=document.createElement('extension:panel');phone.append(node);added.push(node)}
   const log=begin({tool:'chat',mode:'standard'})
   try{
    const c=await captureChatPhone(phone,false)
    const image=c.getContext('2d').getImageData(0,0,c.width,c.height).data
    let varied=0;for(let i=0;i<image.length;i+=400)if(image[i]!==237||image[i+1]!==237||image[i+2]!==237)varied++
    if(mode==='baseline')png=c.toDataURL('image/png')
    results.push({mode,success:true,width:c.width,height:c.height,varied})
    c.width=0;c.height=0;await log.finish('download_requested')
   }catch(error){results.push({mode,success:false,code:error.captureInfo?.failure_code});await log.finish('failed','',error)}
   if(added.some(n=>!n.parentNode))throw Error('Live DOM was changed')
   if(mode==='unbound_attribute'&&phone.getAttribute('extension:marker')!=='private value must never be reported')throw Error('Live attribute was changed')
   for(const node of added)node.remove();phone.removeAttribute('extension:marker')
  }
  const sample=document.createElement('div');sample.setAttribute('xml:space','preserve');sample.setAttribute('extension:marker','private')
  sample.append(document.createComment('a--b'));sample.textContent+='微信😀';document.body.append(sample)
  const built=await buildCaptureSvg(sample,375,812,{width:375,height:812})
  const metadata=validateCaptureSvg(built.source,built.cleanup)
  const parsed=new DOMParser().parseFromString(decodeURIComponent(built.source.split(',').slice(1).join(',')),'image/svg+xml')
  const preserved=Array.from(parsed.getElementsByTagName('*')).find(e=>e.hasAttributeNS('http://www.w3.org/XML/1998/namespace','space'))?.getAttributeNS('http://www.w3.org/XML/1998/namespace','space')
  sample.remove()
  return {results,reports,png,metadata,xml_space_preserved:preserved}
 })
 for(const r of result.results){assert.equal(r.success,r.mode!=='unbound_element',r.mode);if(r.success){assert.equal(r.width,1125);assert.equal(r.height,2436);assert.ok(r.varied>100)}}
 assert.equal(result.xml_space_preserved,'preserve')
 assert.equal(result.reports.length,1)
 const failed=result.reports[0];assert.equal(failed.failure_code,'svg_invalid');assert.equal(failed.svg_xml,'invalid');assert.equal(failed.quota_phase,'not_requested');assert.equal(failed.capture_revision,'capture-20261031-r4')
 assert.doesNotMatch(JSON.stringify(result.reports),/private|extension:|<svg|parsererror|https:/)
 await writeFile(output+'/xml-capture.png',Buffer.from(result.png.split(',')[1],'base64'));delete result.png
 const report={at:new Date().toISOString(),browser:await browser.version(),source_dom_preserved:true,real_api_writes_blocked:true,...result}
 await writeFile(output+'/xml-smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}finally{await browser.close()}

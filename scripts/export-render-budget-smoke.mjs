import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const out=process.argv[2]||'C:/Users/Administrator/Documents/test/outputs/export-render-fix-20261103/browser',base=process.argv[3]||'http://127.0.0.1:4301'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[],writes=[]
 page.on('pageerror',e=>errors.push(e.message))
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(r.request().method()!=='GET')writes.push(u.pathname);return u.origin===base&&r.request().method()==='GET'?r.continue():r.abort()})
 await page.goto(base+'/?tool=chat')
 const result=await page.evaluate(async()=>{
  const {prepareCaptureResources,decodeImage}=await import('/src/lib/capture-resources.ts')
  const {buildCaptureSvg}=await import('/src/lib/capture-svg-build.ts')
  const {validateCaptureSvg}=await import('/src/lib/capture-svg.ts')
  const {decodeCaptureSvg}=await import('/src/lib/capture-svg-decode.ts')
  const {renderChatCanvas}=await import('/src/lib/capture-render.ts')
  const {createExportLogger}=await import('/src/lib/export-log.ts')
  const check=(v,text)=>{if(!v)throw Error(text)},reports=[]
  const surface=document.createElement('div');surface.style.cssText='width:1125px;height:2436px;position:relative;overflow:hidden;background:white';document.body.append(surface)
  const bitmap=document.createElement('canvas');bitmap.width=1024;bitmap.height=768
  const ctx=bitmap.getContext('2d'),pixels=ctx.createImageData(1024,768);let seed=123456
  for(let p=0;p<pixels.data.length;p+=4){for(let c=0;c<3;c++){seed=(1664525*seed+1013904223)>>>0;pixels.data[p+c]=seed>>>24}pixels.data[p+3]=255}ctx.putImageData(pixels,0,0)
  const jpeg=bitmap.toDataURL('image/jpeg',.75);bitmap.width=bitmap.height=0
  for(let i=0;i<8;i++){const image=await decodeImage(jpeg);image.style.cssText=`display:block;width:180px;height:135px;position:absolute;top:${i?2600+i*150:30}px;left:30px`;surface.append(image)}
  const snapshot=()=>[...surface.querySelectorAll('img')].map(i=>({src:i.getAttribute('src'),srcset:i.getAttribute('srcset'),style:i.getAttribute('style')}))
  const before=JSON.stringify(snapshot()),restore=await prepareCaptureResources(surface,{visibleOnly:true})
  let svg,meta,bytes
  try{
   const built=await buildCaptureSvg(surface,1125,2436,{width:1125,height:2436,pixelRatio:1,backgroundColor:'#ededed',includeQueryParams:true})
   svg=built.source;meta=validateCaptureSvg(svg,built.cleanup);bytes=new TextEncoder().encode(decodeURIComponent(svg.slice(svg.indexOf(',')+1))).length
   check(bytes<1_000_000,'standard image payload still bloated')
   check([...surface.querySelectorAll('img')].slice(1).every(i=>i.src.startsWith('data:image/gif;')),'offscreen photos were not excluded')
  }finally{restore()}
  check(JSON.stringify(snapshot())===before,'original photos/styles were changed')
  const canvas=await renderChatCanvas(surface,1125,2436),actual=canvas.getContext('2d').getImageData(30,30,180,135)
  const reference=document.createElement('canvas');reference.width=180;reference.height=135;reference.getContext('2d').drawImage(await decodeImage(jpeg),0,0,180,135)
  const expected=reference.getContext('2d').getImageData(0,0,180,135);let error=0
  for(let i=0;i<actual.data.length;i+=4)for(let c=0;c<3;c++)error+=Math.abs(actual.data[i+c]-expected.data[i+c])
  const mae=error/(180*135*3);check(mae<3,'visible output pixels were degraded: '+mae)
  const png=canvas.toDataURL('image/png').split(',')[1];canvas.width=canvas.height=0;reference.width=reference.height=0
  reports.push({test:'same eight-photo case shrinks from previous 28.7MB; visible photo pixels and all original resources preserved',svg_bytes:bytes,previous_svg_bytes:28692978,pixel_mean_absolute_error:mae})
  let aborted=false,attempts=[]
  const decoded=await decodeCaptureSvg(svg,meta,{now:()=>performance.now(),base64:s=>{const xml=decodeURIComponent(s.slice(s.indexOf(',')+1));return 'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(xml)))},decode:async(s,signal)=>{attempts.push(s.startsWith('data:image/svg+xml;base64,')?'base64':'uri');if(attempts.length===1){signal.addEventListener('abort',()=>aborted=true);return new Promise(()=>{})}return decodeImage(s,signal)}},400)
  check(aborted&&attempts.join(',')==='uri,base64'&&decoded.naturalWidth===1125,'timed-out URI did not fall back to a real decoded image')
  reports.push({test:'URI timeout actively cancelled, base64 fallback decodes real SVG without quota calls',attempts,aborted})
  surface.remove()
  const clipped=document.createElement('div');clipped.style.cssText='width:120px;height:160px;background:white;overflow:hidden;position:relative';document.body.append(clipped)
  const scroller=document.createElement('div');scroller.style.cssText='position:absolute;top:30px;width:100px;height:100px;overflow:hidden';clipped.append(scroller)
  const stack=document.createElement('div');stack.style.marginTop='-100px';scroller.append(stack)
  const color=value=>{const c=document.createElement('canvas');c.width=c.height=10;const x=c.getContext('2d');x.fillStyle=value;x.fillRect(0,0,10,10);return c.toDataURL('image/png')}
  for(const value of ['red','blue','red']){const row=document.createElement('div');row.style.cssText='width:100px;height:100px';const image=await decodeImage(color(value));image.style.cssText='display:block;width:100px;height:100px';row.append(image);stack.append(row)}
  stack.firstElementChild.dataset.captureResourceError='asset_fetch';stack.firstElementChild.dataset.messageNumber='1'
  const untouched=clipped.innerHTML,scrolled=await renderChatCanvas(clipped,120,160),sample=[...scrolled.getContext('2d').getImageData(50,80,1,1).data]
  check(sample[2]>240&&sample[0]<10,'pruning shifted the current scrolled message');check(clipped.innerHTML===untouched,'scroll fixture was not restored')
  reports.push({test:'offscreen blocked resource ignored only when actually clipped; scrolled visible message does not shift',pixel:sample})
  stack.children[1].dataset.captureResourceError='asset_http';stack.children[1].dataset.captureHttpStatus='403';stack.children[1].dataset.captureAssetPhase='fetch'
  let failed=false;try{await renderChatCanvas(clipped,120,160)}catch(e){failed=e.captureInfo?.failure_code==='asset_http'&&e.captureInfo?.asset_http_status==='403'}check(failed,'visible blocked image was silently dropped or lost HTTP status');clipped.remove()
  reports.push({test:'visible preview failure retains safe HTTP status through export preflight',asset_http_status:'403'})
  const failures=[],log=createExportLogger(async()=>{},()=>{},p=>failures.push(p))({tool:'chat',mode:'standard'})
  try{await decodeCaptureSvg(svg,meta,{now:()=>performance.now(),base64:()=>svg,decode:async()=>new Promise(()=>{})},200)}catch(e){await log.finish('failed','',e);await log.finish('failed','',e)}
  check(failures.length===1&&failures[0].action_id===log.id&&failures[0].quota_phase==='not_requested','timeouts duplicated or lost operation ID')
  reports.push({test:'both transports hung: one failure report, stable action ID, not_requested quota',failure_code:failures[0].failure_code})
  return {reports,png}
 })
 await writeFile(out+'/visible-photo.png',Buffer.from(result.png,'base64'));delete result.png
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[])
 const report={passed:true,browser:await browser.version(),errors,writes,...result};await writeFile(out+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}finally{await browser.close()}

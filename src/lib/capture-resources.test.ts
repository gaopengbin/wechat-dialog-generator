import test from 'node:test'
import assert from 'node:assert/strict'
import { assetScheme, boundedCapture, bundledChrome, captureFailure, decodeImage, loadCaptureResource } from './capture-resources'
import { phoneChrome } from './phone-chrome'
import { readFileSync } from 'node:fs'
import { exportDetails, renderFailure } from './export-diagnostics'
import { createExportLogger } from './export-log'

const valid='data:image/png;base64,dGVzdA=='
const deps={fetcher:async()=>new Response(new Blob(['bytes'],{type:'image/png'})),read:async()=>valid,decode:async()=>({naturalWidth:1,naturalHeight:1} as HTMLImageElement)}
test('all seven bundled UI icons preserve original bytes and work with network unavailable',async()=>{
 assert.equal(Object.keys(phoneChrome).length,7)
 for(const [name,uri] of Object.entries(phoneChrome)) {
  assert.deepEqual(Buffer.from(uri.split(',')[1],'base64'),readFileSync(new URL('../../public/'+name,import.meta.url)))
  assert.equal(await loadCaptureResource('/app/'+name,'chrome','https://chat.test/app/',{...deps,fetcher:async()=>{throw Error('offline')}}),uri)
  assert.equal(bundledChrome('https://other.test/app/'+name,'https://chat.test/app/'),undefined)
  assert.equal(bundledChrome('/app/'+name+'?user=private','https://chat.test/app/'),undefined)
 }
})
test('loaded image with pixels never waits for a hung optional decode()',async()=>{
 const previous=globalThis.Image;let decodeCalls=0
 class LoadedImage {
  naturalWidth=32;naturalHeight=32
  onload: (()=>void)|null=null;onerror: (()=>void)|null=null
  decode(){decodeCalls++;return new Promise<void>(()=>{})}
  set src(_value:string){queueMicrotask(()=>this.onload?.())}
 }
 try {
  globalThis.Image=LoadedImage as unknown as typeof Image
  const image=await boundedCapture(decodeImage(valid),new Error('must not time out'),100)
  assert.equal(image.naturalWidth,32);assert.equal(decodeCalls,0)
 }finally{globalThis.Image=previous}
})
test('failed external resource can recover on the next attempt without a poisoned library cache',async()=>{
 let requests=0
 const fetcher=async()=>{requests++;if(requests===1)throw Error('private URL or token');return new Response('image')}
 await assert.rejects(loadCaptureResource('https://private.test/image.png?token=SECRET','avatar','https://chat.test/',{...deps,fetcher}),error=>exportDetails(error).failure_code==='asset_fetch')
 assert.equal(await loadCaptureResource('https://private.test/image.png?token=SECRET','avatar','https://chat.test/',{...deps,fetcher}),valid)
 assert.equal(requests,2)
})
test('resource query parameters are preserved and origins use appropriate credential mode',async()=>{
 const requests:{url:string,credentials:RequestCredentials|undefined}[]=[]
 const fetcher=async(url:RequestInfo|URL,options?:RequestInit)=>{requests.push({url:String(url),credentials:options?.credentials});return new Response('bytes')}
 for(const source of ['/photo?id=1','/photo?id=2','https://images.test/photo?sig=PRIVATE']) await loadCaptureResource(source,'message','https://chat.test/',{...deps,fetcher})
 assert.deepEqual(requests.map(r=>r.url),['https://chat.test/photo?id=1','https://chat.test/photo?id=2','https://images.test/photo?sig=PRIVATE'])
 assert.deepEqual(requests.map(r=>r.credentials),['same-origin','same-origin','omit'])
})
test('HTTP, corrupt image and timeouts have distinct private-content-free classifications',async()=>{
 await assert.rejects(loadCaptureResource('/missing.png','chrome','https://chat.test/',{...deps,fetcher:async()=>new Response('',{status:404})}),error=>exportDetails(error).failure_code==='asset_http')
 await assert.rejects(loadCaptureResource(valid,'avatar','https://chat.test/',{...deps,decode:async()=>{throw Error('private chat')}}),error=>exportDetails(error).failure_code==='asset_decode')
 await assert.rejects(boundedCapture(new Promise(()=>{}),captureFailure('capture_timeout','capture'),1),error=>exportDetails(error).failure_code==='capture_timeout')
 const details=exportDetails(renderFailure(captureFailure('asset_decode','asset_embed','avatar','blob')))
 assert.equal(details.failure_code,'asset_decode');assert.equal(details.asset_kind,'avatar');assert.equal(details.asset_scheme,'blob')
 assert.doesNotMatch(JSON.stringify(details),/private|https:|base64/)
})
test('asset source classification never returns a hostname or path',()=>{
 assert.equal(assetScheme('blob:https://private.test/secret'),'blob')
 assert.equal(assetScheme(valid),'data')
 assert.equal(assetScheme('/private','https://chat.test/'),'same_origin')
 assert.equal(assetScheme('https://other.test/private','https://chat.test/'),'remote')
})
test('render failures have an action ID before any reservation and duplicate summaries do not report',async()=>{
 const reports:Record<string,string>[]=[]
 const begin=createExportLogger(async()=>{},()=>{},p=>reports.push(p))
 const log=begin({tool:'chat',mode:'long'})
 await log.finish('failed','',captureFailure('svg_decode','svg_rasterize'))
 assert.equal(reports[0].action_id,log.id);assert.equal(reports[0].quota_phase,'not_requested')
  assert.equal(reports[0].diagnostic_version,'2')
 await begin({tool:'batch',mode:'zip',reportFailure:false}).finish('failed')
 assert.equal(reports.length,1)
})
test('batch render uses stable job ID without falsely claiming a reservation',async()=>{
 const reports:Record<string,string>[]=[]
 const log=createExportLogger(async()=>{},()=>{},p=>reports.push(p))({tool:'batch',mode:'long'})
 const action='11111111-1111-4111-8111-111111111111'
 log.action(action,'not_requested');await log.finish('failed','',captureFailure('asset_decode','asset_embed'))
 assert.equal(reports[0].action_id,action);assert.equal(reports[0].quota_phase,'not_requested')
})

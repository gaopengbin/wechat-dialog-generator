import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeCaptureSvg } from './capture-svg-decode'
import { exportDetails } from './export-diagnostics'
const image={naturalWidth:1125,naturalHeight:2436} as HTMLImageElement

test('URI timeout cancels its image and tries base64 inside the same deadline',async()=>{
  const calls:string[]=[];let cancelled=false
  const result=await decodeCaptureSvg('uri',{svg_size:'under_256k'},{now:()=>performance.now(),base64:()=> 'base64',decode:async(source,signal)=>{
    calls.push(source)
    if(source==='uri'){signal?.addEventListener('abort',()=>{cancelled=true});return new Promise<HTMLImageElement>(()=>{})}
    return image
  }},200)
  assert.equal(result,image);assert.deepEqual(calls,['uri','base64']);assert.equal(cancelled,true)
})
test('large SVG chooses compact base64 transport first without changing the image',async()=>{
  const calls:string[]=[]
  const result=await decodeCaptureSvg('uri',{svg_size:'16m_plus'},{now:()=>0,base64:()=> 'base64',decode:async source=>{calls.push(source);return image}})
  assert.equal(result,image);assert.deepEqual(calls,['base64'])
})
test('both hung transports fail once, cancel both loads and retain safe diagnostics',async()=>{
  let cancelled=0,calls=0
  const before=performance.now()
  await assert.rejects(decodeCaptureSvg('uri',{svg_size:'16m_plus',svg_xml:'valid'},{now:()=>performance.now(),base64:()=> 'base64',decode:async(_source,signal)=>{calls++;signal?.addEventListener('abort',()=>cancelled++);return new Promise<HTMLImageElement>(()=>{})}},200),error=>{
    const detail=exportDetails(error);assert.equal(detail.failure_code,'capture_timeout');assert.equal(detail.svg_transport,'both');assert.equal(detail.svg_xml,'valid');return true
  })
  assert.equal(calls,2);assert.equal(cancelled,2);assert.ok(performance.now()-before<1000)
})
test('two immediate decode failures retain svg_decode, not a timeout or private exception',async()=>{
  await assert.rejects(decodeCaptureSvg('uri',{svg_size:'under_256k'},{now:()=>0,base64:()=> 'base64',decode:async()=>{throw Error('secret-url-or-chat')}}),error=>{
    assert.equal(exportDetails(error).failure_code,'svg_decode');assert.doesNotMatch(JSON.stringify(exportDetails(error)),/secret/);return true
  })
})

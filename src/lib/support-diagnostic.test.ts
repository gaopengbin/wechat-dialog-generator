import test from 'node:test'
import assert from 'node:assert/strict'
import {supportLocalReport} from './support-diagnostic'
const storage=new Map<string,string>()
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)},configurable:true})
Object.defineProperty(globalThis,'window',{value:{location:{hostname:'localhost'}},configurable:true})
const {createSupportDiagnosticCode,AccountApiError}=await import('./account-api')
const tokenKey='wechat-dialog-generator:account-token',actionId='11111111-1111-4111-8111-111111111111'
const payload=()=>({code:'WX-'+'A'.repeat(24),expires_at:new Date(Date.now()+1800000).toISOString(),action_id:actionId,scope:'single_export',notice:'test'})

test('diagnostic issuance requires login before any network call',async t=>{
 storage.clear();let calls=0
 t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('must not fetch')})
 await assert.rejects(createSupportDiagnosticCode(actionId),e=>e instanceof AccountApiError&&e.status===401)
 assert.equal(calls,0)
})
test('single-export authorization uses one authenticated POST and never a quota mutation or URL credential',async t=>{
 storage.set(tokenKey,'isolated-token');const calls:string[]=[]
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push(String(url));assert.match(String(url),/\/support\/diagnostics$/)
  assert.doesNotMatch(String(url),/isolated-token|WX-/)
  assert.equal(options?.method,'POST');assert.deepEqual(JSON.parse(String(options?.body)),{action_id:actionId})
  assert.equal((options?.headers as Record<string,string>).authorization,'Bearer isolated-token')
  return new Response(JSON.stringify(payload()),{status:201})
 })
 assert.equal((await createSupportDiagnosticCode(actionId)).scope,'single_export');assert.equal(calls.length,1)
})
test('account changes and malformed or over-broad diagnostic responses are rejected',async t=>{
 storage.set(tokenKey,'isolated-token')
 t.mock.method(globalThis,'fetch',async()=>{storage.set(tokenKey,'other-account');return new Response(JSON.stringify(payload()))})
 await assert.rejects(createSupportDiagnosticCode(actionId),e=>e instanceof AccountApiError&&e.code==='account_changed')
 t.mock.restoreAll();storage.set(tokenKey,'isolated-token')
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({...payload(),scope:'all_exports'})))
 await assert.rejects(createSupportDiagnosticCode(actionId),/诊断码响应不完整/)
})

test('local diagnostics send only enums, never raw messages, filenames, URLs or a mismatched operation note',()=>{
 const record={id:actionId,actionId,outcome:'failed' as const,note:`private@example.test https://private.example/photo.jpg secret [render/timeout; ${actionId}]`}
 assert.deepEqual(supportLocalReport(record),{outcome:'failed',stage:'render',reason:'timeout'})
 assert.doesNotMatch(JSON.stringify(supportLocalReport(record)),/private|secret|https/)
 assert.deepEqual(supportLocalReport({...record,note:'[render/timeout; 22222222-2222-4222-8222-222222222222]'}),{outcome:'failed'})
})

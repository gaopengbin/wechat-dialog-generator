import test from 'node:test'
import assert from 'node:assert/strict'
import { measureGrowthRequest, growthReason } from './growth-analytics'
import { sendProductEnvelope } from './product-analytics'
test('email acceptance and API success remain distinct, without form values', async () => {
  const events: unknown[] = []
  const emit = (name: string, properties: Record<string,string> = {}) => { events.push({name,properties}) }
  await measureGrowthRequest('code_register', async()=>({email:'private@example.test',code:'123456'}), emit)
  await measureGrowthRequest('register', async()=>({token:'secret-token'}), emit)
  assert.equal((events[1] as {properties:{outcome:string}}).properties.outcome,'accepted')
  assert.equal((events[3] as {properties:{outcome:string}}).properties.outcome,'succeeded')
  assert.doesNotMatch(JSON.stringify(events), /private@|123456|secret-token/)
})
test('failure preserves original exception and emits only a bounded reason', async()=>{
  const events: unknown[]=[]
  const error=Object.assign(new Error('secret@example.test'),{status:400,code:'invalid_email_code'})
  await assert.rejects(measureGrowthRequest('bind',async()=>{throw error},(name,p)=>{events.push({name,p})}), e=>e===error)
  assert.equal(growthReason(error),'invalid_code')
  assert.doesNotMatch(JSON.stringify(events),/secret@example/)
})
test('transient telemetry failure retries exactly once with identical event ID and body',async()=>{
  const bodies: unknown[]=[]
  const fake=(async(_url,options)=>{bodies.push(options?.body);if(bodies.length===1)throw Error('network');return new Response('{}',{status:202})}) as typeof fetch
  assert.equal(await sendProductEnvelope('https://example.test',{event_id:'same-id'},fake),true)
  assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1])
  let count=0
  assert.equal(await sendProductEnvelope('https://example.test',{},(async()=>{count++;throw Error('offline')}) as typeof fetch),false)
  assert.equal(count,2)
})
test('invalid telemetry is not retried',async()=>{
  let count=0
  assert.equal(await sendProductEnvelope('https://example.test',{},(async()=>{count++;return new Response('{}',{status:400})}) as typeof fetch),false)
  assert.equal(count,1)
})

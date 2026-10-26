import test from 'node:test'
import assert from 'node:assert/strict'
import { createResourceCache } from './resource-cache'

test('preview and capture coalesce in-flight reads; a rejected read can immediately retry', async()=>{
 let requests=0
 const load=createResourceCache(async source=>{requests++;await Promise.resolve();if(requests===1)throw Error('offline');return source})
 const a=load('same'),b=load('same');assert.equal(a,b)
 await assert.rejects(a);assert.equal(await load('same'),'same');assert.equal(requests,2)
 assert.equal(await load('same'),'same');assert.equal(requests,2)
})
test('image checks have bounded concurrency and success-cache size', async()=>{
 let active=0,max=0,calls=0
 const load=createResourceCache(async source=>{active++;calls++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,1));active--;return source},3,4)
 assert.deepEqual(await Promise.all(['aa','bb','cc','dd','ee'].map(load)),['aa','bb','cc','dd','ee'])
 assert.equal(max,3);assert.equal(calls,5)
 await load('ee');assert.equal(calls,5)
 await load('aa');assert.equal(calls,6)
})

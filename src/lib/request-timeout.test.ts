import test from 'node:test'
import assert from 'node:assert/strict'
import { withRequestTimeout } from './request-timeout'
import { sendProductEnvelope } from './product-analytics'
import { growthReason } from './growth-analytics'

test('requests and telemetry work without AbortSignal.timeout', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout')!
  Object.defineProperty(AbortSignal, 'timeout', { configurable: true, value: undefined })
  try {
    assert.equal(await withRequestTimeout(async signal => {
      assert.equal(signal.aborted, false)
      return 'sent'
    }, 20), 'sent')
    let calls = 0
    const fetcher = (async (_url, options) => {
      assert.ok(options?.signal instanceof AbortSignal)
      calls++
      return new Response('{}', { status: 202 })
    }) as typeof fetch
    assert.equal(await sendProductEnvelope('https://example.test', {}, fetcher), true)
    assert.equal(calls, 1)
  } finally { Object.defineProperty(AbortSignal, 'timeout', descriptor) }
})

test('timeout aborts pending work and is classified as timeout, not cancellation', async () => {
  await assert.rejects(withRequestTimeout(signal => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  }), 5), error => {
    assert.equal(growthReason(error), 'timeout')
    assert.match((error as Error).message, /请求超时/)
    return true
  })
})

test('successful and failed work clean up timers and parent listeners', async () => {
  for (const fails of [false, true]) {
    const parent = new AbortController()
    let child: AbortSignal | undefined
    const original = new Error('server error')
    const work = withRequestTimeout(async signal => {
      child = signal
      if (fails) throw original
      return 42
    }, 5, parent.signal)
    if (fails) await assert.rejects(work, e => e === original)
    else assert.equal(await work, 42)
    parent.abort()
    await new Promise(resolve => setTimeout(resolve, 15))
    assert.equal(child?.aborted, false)
  }
})

test('caller cancellation and already-aborted signals remain cancellations', async () => {
  const parent = new AbortController()
  const work = withRequestTimeout(signal => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  }), 100, parent.signal)
  parent.abort()
  await assert.rejects(work, error => growthReason(error) === 'cancelled')
  let called = false
  await assert.rejects(withRequestTimeout(async () => { called = true }, 100, parent.signal), { name: 'AbortError' })
  assert.equal(called, false)
})

test('hard deadline ends a response-body wait even when the adapter ignores abort', { timeout: 1000 }, async () => {
  let signal: AbortSignal | undefined, finish!: () => void
  const at=Date.now()
  await assert.rejects(withRequestTimeout(child=>{signal=child;return new Promise(resolve=>{finish=()=>resolve('late body')})},10),{name:'TimeoutError'})
  assert.equal(signal?.aborted,true);assert.ok(Date.now()-at<500)
  finish();await new Promise(resolve=>setTimeout(resolve,5))
})

test('parent cancellation also settles abort-ignoring work and preserves an explicit timeout reason', { timeout: 1000 }, async()=>{
  const parent=new AbortController(),pending=withRequestTimeout(()=>new Promise(()=>{}),10000,parent.signal)
  parent.abort();await assert.rejects(pending,{name:'AbortError'})
  const overdue=new AbortController(),work=withRequestTimeout(()=>new Promise(()=>{}),10000,overdue.signal)
  overdue.abort(new DOMException('overdue','TimeoutError'));await assert.rejects(work,{name:'TimeoutError'})
})

test('late rejection after a hard timeout remains observed rather than becoming an unhandled rejection', { timeout: 1000 }, async()=>{
  let late!: (reason:Error)=>void,unhandled=false
  const observe=()=>{unhandled=true};process.on('unhandledRejection',observe)
  try{await assert.rejects(withRequestTimeout(()=>new Promise((_resolve,reject)=>{late=reject}),5),{name:'TimeoutError'});late(new Error('late network failure'));await new Promise(resolve=>setTimeout(resolve,10));assert.equal(unhandled,false)}finally{process.off('unhandledRejection',observe)}
})

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

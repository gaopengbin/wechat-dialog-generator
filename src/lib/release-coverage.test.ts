import test from 'node:test'
import assert from 'node:assert/strict'
import { runBatch, validateChat, type BatchJob } from './batch'
import { reserveCheckoutWindow } from './payment-ui'

const job = (id: string): BatchJob => ({ id, content: { title: id, body: '我：你好' }, mode: 'long', selected: true, state: 'ready' })

test('batch cancellation before debit leaves rendered work retryable without charging', async () => {
  const rows = [job('first'), job('next')]
  let cancelled = false
  const rendered: string[] = [], debited: string[] = [], results: string[] = []
  await runBatch(rows, {
    render: async row => { rendered.push(row.id); cancelled = true; return new Uint8Array([1]) },
    debit: async id => { debited.push(id) }, cancelled: () => cancelled,
    update: () => {}, complete: () => assert.fail('cancelled work cannot complete'),
    result: row => { results.push(`${row.id}:${row.state}`) },
  })
  assert.deepEqual(rendered, ['first'])
  assert.deepEqual(debited, [])
  assert.deepEqual(results, ['first:ready'])
  assert.ok(rows.every(row => row.state === 'ready' && !row.locked && !row.bytes))
})

test('batch skips unchecked and cached rows; completion-hook failures never retry a charged row', async () => {
  const rows = [job('unchecked'), job('cached'), job('fresh'), job('last')]
  rows[0].selected = false
  rows[1].state = 'done'
  rows[1].bytes = new Uint8Array([7])
  const debited: string[] = [], rendered: string[] = []
  const deps = {
    render: async (row: BatchJob) => { rendered.push(row.id); return new Uint8Array([1]) },
    debit: async (id: string) => { debited.push(id) }, cancelled: () => false,
    update: () => {}, complete: () => { throw Error('telemetry unavailable') },
  }
  await runBatch(rows, deps)
  await runBatch(rows, deps)
  assert.deepEqual(rendered, ['fresh', 'last'])
  assert.deepEqual(debited, ['fresh', 'last'])
  assert.equal(rows[0].state, 'ready')
  assert.deepEqual(rows[1].bytes, new Uint8Array([7]))
  assert.ok(rows.slice(1).every(row => row.state === 'done' && row.bytes))
})

test('batch enforces message-count and Unicode title boundaries without dropping content', () => {
  const body = Array.from({ length: 150 }, (_, i) => `我：消息 ${i + 1}`).join('\n')
  assert.doesNotThrow(() => validateChat({ title: '😀'.repeat(40), body }))
  assert.throws(() => validateChat({ title: '😀'.repeat(41), body }), /40/)
  assert.throws(() => validateChat({ title: '太长的聊天', body: `${body}\n我：消息 151` }), /150/)
})

test('revoked checkout handles close safely and retain manual-link fallback', () => {
  let closed = 0
  const popup = {
    opener: {}, closed: false,
    document: { title: '', body: { textContent: '', style: { cssText: '' } } },
    location: { replace: () => { throw Error('navigation blocked') } },
    close: () => { closed++ },
  }
  const reserved = reserveCheckoutWindow(() => popup as unknown as Window)
  assert.equal(reserved.navigate('https://openapi.alipay.com/gateway.do?order=test'), false)
  assert.equal(closed, 1)
  assert.equal(reserved.navigate('https://openapi.alipay.com/gateway.do?order=test'), false)
  reserved.close()
  assert.equal(closed, 1)
})

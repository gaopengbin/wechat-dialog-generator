import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportLogger, filterExportLogs, type ExportLog } from './export-log'
import { runBatch, type BatchJob } from './batch'

test('export log serializes start and completion and ignores duplicate finishes', async () => {
  const writes: ExportLog[] = []
  const logger = createExportLogger(async row => { await new Promise(resolve => setTimeout(resolve, 5)); writes.push(row) }, () => assert.fail('unexpected persistence failure'))
  const log = logger({ tool: 'batch', mode: 'zip', filename: '聊天截图_3组.zip', count: 3 })
  await Promise.all([log.finish('download_requested'), log.finish('failed', 'must not overwrite success')])
  assert.deepEqual(writes.map(row => row.outcome), ['pending', 'download_requested'])
  assert.ok(writes.every(row => row.id === log.id && row.count === 3))
  assert.ok(writes[1].finishedAt)
  assert.equal(writes[1].note, '')
  assert.deepEqual(Object.keys(writes[1]).sort(), ['id', 'tool', 'mode', 'filename', 'count', 'startedAt', 'finishedAt', 'outcome', 'note'].sort())
})

test('storage failure does not throw or prevent the terminal record retry', async () => {
  let failures = 0
  const writes: ExportLog[] = []
  const log = createExportLogger(async row => { if (row.outcome === 'pending') throw Error('quota exceeded'); writes.push(row) }, () => { failures++ })({ tool: 'chat', mode: 'clipboard' })
  await assert.doesNotReject(log.finish('copied'))
  assert.equal(failures, 1)
  assert.equal(writes[0].outcome, 'copied')
  await assert.doesNotReject(createExportLogger(async () => { throw Error('blocked') }, () => { throw Error('notification also failed') })({ tool: 'profile', mode: 'standard' }).finish('failed'))
})

test('log filters combine tool, outcome, local calendar date and filename', () => {
  const rows = [
    { id: '1', tool: 'chat', mode: 'long', filename: '聊天_长截图.png', outcome: 'download_requested', startedAt: new Date(2026, 8, 10, 8).toISOString() },
    { id: '2', tool: 'batch', mode: 'zip', filename: '聊天.zip', outcome: 'failed', startedAt: new Date(2026, 8, 4, 8).toISOString() },
    { id: '3', tool: 'moments', mode: 'standard', filename: '朋友圈.png', outcome: 'download_requested', startedAt: new Date(2026, 8, 3, 23).toISOString() },
  ] as ExportLog[]
  const now = new Date(2026, 8, 10, 12)
  const all = { tool: 'all', outcome: 'all', days: 'all', search: '' }
  assert.equal(filterExportLogs(rows, all, now).length, 3)
  assert.deepEqual(filterExportLogs(rows, { ...all, days: '1' }, now).map(row => row.id), ['1'])
  assert.deepEqual(filterExportLogs(rows, { ...all, days: '7' }, now).map(row => row.id), ['1', '2'])
  assert.equal(filterExportLogs(rows, { ...all, tool: 'chat', outcome: 'failed' }, now).length, 0)
  assert.deepEqual(filterExportLogs(rows, { ...all, search: ' ZIP ', tool: 'batch' }, now).map(row => row.id), ['2'])
})

test('batch log observes each attempted row and logging errors cannot duplicate debits', async () => {
  const jobs: BatchJob[] = ['ok', 'bad', 'last'].map(id => ({ id, content: { title: id, body: '我：你好' }, mode: 'long', selected: true, state: 'ready' }))
  const events: string[] = [], debits: string[] = []
  await runBatch(jobs, { render: async job => { if (job.id === 'bad') throw Error('render failed'); return new Uint8Array([1]) }, debit: async id => { debits.push(id) }, cancelled: () => false, update: () => {}, complete: () => {}, result: job => { events.push(`${job.id}:${job.state}`); throw Error('logging failed') } })
  assert.deepEqual(events, ['ok:done', 'bad:error', 'last:done'])
  assert.deepEqual(debits, ['ok', 'last'])
})

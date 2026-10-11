import test from 'node:test'
import assert from 'node:assert/strict'
import { exportReason, browserFamily } from './export-diagnostics'
import { createExportLogger } from './export-log'

test('diagnostics never retain private exception content or user agent', () => {
  assert.equal(exportReason(new Error('fetch https://secret.test/?token=PRIVATE')), 'resource_load')
  assert.equal(exportReason(new Error('private chat')), 'unknown')
  assert.equal(exportReason(new DOMException('private', 'SecurityError')), 'security')
  assert.equal(browserFamily('Chrome/140.0 secret@example.com'), 'chrome-140')
})
test('failure reported once even when local storage and reporter fail', async () => {
  const reports: Record<string,string>[] = []
  const log = createExportLogger(async () => { throw Error('storage') }, () => {}, p => { reports.push(p); throw Error('offline') })({ tool: 'chat', mode: 'standard', filename: 'private.png' })
  log.stage('encode')
  await log.finish('failed', 'local note', new DOMException('private URL', 'SecurityError'))
  await log.finish('failed')
  assert.equal(reports.length, 1)
  assert.equal(reports[0].diagnostic_id, log.id)
  assert.equal(reports[0].stage, 'encode')
  assert.equal(reports[0].reason, 'security')
  assert.ok(!JSON.stringify(reports).includes('private'))
})

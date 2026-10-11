import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')

test('no browser-local guest debit or guest quota remains', () => {
  const api = read('./account-api.ts')
  const app = read('../App.tsx')
  assert.doesNotMatch(api + app, /consumeGuestExport|guestQuota|guest-export-usage|batchGuestDebits/)
  assert.match(api, /if \(!identity.userId \|\| !identity.credential\) throw new AccountApiError\(401/)
  assert.match(api, /if \(!token\(\)\) throw new AccountApiError\(401/)
})

test('single and batch exports reserve server quota without a guest fallback', () => {
  const app = read('../App.tsx')
  assert.match(app, /requireExportLogin\(identity\);\s+const reservation = await consumeAccountExport/)
  assert.match(app, /const result = await consumeAccountExport\(id, identity\)/)
  assert.match(app, /error.status === 401[\s\S]*?setAccountPrompt\(true\)/)
  for (const tool of ['MomentsEditor', 'WechatSceneEditor']) {
    assert.match(app, new RegExp(`<${tool}[^>]*onBeforeExport=\\{authorizeExport\\}`))
  }
})

test('batch generation and cached ZIP downloads both require login', () => {
  const source = read('../components/BatchStudio.tsx')
  assert.match(source, /async function generate\(\) \{\s+if \(!onRequireLogin\(\)\) return;/)
  assert.match(source, /function download\(note = ''\) \{\s+if \(!onRequireLogin\(\)\) return;/)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { gzipSync } from 'node:zlib'

import { createSameTemplateUrl, readSameTemplateHash, sanitizeSharedSnapshot } from './share-link'
import type { ChatProjectSnapshot } from './project-store'

const snapshot: ChatProjectSnapshot = {
  importText: '**我**：你好',
  users: [
    { id: 1, name: '我', avatar: 'data:image/png;base64,private-avatar' },
    { id: 2, name: '小林', avatar: null },
  ],
  messages: [
    { id: 1, type: 'text', senderId: 1, content: '你好', params: {} },
    { id: 2, type: 'image', senderId: 2, content: 'data:image/png;base64,private-image', params: {} },
  ],
  settings: {
    platform: 'ios',
    time: '12:02',
    signal: 4,
    secondarySignal: 3,
    simMode: 'single',
    wifiEnabled: true,
    battery: 60,
    contactName: '小林',
    unreadCount: 1,
    selfBubbleColor: '#95ec69',
    otherBubbleColor: '#ffffff',
    backgroundColor: '#ededed',
    backgroundImage: 'data:image/png;base64,private-background',
  },
  selfId: 1,
}

test('round trips a same-template URL without uploaded private media', async () => {
  const url = await createSameTemplateUrl(snapshot, 'https://chat.laogao.xyz/')
  const restored = await readSameTemplateHash(new URL(url).hash)
  assert.ok(restored)
  assert.equal(restored.users[0].avatar, null)
  assert.equal(restored.importText, '')
  assert.equal(restored.messages[0].content, '你好')
  assert.equal(restored.messages[1].type, 'text')
  assert.equal(restored.messages[1].content, '[图片位置，请重新上传图片]')
  assert.equal(restored.settings.contactName, '小林')
  assert.equal(restored.settings.backgroundColor, '#ededed')
  assert.equal(restored.settings.backgroundImage, null)
})

test('rejects malformed shared snapshots', () => {
  assert.throws(() => sanitizeSharedSnapshot({ users: [], messages: 'private' }), /缺少对话数据/)
})

test('ignores unrelated hash routes', async () => {
  assert.equal(await readSameTemplateHash('#editor'), null)
})

test('same-template links do not propagate another invitation or query credentials', async () => {
  const url = await createSameTemplateUrl(snapshot, 'https://chat.laogao.xyz/?invite=other-person&token=private')
  assert.equal(new URL(url).search, '')
  assert.ok(await readSameTemplateHash(new URL(url).hash))
})

test('rejects compressed expansion beyond the byte budget and oversized URL before decoding', async () => {
  const compressed = gzipSync('x'.repeat(2_000_000)).toString('base64url')
  await assert.rejects(readSameTemplateHash(`#same=g1.${compressed}`), /内容过大/)
  await assert.rejects(readSameTemplateHash(`#same=g1.${'A'.repeat(60001)}`), /链接过长/)
})

test('refuses creating a template that its receiver cannot load', async () => {
  const large = { ...snapshot, messages: Array.from({ length: 250 }, (_, id) => ({ id, senderId: 1, type: 'text' as const, content: '长'.repeat(5000), params: {} })) }
  await assert.rejects(createSameTemplateUrl(large, 'https://chat.laogao.xyz'), /内容过大/)
})

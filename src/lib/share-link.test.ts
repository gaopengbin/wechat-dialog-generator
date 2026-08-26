import assert from 'node:assert/strict'
import test from 'node:test'

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

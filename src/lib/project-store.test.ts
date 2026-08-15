import assert from 'node:assert/strict'
import test from 'node:test'
import { copyProject, projectHasContent, projectName, type ChatProject } from './project-store'

const emptySnapshot = {
  importText: '',
  users: [],
  messages: [],
  settings: {
    platform: 'ios' as const,
    time: '12:02',
    signal: 4,
    secondarySignal: 3,
    simMode: 'single' as const,
    wifiEnabled: true,
    battery: 60,
    contactName: '',
    unreadCount: 1,
    selfBubbleColor: '#95ec69',
    otherBubbleColor: '#ffffff',
  },
  selfId: null,
}

test('detects meaningful draft content', () => {
  assert.equal(projectHasContent(emptySnapshot), false)
  assert.equal(projectHasContent({ ...emptySnapshot, importText: '待解析内容' }), true)
  assert.equal(projectHasContent({
    ...emptySnapshot,
    users: [{ id: 1, name: '小林', avatar: null }],
  }), true)
})

test('prefers the contact name for generated project names', () => {
  assert.equal(projectName({
    ...emptySnapshot,
    settings: { ...emptySnapshot.settings, contactName: '小林' },
  }), '小林的对话')
})

test('duplicates a project without sharing nested state', () => {
  const source: ChatProject = {
    ...emptySnapshot,
    id: 'source',
    name: '测试项目',
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
    version: 1,
  }
  const duplicate = copyProject(source, new Date('2026-08-13T10:00:00.000Z'))
  duplicate.settings.contactName = '已修改'

  assert.notEqual(duplicate.id, source.id)
  assert.equal(duplicate.name, '测试项目 副本')
  assert.equal(duplicate.updatedAt, '2026-08-13T10:00:00.000Z')
  assert.equal(source.settings.contactName, '')
})

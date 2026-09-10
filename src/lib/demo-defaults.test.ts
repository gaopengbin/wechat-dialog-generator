import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_MOMENT, SCENE_DEFAULT_FIELDS, refreshUntouchedMomentDemo, refreshUntouchedSceneDemo } from './demo-defaults'
import type { MomentProject, WechatSceneKind, WechatSceneProject } from './project-store'

const oldName = '高鹏彬'
const savedAt = '2026-09-10T12:00:00.000Z'

test('untouched auto-saved moment demo upgrades without mutating its stored source', () => {
  const stored = { ...structuredClone(DEFAULT_MOMENT), author: oldName, updatedAt: savedAt }
  const result = refreshUntouchedMomentDemo(stored)
  assert.equal(result.author, '小明')
  assert.equal(result.updatedAt, savedAt)
  assert.equal(stored.author, oldName)
  assert.equal(refreshUntouchedMomentDemo(result), result, 'Repeated loading is idempotent')
})

test('any user edits or unknown fields prevent automatic moment renaming', () => {
  const base = { ...structuredClone(DEFAULT_MOMENT), author: oldName, updatedAt: savedAt }
  for (const patch of [
    { content: '我自己写的草稿' }, { author: '自定义昵称' }, { avatar: 'data:image/png;base64,AA==' },
    { images: ['data:image/png;base64,AA=='] }, { likes: ['小林'] },
    { comments: [{ id: 'c1', author: '小林', content: '收到' }] }, { location: '自定义位置' },
    { coverColor: '#123456' }, { futureField: '保留未来数据' },
  ]) {
    const stored = { ...base, ...patch } as MomentProject
    assert.equal(refreshUntouchedMomentDemo(stored), stored)
  }
})

test('only exact legacy scene examples upgrade, including the example WeChat ID', () => {
  for (const id of ['redpacket', 'profile', 'group'] as WechatSceneKind[]) {
    const fields = { ...SCENE_DEFAULT_FIELDS[id] }
    if (id === 'redpacket') fields.sender = oldName
    if (id === 'profile') { fields.nickname = oldName; fields.wechatId = 'gaopengbin' }
    if (id === 'group') fields.members = fields.members.replace('小明', oldName).replace('小雨', '徐言岩')
    const stored: WechatSceneProject = { id, fields, updatedAt: savedAt, version: 1 }
    const result = refreshUntouchedSceneDemo(stored)
    assert.deepEqual(result.fields, SCENE_DEFAULT_FIELDS[id])
    assert.ok(Object.values(stored.fields).some(value => value.includes(oldName)))
    assert.equal(result.updatedAt, savedAt)
    assert.equal(refreshUntouchedSceneDemo(result), result)
    const edited = { ...stored, fields: { ...fields, [id === 'redpacket' ? 'greeting' : id === 'profile' ? 'signature' : 'announcement']: '用户修改过的内容' } }
    assert.equal(refreshUntouchedSceneDemo(edited), edited)
    const withExtra = { ...stored, fields: { ...fields, extra: '不得丢失' } }
    assert.equal(refreshUntouchedSceneDemo(withExtra), withExtra)
    const missing = { ...stored, fields: {} }
    assert.equal(refreshUntouchedSceneDemo(missing), missing)
  }
})

test('previous group member demo upgrades without overwriting user edits', () => {
  const stored: WechatSceneProject = { id: 'group', fields: { ...SCENE_DEFAULT_FIELDS.group, members: '小明,小林,阿杰,徐言岩,产品同学,设计师' }, updatedAt: savedAt, version: 1 }
  const result = refreshUntouchedSceneDemo(stored)
  assert.deepEqual(result.fields, SCENE_DEFAULT_FIELDS.group)
  assert.equal(result.updatedAt, savedAt)
  assert.ok(!JSON.stringify(SCENE_DEFAULT_FIELDS).includes('徐言岩'))
  assert.ok(stored.fields.members.includes('徐言岩'))
  assert.equal(refreshUntouchedSceneDemo(result), result)
  const edited = { ...stored, fields: { ...stored.fields, announcement: '用户自行编辑的公告' } }
  assert.equal(refreshUntouchedSceneDemo(edited), edited)
})

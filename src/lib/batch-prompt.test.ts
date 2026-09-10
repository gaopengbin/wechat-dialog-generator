import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBatch, chatSnapshot } from './batch'
import { BATCH_CHAT_EXAMPLE, buildBatchPrompt, DEFAULT_BATCH_PROMPT } from './batch-prompt'
import type { PhoneSettings } from '../types'

test('batch prompt and import share an example that the real parser accepts', () => {
  const chats = parseBatch(BATCH_CHAT_EXAMPLE)
  assert.deepEqual(chats.map(chat => chat.title), ['项目沟通', '周末约饭', '学习小组'])
  const snapshots = chats.map(chat => chatSnapshot(chat, {} as PhoneSettings, [], null))
  assert.deepEqual(snapshots.map(snapshot => snapshot.messages.length), [4, 3, 5])
  assert.ok(snapshots[2].messages.some(message => message.type === 'voice'))
  assert.ok(snapshots.every(snapshot => snapshot.users.length >= 2))
})

test('batch prompt incorporates scenario, exact group count and roles with parser limits', () => {
  const prompt = buildBatchPrompt({ topic: ' 客服咨询 ', count: 12, roles: ' 小周、客户小何 ' })
  assert.ok(prompt.includes('主题 / 场景：客服咨询'))
  assert.ok(prompt.includes('必须恰好输出 12 组'))
  assert.ok(prompt.includes('参与角色：小周、客户小何'))
  for (const rule of ['# 聊天标题', '---', '姓名：消息内容', '【09:30】', '150 条消息', '10000 字', '不写解释']) assert.ok(prompt.includes(rule), rule)
  assert.ok(prompt.includes(`\`\`\`text\n${BATCH_CHAT_EXAMPLE}\n\`\`\``))
  assert.ok(prompt.includes('一共 11 行分隔线'))
  assert.ok(prompt.includes('每条文字消息必须实际换行'))
  assert.ok(prompt.includes('不能把整组写成一段'))
  assert.deepEqual(parseBatch(`\`\`\`text\n${BATCH_CHAT_EXAMPLE}\n\`\`\``), parseBatch(BATCH_CHAT_EXAMPLE))
})

test('batch prompt count cannot exceed import capacity; blank inputs use useful defaults', () => {
  for (const [count, expected] of [[51, 50], [0, 1], [-3, 1], [2.8, 2], [NaN, 3], [Infinity, 3]]) {
    const prompt = buildBatchPrompt({ topic: ' ', count, roles: '' })
    assert.ok(prompt.includes(`必须恰好输出 ${expected} 组`))
    assert.ok(prompt.includes(`一共 ${expected - 1} 行分隔线`))
    assert.ok(prompt.includes(DEFAULT_BATCH_PROMPT.topic))
    assert.ok(prompt.includes(DEFAULT_BATCH_PROMPT.roles))
  }
})

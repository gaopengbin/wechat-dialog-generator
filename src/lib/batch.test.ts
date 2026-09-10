import test from 'node:test'
import assert from 'node:assert/strict'
import { cardFilename, chatSnapshot, parseBatch, runBatch, zipImages, type BatchJob } from './batch'
import type { PhoneSettings } from '../types'

const aiMarkdownReply = `# 新版页面确认

## 【09:18】 我：早上好，首页新版大家看过了吗？ 小林：看过了，整体比昨天顺很多。 小雨：我觉得顶部按钮还可以再明显一点。 我：行，我把对比度再提一点。 小王：移动端也顺便看看，标题有点挤。 我：收到，中午前一起调整。 小林：接口这边没变化，可以直接用。 小雨：那我下午再完整走一遍流程。 我：好，有问题直接群里说。

# 周六去吃什么

## 我：这周六晚上大家有安排吗？ 小雨：暂时没有，终于可以出门吃顿好的了。 小林：我也可以，想吃点热乎的。 小王：火锅还是烤肉？ 我：最近火锅吃太多了，投烤肉一票。 小雨：同意，最好别排队两小时那种。 小林：我看到公司附近新开了一家韩式烤肉。 我：那就六点左右？ 小王：可以，我下班路线过去也方便。 小雨：[语音]6：那就这么定，我负责早点过去占位置。 我：成交，周六见。

# AI 工具学习交流

## 【20:35】 我：你们今天试那个新的代码助手了吗？ 小林：试了，改小功能挺快的。 小雨：我拿它整理了一遍学习笔记。 我：我感觉关键还是得把需求说具体。 小王：对，描述太短它就容易自由发挥。 我：你们会先让它出方案再写吗？ 小林：复杂一点的我会，能少返工。 小雨：我现在还会让它最后自己检查一次。 我：这个习惯不错，我也加到流程里。 小王：明天可以各自带一个例子交流一下。 我：行，晚上半小时就够了。

# 临时需求怎么处理

## 【14:06】 我：刚收到一个临时需求，今天要加个导出按钮。 小王：只导当前列表还是全部数据？ 我：产品说先做当前筛选结果。 小林：那接口我这边已经有了，不用新开发。 我：太好了，把字段说明发我一下。 小林：刚发群文件了，注意日期是时间戳。 小雨：我可以帮你测几个筛选组合。 我：行，我先把基础流程接起来。 小王：空数据状态也记得处理一下。 我：收到，这个容易漏。 小雨：你发测试地址后叫我。 我：好，争取四点前给大家。

# 晚上一起刷题

我：今晚还有人准备学习吗？\\
小林：我在，准备看一会儿 TypeScript。\\
小雨：我想复习一下异步和事件循环。\\
小王：那要不一起开着语音学？\\
我：可以，不过先各学各的，九点再交流。\\
小林：正好，我有两个类型体操的问题。\\
小雨：我也攒了一个 Promise 的问题。\\
我：到时候直接把代码贴出来一起看。\\
小王：[语音]5：我可能晚十分钟，你们不用等我。\\
我：没事，我们先从简单的开始。\\
小林：好，那九点群里集合。`

test('imports the reported AI Markdown reply without merging groups or losing messages', () => {
  const chats = parseBatch(aiMarkdownReply)
  assert.deepEqual(chats.map(c => c.title), ['新版页面确认', '周六去吃什么', 'AI 工具学习交流', '临时需求怎么处理', '晚上一起刷题'])
  const snapshots = chats.map(c => chatSnapshot(c, {} as PhoneSettings, [], null))
  assert.deepEqual(snapshots.map(s => s.messages.filter(m => m.type !== 'time').length), [9, 11, 11, 12, 11])
  assert.deepEqual(snapshots.flatMap(s => s.messages.filter(m => m.type === 'time').map(m => m.content)), ['09:18', '20:35', '14:06'])
  assert.deepEqual(snapshots.flatMap(s => s.messages.filter(m => m.type === 'voice').map(m => m.params.duration)), [6, 5])
  assert.ok(snapshots.every(s => s.users.length === 4))
  assert.ok(chats.every(c => !c.body.includes('\\')))
  assert.equal(snapshots[4].messages.at(-1)?.content, '好，那九点群里集合。')
})

test('accepts variable separators, Markdown headings and fenced AI output', () => {
  for (const divider of ['--', '---', '------', '- - -', '——', '————', '***', '___', '===']) {
    assert.equal(parseBatch(`我：第一组\n${divider}\n我：第二组\n${divider}\n我：第三组`).length, 3, divider)
  }
  assert.deepEqual(parseBatch('```text\n## 第一组\n我：你好\n-----\n## 第二组\n我：收到\n```').map(c => c.title), ['第一组', '第二组'])
  assert.equal(parseBatch('# 第一组\n我：你好\n\n# 第二组\n我：收到').length, 2)
  assert.throws(() => parseBatch(Array.from({ length: 51 }, (_, i) => `# 组 ${i}\n我：你好`).join('\n')), /最多 50/)
  assert.throws(() => parseBatch('# 空组\n# 有内容\n我：你好'), /没有有效对话/)
})

test('preserves message punctuation, URLs, times and ordinary inline labels', () => {
  const body = '我：短横线 -- 和 --- 留在正文，链接 https://example.com/a-b，时间 09:18。\n小林：好的，备注：明天继续。\n我：命令参数：--help'
  assert.equal(parseBatch(`# 标题：测试\n${body}`)[0].body, body)
})

test('multiline import preserves paragraphs and rejects limits without truncation', () => {
  assert.deepEqual(parseBatch('# 项目沟通\r\n我：你好\r\n小林：收到\r\n---\r\n# 约饭\r\n我：六点见'), [{ title: '项目沟通', body: '我：你好\n小林：收到' }, { title: '约饭', body: '我：六点见' }])
  assert.throws(() => parseBatch('  ')); assert.throws(() => parseBatch('字'.repeat(41)))
  assert.throws(() => parseBatch(Array(51).fill('标题').join('\n---\n')))
  assert.throws(() => parseBatch('# 标题\n我：' + '字'.repeat(10001)))
  assert.throws(() => parseBatch('这不是聊天格式'))
  assert.equal(parseBatch('我：第一条不能丢\n小林：收到')[0].body, '我：第一条不能丢\n小林：收到')
  assert.equal(cardFilename(0, '../同名:标题'), '001_.._同名_标题.png')
})
function jobs(): BatchJob[] { return ['a', 'b', 'c'].map(id => ({ id, content: { title: id, body: '我：你好' }, mode: 'long', selected: true, state: 'ready' })) }
test('chat snapshots reuse same-name avatars and phone styles without mutating source', () => {
  const settings = { platform: 'android', contactName: '原聊天', backgroundColor: '#abcdef' } as PhoneSettings
  const users = [{ id: 10, name: '小林', avatar: 'data:image/png;base64,AA==' }]
  const snapshot = chatSnapshot({ title: '新对话', body: '我：你好\n小林：收到' }, settings, users, 10)
  assert.equal(snapshot.settings.platform, 'android'); assert.equal(snapshot.settings.backgroundColor, '#abcdef')
  assert.equal(snapshot.users.find(u => u.name === '小林').avatar, users[0].avatar)
  assert.equal(snapshot.selfId, snapshot.users.find(u => u.name === '小林').id)
  snapshot.settings.contactName = '修改副本'; assert.equal(settings.contactName, '原聊天')
})
test('ambiguous debit retries same ID; successful rows never charge again', async () => {
  const rows = jobs(); const ids: string[] = []; const settled = new Set<string>(); let fail = true
  const deps = { render: async () => new Uint8Array([1]), debit: async (id: string) => { ids.push(id); settled.add(id); if (id === 'b' && fail) { fail = false; throw Error('timeout') } }, cancelled: () => false, update: () => {}, complete: () => {} }
  await runBatch(rows, deps)
  assert.deepEqual(rows.map(r => r.state), ['done', 'error', 'ready'])
  await runBatch(rows, deps)
  assert.deepEqual(ids, ['a', 'b', 'b', 'c']); assert.equal(settled.size, 3)
  assert.ok(rows.every(r => r.state === 'done' && r.bytes))
})
test('render failure does not debit; cancellation preserves in-flight success and skips rest', async () => {
  const rows = jobs(); const ids: string[] = []; let cancelled = false
  await runBatch(rows, { render: async j => { if (j.id === 'a') throw Error('overflow'); return new Uint8Array([1]) }, debit: async id => { ids.push(id); cancelled = true }, cancelled: () => cancelled, update: () => {}, complete: () => {} })
  assert.deepEqual(ids, ['b']); assert.equal(rows[0].locked, undefined); assert.equal(rows[1].state, 'done'); assert.equal(rows[2].state, 'ready')
})
test('ZIP uses UTF8 filenames, valid CRC32, entry offsets and original bytes', async () => {
  const bytes = new TextEncoder().encode('123456789')
  const zip = new Uint8Array(await zipImages([{ name: '001_中文.png', bytes }]).arrayBuffer())
  const view = new DataView(zip.buffer)
  assert.equal(view.getUint32(0, true), 0x04034b50)
  assert.equal(view.getUint16(6, true), 0x800)
  assert.equal(view.getUint32(14, true), 0xcbf43926)
  const length = view.getUint16(26, true)
  assert.equal(new TextDecoder().decode(zip.slice(30, 30 + length)), '001_中文.png')
  assert.deepEqual(zip.slice(30 + length, 30 + length + bytes.length), bytes)
  const central = 30 + length + bytes.length
  assert.equal(view.getUint32(central, true), 0x02014b50)
  assert.equal(view.getUint32(zip.length - 6, true), central)
})

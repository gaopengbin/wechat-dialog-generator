import test from 'node:test'
import assert from 'node:assert/strict'
import { guideChapters, guideHref, readGuideId, searchGuide } from './toolbox-guide'
import { parseChatRecord } from './parser'
import { parseBatch } from './batch'
import { readWorkspaceRoute, workspaceHref } from './workspace-route'
import { readFileSync } from 'node:fs'

test('complete guide covers all seven editors plus account, export, saved work and recovery without broken relations', () => {
  assert.equal(guideChapters.length, 17)
  assert.equal(new Set(guideChapters.map(c => c.id)).size, 17)
  for (const tool of ['chat', 'batch', 'moments', 'payment', 'redpacket', 'profile', 'group']) {
    const chapter = guideChapters.find(c => c.id === tool)!
    assert.equal(chapter.route, tool); assert.ok(chapter.screenshot)
    assert.ok(chapter.sections.length >= 2); assert.ok(chapter.faqs.length)
  }
  for (const chapter of guideChapters) {
    assert.ok(chapter.sections.every(s => s.steps.length >= 2))
    assert.ok(chapter.related.every(id => guideChapters.some(c => c.id === id)))
  }
})

test('every runnable tutorial example works with the actual chat and batch parsers', () => {
  for (const chapter of guideChapters) for (const section of chapter.sections) {
    if (section.canLoadChat) {
      assert.ok(section.example)
      const parsed = parseChatRecord(section.example!)
      assert.ok(parsed.users.length >= 2); assert.ok(parsed.messages.length >= 2)
    }
    if (chapter.id === 'batch' && section.example) {
      const groups = parseBatch(section.example)
      assert.equal(groups.length, 2)
      assert.ok(groups.every(g => parseChatRecord(g.body).users.length === 2))
    }
  }
})

test('chapter links survive refresh, browser history, static subpaths and preserve invites', () => {
  for (const base of ['https://chat.laogao.xyz/?tool=group&invite=a%2Bb&tag=1&tag=2', 'https://example.github.io/toolbox/?tool=chat&utm_source=test']) {
    for (const chapter of guideChapters) {
      const href = guideHref(chapter.id, base)
      assert.equal(readWorkspaceRoute(href), 'resources')
      assert.equal(readGuideId(href), chapter.id)
      assert.equal(new URL(href, base).pathname, new URL(base).pathname)
      assert.equal(new URL(href, base).searchParams.get('invite'), new URL(base).searchParams.get('invite'))
      const editor = workspaceHref('chat', new URL(href, base).href)
      assert.equal(new URL(editor, base).searchParams.has('guide'), false)
      assert.equal(readWorkspaceRoute(editor), 'chat')
    }
  }
  assert.equal(readGuideId('/?page=resources#templates'), 'templates')
  assert.equal(readGuideId('/?page=resources#faq'), 'troubleshoot')
  assert.equal(readGuideId('/?page=resources&guide=not-real'), 'start')
  assert.equal(readGuideId('http://['), 'start')
})

test('search reaches instructions and limitations, supports multiple words and handles no results', () => {
  assert.ok(searchGuide('语音通话').some(c => c.id === 'messages'))
  assert.ok(searchGuide('清空聊天').some(c => c.id === 'chat'))
  assert.ok(searchGuide('密码 验证码').some(c => c.id === 'account'))
  assert.ok(searchGuide('ZIP').some(c => c.id === 'batch'))
  assert.equal(searchGuide('  ').length, guideChapters.length)
  assert.equal(searchGuide('nonexistent-x91y').length, 0)
})

test('each editor tutorial ships its real, readable desktop screenshot', () => {
  for (const chapter of guideChapters) {
    if (!chapter.screenshot) continue
    const bytes = readFileSync(new URL('../../public/guides/' + chapter.screenshot, import.meta.url))
    assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff')
    assert.ok(bytes.length > 30000)
  }
})

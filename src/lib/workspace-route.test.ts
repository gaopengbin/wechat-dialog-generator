import test from 'node:test'
import assert from 'node:assert/strict'
import { readWorkspaceRoute, workspaceHref, type WorkspaceRoute } from './workspace-route'

const routes: WorkspaceRoute[] = ['home', 'resources', 'exports', 'chat', 'batch', 'moments', 'payment', 'redpacket', 'profile', 'group']

test('every page survives direct loading and refresh on both root and static-host subpaths', () => {
  for (const base of ['https://chat.laogao.xyz/', 'https://example.github.io/wechat-toolbox/']) {
    for (const route of routes) {
      const href = workspaceHref(route, base)
      const directUrl = new URL(href, base)
      assert.equal(directUrl.pathname, new URL(base).pathname)
      assert.equal(readWorkspaceRoute(directUrl.href), route)
      assert.equal(readWorkspaceRoute(directUrl.pathname + directUrl.search), route)
    }
  }
})

test('legacy editor, resource, and shared-template links resolve to their work pages', () => {
  const legacy: [string, WorkspaceRoute][] = [
    ['#editor', 'chat'], ['#templates', 'resources'], ['#guide', 'resources'],
    ['#faq', 'resources'], ['#moments-editor', 'moments'], ['#scene-editor', 'payment'],
    ['#same=g1.encoded-payload', 'chat'],
  ]
  for (const [hash, route] of legacy) {
    assert.equal(readWorkspaceRoute(`https://chat.laogao.xyz/?invite=abc${hash}`), route)
  }
  assert.equal(readWorkspaceRoute('/?tool=batch#editor'), 'batch')
  assert.equal(readWorkspaceRoute('/?page=resources#same=g1.payload'), 'resources')
})

test('unknown or malformed inputs have a safe home fallback', () => {
  for (const input of ['', '/?tool=unknown', '/?page=unknown', '/#unknown', 'http://[', 'javascript:alert(1)', '/?tool=CHAT']) {
    assert.equal(readWorkspaceRoute(input), 'home')
  }
  assert.equal(workspaceHref('chat', 'http://['), '/?tool=chat')
  assert.equal(workspaceHref('home', 'javascript:alert(1)'), '/')
})

test('navigation preserves invites, attribution, encoded values, duplicate unrelated keys and subpaths', () => {
  const base = 'https://example.github.io/tools/index.html?invite=a%2Bb%26c&utm_campaign=%E6%98%A5%E6%97%A5+%E5%88%86%E4%BA%AB&tag=one&tag=two&tool=chat&tool=group&page=resources#same=g1.payload'
  const href = workspaceHref('batch', base)
  const parsed = new URL(href, 'https://example.github.io')
  assert.equal(parsed.pathname, '/tools/index.html')
  assert.equal(parsed.searchParams.get('invite'), 'a+b&c')
  assert.equal(parsed.searchParams.get('utm_campaign'), '春日 分享')
  assert.deepEqual(parsed.searchParams.getAll('tag'), ['one', 'two'])
  assert.deepEqual(parsed.searchParams.getAll('tool'), ['batch'])
  assert.equal(parsed.searchParams.has('page'), false)
  assert.equal(parsed.hash, '')
  assert.equal(readWorkspaceRoute(href), 'batch')
})

test('home and resources remove previous tool and hash without losing acquisition information', () => {
  assert.equal(workspaceHref('home', '/project/?invite=abc&tool=chat&page=resources#editor'), '/project/?invite=abc')
  assert.equal(workspaceHref('resources', '/project/?invite=abc&tool=chat#guide'), '/project/?invite=abc&page=resources')
  assert.equal(readWorkspaceRoute('/?tool=%63hat'), 'chat')
  assert.equal(readWorkspaceRoute('/?tool=unknown&page=resources'), 'resources')
})

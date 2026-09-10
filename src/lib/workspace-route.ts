import type { WechatTool } from './product-analytics'

export type WorkspaceRoute = 'home' | 'resources' | 'exports' | WechatTool

const tools: readonly WechatTool[] = ['chat', 'batch', 'moments', 'payment', 'redpacket', 'profile', 'group']
const fallbackBase = 'https://workspace.invalid/'

function parseUrl(value: string): URL {
  try {
    const parsed = new URL(value, fallbackBase)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed : new URL(fallbackBase)
  } catch {
    return new URL(fallbackBase)
  }
}

/** Query-based pages survive refreshes on static hosts, including GitHub Pages subpaths. */
export function readWorkspaceRoute(url: string): WorkspaceRoute {
  const parsed = parseUrl(url)
  const tool = parsed.searchParams.get('tool')
  if (tools.includes(tool as WechatTool)) return tool as WechatTool
  if (parsed.searchParams.get('page') === 'resources') return 'resources'
  if (parsed.searchParams.get('page') === 'exports') return 'exports'

  switch (parsed.hash) {
    case '#editor': return 'chat'
    case '#templates':
    case '#guide':
    case '#faq': return 'resources'
    case '#moments-editor': return 'moments'
    case '#scene-editor': return 'payment'
    default: return parsed.hash.startsWith('#same=') ? 'chat' : 'home'
  }
}

/** Keep attribution/invites intact, but do not carry a previous page's content hash. */
export function workspaceHref(route: WorkspaceRoute, baseUrl: string): string {
  const parsed = parseUrl(baseUrl)
  parsed.searchParams.delete('tool')
  parsed.searchParams.delete('page')
  if (route === 'resources' || route === 'exports') parsed.searchParams.set('page', route)
  else if (route !== 'home') parsed.searchParams.set('tool', route)
  parsed.hash = ''
  return `${parsed.pathname}${parsed.search}${parsed.hash}`
}

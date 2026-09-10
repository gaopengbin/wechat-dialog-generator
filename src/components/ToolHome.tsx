import { ArrowRight, BookOpen, ShieldCheck } from 'lucide-react'
import { workspaceTools } from '@/lib/workspace-tools'
import type { WorkspaceRoute } from '@/lib/workspace-route'
import { workspaceHref } from '@/lib/workspace-route'
import type { ReactNode, MouseEvent } from 'react'

export function StudioLink({ route, onNavigate, children, ...props }: { route: WorkspaceRoute; onNavigate: (route: WorkspaceRoute) => void; children: ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate(route)
  }
  return <a {...props} href={workspaceHref(route, window.location.href)} onClick={handleClick}>{children}</a>
}

export function ToolHome({ onNavigate, promotion, hasDraft }: { onNavigate: (route: WorkspaceRoute) => void; promotion: ReactNode; hasDraft: boolean }) {
  return <main className="studio-home">
    <div className="studio-home-heading"><span className="studio-eyebrow">创作工作台</span><h1>选择工具，开始创作。</h1><p>从一段对话到一批素材，每种创作都有自己的工作空间。</p></div>
    <div className="studio-home-toolbar"><span><ShieldCheck size={15} /> 图片与创作内容在本地处理</span><StudioLink route="resources" onNavigate={onNavigate}><BookOpen size={15} /> 模板与使用指南 <ArrowRight size={14} /></StudioLink></div>
    <div className="studio-tool-grid">{workspaceTools.map(tool => <StudioLink key={tool.id} route={tool.id} onNavigate={onNavigate} className={`studio-tool-card ${tool.id === 'chat' ? 'is-featured' : ''}`}><div className="studio-tool-card-top"><span className="studio-tool-icon"><tool.icon size={22} /></span>{'tag' in tool && <span className="studio-tag">{tool.tag}</span>}</div><h2>{tool.title}</h2><p>{tool.detail}</p><span className="studio-tool-open">{tool.id === 'chat' && hasDraft ? '继续编辑对话' : '进入工作页'}<ArrowRight size={16} /></span></StudioLink>)}</div>
    <div className="studio-home-promotion">{promotion}</div>
    <p className="studio-local-note">草稿保存在当前浏览器。模拟素材仅用于内容创作与设计演示，请勿用于伪造凭证或欺骗他人。</p>
  </main>
}

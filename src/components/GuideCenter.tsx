import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleDollarSign, Copy, ExternalLink, FileText, FolderOpen, Gift, History, Image, LayoutTemplate, MessageSquare, Palette, Search, ShieldCheck, Sparkles, UserRound, UsersRound, Wrench, X, ZoomIn } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { SelectField } from './ui/select'
import { Disclosure } from './ui/controls'
import { GrowthContent } from './GrowthContent'
import { StudioLink } from './ToolHome'
import { guideChapters, guideHref, readGuideId, searchGuide, type GuideId } from '@/lib/toolbox-guide'
import type { WorkspaceRoute } from '@/lib/workspace-route'
import './GuideCenter.css'

const icons = { start: BookOpen, chat: MessageSquare, messages: Image, appearance: Palette, batch: Copy, moments: Image, payment: CircleDollarSign, redpacket: Gift, profile: UserRound, group: UsersRound, drafts: FolderOpen, templates: LayoutTemplate, exports: History, account: UserRound, rewards: Gift, troubleshoot: Wrench, privacy: ShieldCheck }
const groups = [...new Set(guideChapters.map(chapter => chapter.group))]
type Props = { onNavigate: (route: WorkspaceRoute) => void; onUseTemplate: (content: string, id: string) => void; onAccount: () => void }

export function GuideCenter({ onNavigate, onUseTemplate, onAccount }: Props) {
  const [selected, setSelected] = useState<GuideId>(() => readGuideId(window.location.href))
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState('')
  const [copyError, setCopyError] = useState('')
  const [zoom, setZoom] = useState(false)
  const scroll = useRef<HTMLElement>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const chapter = guideChapters.find(item => item.id === selected) || guideChapters[0]
  const index = guideChapters.indexOf(chapter)
  const matches = searchGuide(query)
  useEffect(() => {
    const pop = () => { setSelected(readGuideId(window.location.href)); setQuery('') }
    window.addEventListener('popstate', pop)
    return () => { window.removeEventListener('popstate', pop); if (copyTimer.current) clearTimeout(copyTimer.current) }
  }, [])
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0 }, [selected])
  const go = (id: GuideId) => {
    window.history.pushState(null, '', guideHref(id, window.location.href))
    setSelected(id); setQuery(''); setCopied(''); setCopyError('')
    if (scroll.current) scroll.current.scrollTop = 0
  }
  const follow = (event: MouseEvent<HTMLAnchorElement>, id: GuideId) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault(); go(id)
  }
  const copyExample = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setCopyError(''); if (copyTimer.current) clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(''), 2000) }
    catch { setCopied(''); setCopyError(key) }
  }
  const screenshot = chapter.screenshot ? `${import.meta.env.BASE_URL}guides/${chapter.screenshot}` : ''
  return <main className="guide-center" aria-label="完整功能教程">
    <header className="guide-center-header"><div><span className="guide-kicker"><BookOpen size={14} /> 使用手册</span><h1>模板与使用指南</h1><p>7 个创作工作页，17 篇操作教程。从第一条消息到导出、保存与问题排查。</p></div><div className="guide-search-wrap"><Search size={17} aria-hidden="true" /><Input aria-label="搜索教程" type="search" placeholder="搜索功能、按钮或问题…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery('') }} />{query && <Button variant="ghost" size="icon" aria-label="清空教程搜索" onClick={() => setQuery('')}><X size={15} /></Button>}</div></header>
    <div className="guide-mobile-select"><SelectField aria-label="选择教程章节" value={selected} onValueChange={value => go(value as GuideId)} options={guideChapters.map(item => ({ value: item.id, label: item.title }))} /></div>
    <div className="guide-layout">
      <nav className="guide-navigation" aria-label="教程目录">
        {groups.map(group => <section key={group}><h2>{group}</h2>{matches.filter(item => item.group === group).map(item => { const Icon = icons[item.id]; return <a key={item.id} href={guideHref(item.id, window.location.href)} onClick={event => follow(event, item.id)} className={`guide-topic-link ${!query && item.id === selected ? 'is-active' : ''}`} aria-current={!query && item.id === selected ? 'page' : undefined}><Icon size={16} /><span>{item.title}</span></a> })}</section>)}
        {query && !matches.length && <p className="guide-empty-nav">没有找到匹配章节。</p>}
        <div className="guide-navigation-note"><ShieldCheck size={14} /><span>按实际工作页编写<br />示例不含私人聊天</span></div>
      </nav>
      <section className="guide-reader" ref={scroll} aria-label={query ? '教程搜索结果' : `${chapter.title}教程正文`} tabIndex={0}>
        {query.trim() ? <div className="guide-article guide-search-results"><span className="guide-kicker">搜索结果 · {matches.length} 篇</span><h2>查找“{query}”</h2>{matches.length ? matches.map(item => { const Icon = icons[item.id]; return <a key={item.id} href={guideHref(item.id, window.location.href)} onClick={event => follow(event, item.id)} className="guide-result-card"><Icon size={21} /><div><small>{item.group}</small><h3>{item.title}</h3><p>{item.description}</p></div><ArrowRight size={18} /></a> }) : <div className="guide-search-empty"><Search size={30} /><h3>暂时没有找到</h3><p>试试“图片”“批量”“下载”“密码”或“清空聊天”。</p><Button variant="outline" onClick={() => setQuery('')}>返回当前教程</Button></div>}</div> : <article className="guide-article" key={chapter.id}>
          <header className="guide-article-header"><div className="guide-article-eyebrow"><span>{chapter.group}</span><span>{String(index + 1).padStart(2, '0')} / {guideChapters.length}</span></div><h2>{chapter.title}</h2><p>{chapter.description}</p><div className="guide-article-actions">{chapter.route && <StudioLink route={chapter.route} onNavigate={onNavigate} className="btn btn-primary">{chapter.route === 'exports' ? '打开导出日志' : '打开对应工作页'}<ExternalLink size={14} /></StudioLink>}{chapter.id === 'account' && <Button onClick={onAccount}><UserRound size={15} /> 打开账户</Button>}{screenshot && <Button variant="outline" size="sm" onClick={() => setZoom(true)}><Image size={14} /> 查看界面图</Button>}<span>编辑与预览免费 · 导出需登录</span></div></header>
          {chapter.id === 'start' && <ol className="guide-quick-path" aria-label="制作图片的三个步骤"><li><span>01</span><b>选功能、填内容</b><small>先用少量文字试一次</small></li><li><span>02</span><b>看预览、调样式</b><small>头像、身份和消息分别设置</small></li><li><span>03</span><b>登录后导出</b><small>去浏览器下载记录找文件</small></li></ol>}
          <nav className="guide-on-this-page" aria-label="本篇步骤"><span>本篇内容</span>{chapter.sections.map((section, i) => <a key={section.title} href={`#guide-${chapter.id}-${i + 1}`}>{section.title}</a>)}{screenshot && <Button variant="ghost" size="sm" onClick={() => setZoom(true)}>工作页截图 <ZoomIn size={13} /></Button>}</nav>
          {chapter.sections.map((section, sectionIndex) => <section id={`guide-${chapter.id}-${sectionIndex + 1}`} className="guide-section" key={section.title}><h3><span>{sectionIndex + 1}</span>{section.title}</h3><ol className="guide-steps">{section.steps.map((step, i) => <li key={step}><b aria-hidden="true">{i + 1}</b><p>{step}</p></li>)}</ol>{section.example && <div className="guide-example"><div><span><FileText size={15} /> 可复制的示例</span><Button size="sm" variant="outline" onClick={() => void copyExample(section.example!, `${chapter.id}-${sectionIndex}`)}>{copied === `${chapter.id}-${sectionIndex}` ? <Check size={14} /> : <Copy size={14} />}{copied === `${chapter.id}-${sectionIndex}` ? '已复制' : '复制示例'}</Button></div><pre tabIndex={0}>{section.example}</pre>{copyError === `${chapter.id}-${sectionIndex}` && <p role="status" className="guide-copy-error">浏览器没有允许复制。可直接选中上面的示例文字，手动复制。</p>}{section.canLoadChat && <Button variant="outline" size="sm" onClick={() => onUseTemplate(section.example!, `guide-${chapter.id}-${sectionIndex}`)}><Sparkles size={14} /> 载入聊天工作页</Button>}{section.canLoadChat && <small>先填入导入框，点击“解析并导入”后才更新预览。</small>}</div>}{section.tip && <aside className="guide-tip"><ShieldCheck size={16} /><p>{section.tip}</p></aside>}</section>)}
          {chapter.id === 'templates' && <GrowthContent templatesOnly onUseTemplate={onUseTemplate} onOpenEditor={() => onNavigate('chat')} />}
          {screenshot && <figure className="guide-screenshot"><figcaption><Image size={16} /><span>工作页位置参考</span></figcaption><Button variant="outline" className="guide-screenshot-button" aria-label={`放大${chapter.title}工作页截图`} onClick={() => setZoom(true)}><img src={screenshot} loading="lazy" alt={`${chapter.title}的编辑面板与右侧预览，具体按钮按上方步骤查找`} /><span><ZoomIn size={14} /> 点击查看大图</span></Button><p>截图展示工作页位置；你当前的草稿、头像和剩余额度可能不同。</p></figure>}
          <section className="guide-faq"><h3>你可能还会问</h3>{chapter.faqs.map(faq => <Disclosure key={faq.question} title={faq.question}><p>{faq.answer}</p></Disclosure>)}</section>
          <section className="guide-related"><h3>接着看</h3><div>{chapter.related.map(id => { const target = guideChapters.find(item => item.id === id)!; return <a key={id} href={guideHref(id, window.location.href)} onClick={event => follow(event, id)}>{target.title}<ArrowRight size={14} /></a> })}</div></section>
          <footer className="guide-pagination">{index > 0 ? <a href={guideHref(guideChapters[index - 1].id, window.location.href)} onClick={event => follow(event, guideChapters[index - 1].id)}><ArrowLeft size={16} /><span><small>上一篇</small>{guideChapters[index - 1].title}</span></a> : <span />}{index < guideChapters.length - 1 ? <a href={guideHref(guideChapters[index + 1].id, window.location.href)} onClick={event => follow(event, guideChapters[index + 1].id)}><span><small>下一篇</small>{guideChapters[index + 1].title}</span><ArrowRight size={16} /></a> : <span />}</footer>
        </article>}
      </section>
    </div>
    <Dialog.Root open={zoom} onOpenChange={setZoom}><Dialog.Portal><Dialog.Backdrop className="guide-image-backdrop" /><Dialog.Popup className="guide-image-dialog"><header><Dialog.Title>{chapter.title} · 工作页参考</Dialog.Title><Dialog.Close render={<Button variant="ghost" size="icon" aria-label="关闭参考截图" />}><X size={19} /></Dialog.Close></header><Dialog.Description className="sr-only">按 Escape 或关闭按钮返回教程。</Dialog.Description><img src={screenshot} alt={`${chapter.title}工作页完整截图`} /></Dialog.Popup></Dialog.Portal></Dialog.Root>
  </main>
}

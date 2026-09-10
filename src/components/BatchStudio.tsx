import { useEffect, useRef, useState } from 'react'
import { Download, FileInput, Layers3, ListChecks, Plus, RotateCcw, Square, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { Checkbox, Tabs, TabsContent, TabsList, TabsTrigger } from './ui/controls'
import { ConfirmDialog } from './ui/confirm-dialog'
import { Input } from './ui/input'
import { Progress } from './ui/progress'
import { SelectField } from './ui/select'
import { Textarea } from './ui/textarea'
import { PhonePreview } from './PhonePreview'
import { SettingsPanel } from './SettingsPanel'
import { UserAvatarManager } from './UserAvatarManager'
import { WorkspacePanels } from './WorkspacePanels'
import { BatchPromptDialog } from './BatchPromptDialog'
import { renderBatchChat } from './batch-chat-render'
import { cardFilename, chatSnapshot, parseBatch, runBatch, zipImages, type BatchJob, type CaptureMode, type ChatSnapshot } from '@/lib/batch'
import { BATCH_CHAT_EXAMPLE } from '@/lib/batch-prompt'
import { beginExportLog } from '@/lib/export-log'
import './BatchStudio.css'

export function BatchStudio({ remaining, unlimited = false, onDebit, onComplete, currentChat }: {
  remaining: number; unlimited?: boolean; onDebit: (id: string) => Promise<void>; onComplete: (id: string) => void; currentChat: ChatSnapshot
}) {
  const [text, setText] = useState(BATCH_CHAT_EXAMPLE)
  const [mode, setMode] = useState<CaptureMode>('long')
  const [jobs, setJobs] = useState<BatchJob[]>([])
  const [activeId, setActiveId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [view, setView] = useState<'import' | 'edit'>('import')
  const [editSection, setEditSection] = useState<'content' | 'people' | 'settings'>('content')
  const stop = useRef(false), running = useRef(false)
  const active = jobs.find(j => j.id === activeId)
  const selected = jobs.filter(j => j.selected), pending = selected.filter(j => j.state !== 'done')
  const successes = jobs.filter(j => j.state === 'done'), failed = jobs.filter(j => j.state === 'error')
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (jobs.length) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [jobs.length])
  useEffect(() => () => { stop.current = true }, [])
  function updateJob(id: string, patch: Partial<BatchJob>) {
    setJobs(current => current.map(j => j.id === id && !(j.locked && ('snapshot' in patch || 'content' in patch || 'mode' in patch)) ? { ...j, ...patch } : j)); setConfirmed(false)
  }
  function addChats() {
    try {
      const contents = parseBatch(text)
      if (jobs.length + contents.length > 50) throw new Error('每批最多 50 组，请先下载并清空。')
      const added: BatchJob[] = contents.map(content => ({ id: crypto.randomUUID(), content, mode, snapshot: chatSnapshot(content, currentChat.settings, currentChat.users, currentChat.selfId), selected: true, state: 'ready' }))
      setJobs(current => [...current, ...added]); setActiveId(added[0].id); setConfirmed(false)
      setView('edit'); setEditSection('content')
      setMessage(`已添加 ${added.length} 组聊天到队列，原有 ${jobs.length} 组保持不变。`)
    } catch (e) { setMessage(e instanceof Error ? e.message : '对话解析失败') }
  }
  function applySource() {
    if (!active || active.locked || busy) return
    try {
      updateJob(active.id, { snapshot: chatSnapshot(active.content, active.snapshot!.settings, active.snapshot!.users, active.snapshot!.selfId), state: 'ready', error: undefined, dirty: false })
      setMessage('本组对话已更新到预览。')
    } catch (e) { updateJob(active.id, { error: e instanceof Error ? e.message : '解析失败', state: 'error' }) }
  }
  async function generate() {
    if (running.current || !selected.length) return
    if (!pending.length) { download(); return }
    if (!confirmed) return
    running.current = true; stop.current = false; setBusy(true); setMessage('正在导出，完成后自动下载 ZIP，请保留此页。')
    try {
      await runBatch(jobs, { render: async job => {
        if (job.dirty) throw new Error('对话已修改，请先更新本组预览。')
        return renderBatchChat(job)
      }, debit: onDebit, cancelled: () => stop.current, update: () => setJobs([...jobs]), complete: onComplete })
      const unfinished = jobs.filter(j => j.selected && j.state !== 'done').length
      const note = unfinished ? `${stop.current ? '已停止后续任务，' : ''}${unfinished} 组未完成，可在原队列查看原因并重试。` : ''
      if (jobs.some(j => j.selected && j.state === 'done' && j.bytes)) download(note)
      else {
        void beginExportLog({ tool: 'batch', mode: 'zip', count: selected.length }).finish(stop.current ? 'cancelled' : 'failed', '没有可下载的图片。' + note)
        setMessage('本次没有可下载的图片。' + note)
      }
    } finally { running.current = false; setBusy(false); setConfirmed(false) }
  }
  function download(note = '') {
    const files = jobs.flatMap((j, index) => j.selected && j.state === 'done' && j.bytes ? [{ name: cardFilename(index, j.content.title), bytes: j.bytes }] : [])
    if (!files.length) return
    const filename = `聊天截图_${files.length}组.zip`
    const log = beginExportLog({ tool: 'batch', mode: 'zip', filename, count: files.length })
    try {
      const url = URL.createObjectURL(zipImages(files)); const link = document.createElement('a')
      link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000)
      void log.finish('download_requested', note || '重复下载不扣额度')
      setMessage(`已发起 ZIP 下载，包含 ${files.length} 张聊天图。${note}若浏览器拦截下载，请点击“重新下载已完成 ZIP”，不再扣额度。`)
    } catch { void log.finish('failed', 'ZIP 打包或下载操作失败'); setMessage('打包失败，图片仍保留在本页。请减少勾选后重试，不会重复扣费。') }
  }
  const locked = busy || !!active?.locked
  const preview = active?.snapshot ? <div className="batch-chat-preview">
    <PhonePreview key={active.id} {...active.snapshot} onUpdateMessage={locked ? undefined : (id, content) => updateJob(active.id, { snapshot: { ...active.snapshot!, messages: active.snapshot!.messages.map(m => m.id === id ? { ...m, content } : m) } })} />
  </div> : <div className="batch-empty batch-preview-empty"><Layers3 size={32} /><h3>聊天图将在这里预览</h3><p>导入后逐组检查效果，使用与单张聊天相同的手机界面。</p><Button variant="outline" disabled={busy} onClick={addChats}>预览示例聊天</Button></div>
  const exportActions = <div className="batch-export" aria-label="聊天预览与导出">
    <div className="batch-progress"><span>已完成 <strong>{successes.length} / {jobs.length}</strong> 组{failed.length ? ` · ${failed.length} 待重试` : ''}</span><span>{unlimited ? '会员不限次' : <>可用 <strong>{remaining}</strong> 次</>}</span><Progress max={Math.max(jobs.length, 1)} value={successes.length} aria-label="批量生成进度" className="batch-progress-bar" /></div>
    <p>已选 {selected.length} 组，{unlimited ? '会员有效期内不扣次数包及奖励额度。' : <>本轮最多使用 <strong>{pending.length} 次</strong>额度。</>}</p>
    {!unlimited && pending.length > remaining && <p className="batch-error">额度不足以完成全部任务，请减少勾选或补充额度。原编号重试仍可进行。</p>}
    <label className="batch-confirm"><Checkbox checked={confirmed} disabled={busy || !pending.length} onCheckedChange={setConfirmed} aria-label={unlimited ? '确认导出所选聊天图片' : '确认按聊天图片张数使用额度'} /> {unlimited ? '确认导出所选聊天图片' : '我确认本批按聊天图片张数使用额度'}</label>
    <div className="batch-actions batch-export-actions">{busy ? <Button variant="outline" onClick={() => { stop.current = true }}><Square size={15} /> 停止后续任务</Button> : <Button disabled={!selected.length || (!!pending.length && !confirmed)} onClick={() => void generate()}>{pending.length && failed.length ? <RotateCcw size={16} /> : <Download size={16} />}{!pending.length && selected.length ? '重新下载已完成 ZIP' : failed.length ? '重试并导出 ZIP' : '导出所选 ZIP'}</Button>}{pending.length > 0 && selected.some(j => j.state === 'done') && <Button variant="outline" disabled={busy} onClick={() => download()}><Download size={16} /> 重新下载已完成 ZIP</Button>}</div>
    <p className="batch-export-note">一键生成并自动下载。未完成项保留，重新下载不扣额度。</p>
    {message && <p className="batch-message" role="status">{message}</p>}
  </div>
  return <div className="batch-studio" id="batch-studio">
    <WorkspacePanels preview={preview} previewActions={exportActions} previewTitle={active ? active.content.title : '聊天预览'} previewDescription={active ? `${active.mode === 'long' ? '完整长截图' : '标准截图 · 顶部一屏'} · ${active.snapshot?.messages.length || 0} 条消息` : '选择一组聊天，查看导出效果'}>
      <Tabs className="batch-workspace" value={view} onValueChange={value => setView(value as 'import' | 'edit')}>
      <header className="batch-heading"><h2>批量聊天制作</h2>
      <TabsList className="batch-view-switch" aria-label="批量制作工作视图">
        <TabsTrigger value="import"><FileInput size={16} /> 导入聊天</TabsTrigger>
        <TabsTrigger value="edit"><ListChecks size={16} /> 编辑与队列 <span className="batch-tab-count">{jobs.length}</span></TabsTrigger>
      </TabsList><span className="batch-count">{jobs.length} / 50 组</span></header>
      <TabsContent value="import" id="batch-import-panel" className="batch-compose" keepMounted aria-label="导入多组聊天">
        <div className="batch-import-toolbar"><label htmlFor="batch-input">聊天记录</label><div className="batch-import-options"><label htmlFor="batch-mode">默认导出方式</label><SelectField id="batch-mode" value={mode} disabled={busy} onValueChange={value => setMode(value as CaptureMode)} options={[{ value: 'long', label: '完整长截图（全部消息）' }, { value: 'standard', label: '标准截图（顶部一屏）' }]} /><Button size="sm" variant="ghost" disabled={busy} onClick={() => setText(BATCH_CHAT_EXAMPLE)}>填入示例</Button><BatchPromptDialog disabled={busy} /></div></div>
        <p id="batch-format-hint" className="batch-hint">每行“姓名：消息”，用独立一行 <code>---</code> 分组。<code># 聊天标题</code> 可设置联系人名称。</p>
        <Textarea id="batch-input" aria-describedby="batch-format-hint" rows={8} value={text} maxLength={100000} disabled={busy} onChange={e => setText(e.target.value)} />
        <div className="batch-actions"><Button disabled={busy || !text.trim() || jobs.length >= 50} onClick={addChats}><Plus size={16} /> 添加到批量队列</Button><span className="batch-hint">仅添加上方文本，不覆盖已有对话。</span></div>
        <div className="batch-import-notes"><p>自动沿用聊天样式与同名角色头像，支持时间、语音和图片。</p><p>刷新前请下载；仅用于授权素材与内容创作，禁止伪造凭证。</p></div>
      </TabsContent>
      <TabsContent value="edit" id="batch-edit-panel" className="batch-editor" keepMounted aria-label="逐组编辑与队列">
        <div className="batch-queue-area"><div className="batch-toolbar"><h3>聊天列表 <span>{jobs.length} 组</span></h3><div className="batch-actions"><Button size="sm" variant="ghost" disabled={busy || !jobs.length} onClick={() => { setJobs(jobs.map(j => ({ ...j, selected: true }))); setConfirmed(false) }}>全选</Button><Button size="sm" variant="ghost" disabled={busy || !jobs.length} onClick={() => { setJobs(jobs.map(j => ({ ...j, selected: false }))); setConfirmed(false) }}>取消选择</Button><Button size="sm" variant="ghost" disabled={busy || !jobs.length} onClick={() => setClearOpen(true)}><Trash2 size={14} /> 清空</Button></div></div>
        {!jobs.length ? <div className="batch-empty"><ListChecks size={28} /><h3>队列还是空的</h3><p>先导入聊天记录，再逐组编辑内容与手机样式。</p><Button onClick={() => setView('import')}><Plus size={16} /> 添加聊天</Button></div> : <div className="batch-queue-content">
          <div className="batch-chat-list" aria-label="本批聊天队列">{jobs.map((job, index) => <div className={`batch-chat-row ${job.id === activeId ? 'is-active' : ''}`} key={job.id}><Checkbox aria-label={`选择第 ${index + 1} 组`} checked={job.selected} disabled={busy} onCheckedChange={checked => updateJob(job.id, { selected: checked })} /><Button variant="ghost" className="batch-chat-open" aria-pressed={job.id === activeId} onClick={() => setActiveId(job.id)}><span className="batch-row-content"><strong>{index + 1}. {job.content.title}</strong><small>{job.snapshot?.messages.length || 0} 条消息 · {job.mode === 'long' ? '长截图' : '标准截图'}</small></span><span className={`batch-status batch-status-${job.state}`}>{({ ready: '待生成', working: '处理中', done: '已完成', error: '待重试' })[job.state]}</span></Button></div>)}</div>
          <div className="batch-queue-footer"><span className="batch-hint">勾选导出范围，点击名称编辑。</span><Button variant="ghost" size="sm" disabled={busy || jobs.length >= 50} onClick={() => setView('import')}><Plus size={14} /> 继续添加</Button></div>
        </div>}
        </div>
          {active?.snapshot && <div className="batch-chat-controls">
            <div className="batch-section-heading"><h3>编辑当前聊天</h3><span className="batch-count">第 {jobs.findIndex(job => job.id === active.id) + 1} 组</span></div>
            {active.error && <p className="batch-error" role="alert">{active.error}</p>}{active.locked && <p className="batch-notice">已发起额度确认，内容已锁定，保证原编号重试不会重复扣费。</p>}
            <Tabs className="batch-detail-tabs" value={editSection} onValueChange={value => setEditSection(value as typeof editSection)}>
              <TabsList className="batch-detail-switch" variant="line" aria-label="批量聊天编辑面板">
                <TabsTrigger value="content">聊天内容</TabsTrigger>
                <TabsTrigger value="people">头像与角色</TabsTrigger>
                <TabsTrigger value="settings">手机样式</TabsTrigger>
              </TabsList>
              <TabsContent value="content" className="batch-content-panel" keepMounted>
            <div className="batch-fields-row"><label>聊天名称<Input className="batch-field-control" aria-label="当前组聊天名称" value={active.content.title} disabled={locked} maxLength={40} onChange={e => updateJob(active.id, { content: { ...active.content, title: e.target.value }, snapshot: { ...active.snapshot!, settings: { ...active.snapshot!.settings, contactName: e.target.value } } })} /></label><label>导出方式<SelectField className="batch-field-control" aria-label="当前组导出方式" disabled={locked} value={active.mode} onValueChange={value => updateJob(active.id, { mode: value as CaptureMode })} options={[{ value: 'long', label: '完整长截图' }, { value: 'standard', label: '标准截图（顶部一屏）' }]} /></label></div>
            {(active.content.body || active.dirty) && <><label>本组聊天记录<Textarea className="batch-field-control" aria-label="本组聊天记录" rows={8} maxLength={10000} disabled={locked} value={active.content.body} onChange={e => updateJob(active.id, { content: { ...active.content, body: e.target.value }, dirty: true, error: '对话已修改，请先点击“更新本组预览”。', state: 'error' })} /></label><Button variant="outline" disabled={locked} onClick={applySource}>更新本组预览</Button></>}
            {!active.content.body && !active.dirty && <div className="batch-message-edit" aria-label="本组已有文字消息">{active.snapshot.messages.filter(m => m.type === 'text' || m.type === 'time').map(m => <label key={m.id}>{active.snapshot!.users.find(u => u.id === m.senderId)?.name || '时间'}<Textarea className="batch-field-control" rows={2} aria-label={`消息 ${m.id}`} disabled={locked} value={m.content} onChange={e => updateJob(active.id, { snapshot: { ...active.snapshot!, messages: active.snapshot!.messages.map(msg => msg.id === m.id ? { ...msg, content: e.target.value } : msg) } })} /></label>)}</div>}
              </TabsContent>
              <TabsContent value="people" keepMounted><fieldset disabled={locked} className="batch-shared-controls"><UserAvatarManager users={active.snapshot.users} selfId={active.snapshot.selfId} onUpdateAvatar={(id, avatar) => { if (!locked) updateJob(active.id, { snapshot: { ...active.snapshot!, users: active.snapshot!.users.map(u => u.id === id ? { ...u, avatar } : u) } }) }} onRemoveAvatar={id => { if (!locked) updateJob(active.id, { snapshot: { ...active.snapshot!, users: active.snapshot!.users.map(u => u.id === id ? { ...u, avatar: null } : u) } }) }} onSetSelf={selfId => { if (!locked) updateJob(active.id, { snapshot: { ...active.snapshot!, selfId } }) }} /></fieldset></TabsContent>
              <TabsContent value="settings" keepMounted><fieldset disabled={locked} className="batch-shared-controls"><SettingsPanel disabled={locked} settings={active.snapshot.settings} onSettingsChange={settings => { if (!locked) updateJob(active.id, { content: { ...active.content, title: settings.contactName }, snapshot: { ...active.snapshot!, settings } }) }} /></fieldset></TabsContent>
            </Tabs>
          </div>}
      </TabsContent>
      </Tabs>
    </WorkspacePanels>
    <ConfirmDialog open={clearOpen} onOpenChange={setClearOpen} title="清空本批聊天？" description="清空会丢失本页图片与任务记录，请确认已经下载。重新导入会作为新任务使用额度。" confirmText="已下载，清空队列" onConfirm={() => { if (busy) return; setJobs([]); setActiveId(''); setConfirmed(false); setView('import'); setClearOpen(false) }} />
  </div>
}

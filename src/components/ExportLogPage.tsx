import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, History, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { SelectField } from './ui/select'
import { ConfirmDialog } from './ui/confirm-dialog'
import { clearExportLogs, exportLogChanged, exportModes, exportOutcomes, filterExportLogs, listExportLogs, type ExportLog } from '@/lib/export-log'
import { workspaceTools } from '@/lib/workspace-tools'
import type { WorkspaceRoute } from '@/lib/workspace-route'
import './ExportLogPage.css'

const pageSize = 30
export function ExportLogPage({ onNavigate }: { onNavigate: (route: WorkspaceRoute) => void }) {
  const [records, setRecords] = useState<ExportLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clearOpen, setClearOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ tool: 'all', outcome: 'all', days: 'all', search: '' })
  const reload = useCallback(async () => {
    try { setRecords(await listExportLogs()); setError('') }
    catch { setError('无法读取本地导出日志，请检查浏览器存储权限后重试。') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    void reload()
    const update = () => { void reload() }
    window.addEventListener(exportLogChanged, update)
    window.addEventListener('focus', update)
    return () => { window.removeEventListener(exportLogChanged, update); window.removeEventListener('focus', update) }
  }, [reload])
  const changeFilter = (patch: Partial<typeof filters>) => { setFilters(previous => ({ ...previous, ...patch })); setPage(1) }
  const visible = filterExportLogs(records, filters)
  const pages = Math.max(1, Math.ceil(visible.length / pageSize))
  const currentPage = Math.min(page, pages)
  async function clear() {
    if (clearing) return
    setClearing(true)
    try { await clearExportLogs(); setRecords([]); setPage(1); setClearOpen(false) }
    catch { setError('清除失败，原有日志仍保留，请稍后重试。') }
    finally { setClearing(false) }
  }
  return <main className="studio-page-scroll export-log-page">
    <header className="export-log-heading"><div><h1><History size={22} /> 导出日志</h1><p>所有工具的导出记录，统一查看。</p></div><div className="export-log-actions"><Button variant="outline" onClick={() => void reload()} disabled={loading}><RefreshCw size={15} /> 刷新</Button><Button variant="ghost" disabled={!records.length || clearing} onClick={() => setClearOpen(true)}><Trash2 size={15} /> 清除日志</Button></div></header>
    <p className="export-log-notice">仅保存在当前浏览器，不上传聊天内容或图片。记录从此版本开始；“已发起下载”不代表文件已保存到磁盘，文件请到浏览器下载列表查找。此处不是图片备份或工程记录。</p>
    <div className="export-log-filters">
      <Input aria-label="搜索导出文件名" placeholder="搜索文件名…" value={filters.search} onChange={e => changeFilter({ search: e.target.value })} />
      <SelectField aria-label="筛选工具" value={filters.tool} onValueChange={tool => changeFilter({ tool })} options={[{ value: 'all', label: '全部工具' }, ...workspaceTools.map(tool => ({ value: tool.id, label: tool.title }))]} />
      <SelectField aria-label="筛选导出状态" value={filters.outcome} onValueChange={outcome => changeFilter({ outcome })} options={[{ value: 'all', label: '全部状态' }, ...Object.entries(exportOutcomes).map(([value, label]) => ({ value, label }))]} />
      <SelectField aria-label="筛选时间" value={filters.days} onValueChange={days => changeFilter({ days })} options={[{ value: 'all', label: '全部时间' }, { value: '1', label: '今天' }, { value: '7', label: '最近 7 天' }]} />
    </div>
    <div className="export-log-summary"><span>{visible.length} 条记录{filters.tool !== 'all' || filters.outcome !== 'all' || filters.days !== 'all' || filters.search ? '（已筛选）' : ''}</span><span>批量导出按 ZIP 记录，包含实际导出张数</span></div>
    {error && <p className="export-log-error" role="alert">{error}</p>}
    {loading ? <p role="status">正在读取导出日志…</p> : !visible.length ? <div className="export-log-empty"><History size={32} /><h2>{records.length ? '没有匹配的记录' : '还没有导出记录'}</h2><p>{records.length ? '调整工具、状态或时间筛选后再试。' : '从任意工具生成、下载或复制图片后，会自动记录在这里。旧版本的导出无法补记。'}</p></div> : <div className="export-log-table" role="table" aria-label="全局导出日志">
      <div className="export-log-row export-log-labels" role="row"><span role="columnheader">时间</span><span role="columnheader">工具 / 文件</span><span role="columnheader">方式 / 张数</span><span role="columnheader">结果</span><span role="columnheader">操作</span></div>
      {visible.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(record => <div className="export-log-row" role="row" key={record.id}>
        <time role="cell" dateTime={record.startedAt}>{new Date(record.startedAt).toLocaleString('zh-CN', { hour12: false })}</time>
        <div role="cell"><strong>{workspaceTools.find(tool => tool.id === record.tool)?.title || record.tool}</strong><span className="export-log-filename">{record.filename || (record.mode === 'clipboard' ? '复制到剪贴板' : '未生成文件')}</span></div>
        <span role="cell">{exportModes[record.mode]}<small>{record.count} 张</small></span>
        <div role="cell"><span className={`export-log-status is-${record.outcome}`}>{exportOutcomes[record.outcome]}</span>{record.note && <small>{record.note}</small>}</div>
        <div role="cell"><Button size="sm" variant="ghost" aria-label={`打开${workspaceTools.find(tool => tool.id === record.tool)?.title || record.tool}`} onClick={() => onNavigate(record.tool)}>打开工具<ArrowUpRight size={14} /></Button></div>
      </div>)}
    </div>}
    {visible.length > 0 && <footer className="export-log-pagination"><span>第 {currentPage} / {pages} 页</span><Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>上一页</Button><Button variant="outline" size="sm" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>下一页</Button></footer>}
    <ConfirmDialog open={clearOpen} onOpenChange={open => { if (!clearing) setClearOpen(open) }} title="清除全部导出日志？" description="仅删除当前浏览器的日志，无法撤销。不删除已下载文件或草稿，不退还或扣除额度。" confirmText={clearing ? '清除中…' : '确认清除日志'} onConfirm={() => void clear()} />
  </main>
}

import { Check, Clock3, Copy, FolderOpen, Plus, Trash2 } from 'lucide-react'
import type { ChatProject } from '@/lib/project-store'

interface ProjectPanelProps {
  projects: ChatProject[]
  activeProjectId: string | null
  activeProjectName: string
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  storageAvailable: boolean
  onCreate: () => void
  onOpen: (project: ChatProject) => void
  onRename: (name: string) => void
  onDuplicate: (project: ChatProject) => void
  onDelete: (project: ChatProject) => void
}

function updatedLabel(value: string) {
  const date = new Date(value)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return new Intl.DateTimeFormat('zh-CN', sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { month: 'numeric', day: 'numeric' }
  ).format(date)
}

export function ProjectPanel({
  projects,
  activeProjectId,
  activeProjectName,
  saveState,
  storageAvailable,
  onCreate,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: ProjectPanelProps) {
  return (
    <section className="project-workspace" aria-label="本地项目">
      <div className="project-workspace-head">
        <div>
          <span className="project-kicker"><FolderOpen size={14} /> 本地工作区</span>
          <div className="project-title-row">
            <input
              aria-label="当前项目名称"
              className="project-name-input"
              value={activeProjectName}
              placeholder="未命名对话"
              maxLength={48}
              onChange={event => onRename(event.target.value)}
            />
            <span className={`project-save-state is-${saveState}`}>
              {saveState === 'saving' && '保存中…'}
              {saveState === 'saved' && <><Check size={13} /> 已自动保存</>}
              {saveState === 'error' && '本地保存失败'}
              {saveState === 'idle' && '内容仅保存在本机'}
            </span>
          </div>
        </div>
        <button className="btn btn-outline btn-sm" type="button" onClick={onCreate}>
          <Plus size={15} /> 新建对话
        </button>
      </div>

      {!storageAvailable && (
        <p className="project-storage-warning">当前浏览器禁用了本地数据库，自动保存暂不可用。</p>
      )}

      {projects.length > 0 && (
        <div className="project-recent-list">
          {projects.slice(0, 6).map(project => (
            <article
              className={`project-recent-item${project.id === activeProjectId ? ' is-active' : ''}`}
              key={project.id}
            >
              <button className="project-open-button" type="button" onClick={() => onOpen(project)}>
                <span className="project-recent-name">{project.name}</span>
                <span className="project-recent-meta">
                  <Clock3 size={12} /> {updatedLabel(project.updatedAt)} · {project.messages.length} 条消息
                </span>
              </button>
              <div className="project-item-actions">
                <button title="复制项目" aria-label={`复制${project.name}`} type="button" onClick={() => onDuplicate(project)}>
                  <Copy size={14} />
                </button>
                <button title="删除项目" aria-label={`删除${project.name}`} type="button" onClick={() => onDelete(project)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

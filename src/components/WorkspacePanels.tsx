import { SegmentedControl } from './ui/controls'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Eye, PencilLine, Smartphone } from 'lucide-react'
import './Workspace.css'

interface WorkspacePanelsProps {
  children: ReactNode
  preview: ReactNode
  previewActions?: ReactNode
  previewTitle?: string
  previewDescription?: string
}

/** Shared editor/preview layout. Only the editor scrolls; export actions stay in reach. */
export function WorkspacePanels({ children, preview, previewActions, previewTitle = '实时预览', previewDescription = '画面随编辑更新，导出保留原始清晰度' }: WorkspacePanelsProps) {
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [phoneWidth, setPhoneWidth] = useState(300)
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = bodyRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width < 1) return
      const { width, height } = entry.contentRect
      // ResizeObserver contentRect already excludes padding. Fit the full phone without shrinking exports.
      setPhoneWidth(Math.min(340, width, Math.max(160, height * 1125 / 2436)))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return <div className="workspace-panels" data-mobile-view={view}>
    <SegmentedControl className="workspace-mobile-views" aria-label="工作区视图" value={view} onValueChange={value => setView(value as typeof view)} options={[{value: 'edit', label: <><PencilLine size={15} /> 编辑内容</>}, {value: 'preview', label: <><Eye size={15} /> 预览与导出</>}]} />
    <section className="workspace-editor-scroll" aria-label="内容编辑区" tabIndex={0}>{children}</section>
    <aside className="workspace-preview" aria-label="固定预览区">
      <header className="workspace-preview-header"><div><Smartphone size={16} /><h2>{previewTitle}</h2></div><p>{previewDescription}</p></header>
      <div className="workspace-preview-body" ref={bodyRef} style={{ '--workspace-phone-width': `${phoneWidth}px`, '--workspace-phone-scale': phoneWidth / 1125 } as CSSProperties}>{preview}</div>
      {previewActions && <footer className="workspace-preview-actions">{previewActions}</footer>}
    </aside>
  </div>
}

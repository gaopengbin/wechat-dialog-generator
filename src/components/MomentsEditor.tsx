import { useCallback, useEffect, useRef, useState } from 'react'
import { toCanvas } from 'html-to-image'
import { Camera, Download, Heart, ImagePlus, MapPin, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { loadMomentProject, saveMomentProject, type MomentProject } from '@/lib/project-store'
import { WechatPhoneChrome } from '@/components/WechatPhoneChrome'

const emptyMoment: MomentProject = {
  id: 'active',
  author: '高鹏彬',
  avatar: null,
  content: '分享此刻的想法…',
  images: [],
  location: '',
  timeLabel: '刚刚',
  likes: [],
  comments: [],
  updatedAt: new Date(0).toISOString(),
  version: 1,
}

interface MomentsEditorProps {
  onToast: (message: string) => void
}

function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function MomentsEditor({ onToast }: MomentsEditorProps) {
  const [draft, setDraft] = useState<MomentProject>(emptyMoment)
  const [ready, setReady] = useState(false)
  const [saved, setSaved] = useState(false)
  const [likeInput, setLikeInput] = useState('')
  const [commentAuthor, setCommentAuthor] = useState('小林')
  const [commentContent, setCommentContent] = useState('')
  const previewRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void loadMomentProject()
      .then(project => {
        if (project) {
          setDraft(project)
          setSaved(true)
        }
      })
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => {
      void saveMomentProject({ ...draft, updatedAt: new Date().toISOString() })
        .then(() => setSaved(true))
        .catch(() => onToast('朋友圈草稿保存失败'))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [draft, onToast, ready])

  const update = useCallback(<K extends keyof MomentProject,>(key: K, value: MomentProject[K]) => {
    setSaved(false)
    setDraft(current => ({ ...current, [key]: value }))
  }, [])

  const handleImages = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    const remaining = Math.max(0, 9 - draft.images.length)
    const selected = Array.from(files).slice(0, remaining)
    const urls = await Promise.all(selected.map(fileAsDataUrl))
    update('images', [...draft.images, ...urls])
  }, [draft.images, update])

  const handleAvatar = useCallback(async (file?: File) => {
    if (file) update('avatar', await fileAsDataUrl(file))
  }, [update])

  const addLikes = useCallback(() => {
    const names = likeInput.split(/[、,，\s]+/).map(item => item.trim()).filter(Boolean)
    if (!names.length) return
    update('likes', [...new Set([...draft.likes, ...names])])
    setLikeInput('')
  }, [draft.likes, likeInput, update])

  const addComment = useCallback(() => {
    if (!commentAuthor.trim() || !commentContent.trim()) return
    update('comments', [...draft.comments, {
      id: crypto.randomUUID(),
      author: commentAuthor.trim(),
      content: commentContent.trim(),
    }])
    setCommentContent('')
  }, [commentAuthor, commentContent, draft.comments, update])

  const exportImage = useCallback(async () => {
    if (!previewRef.current) return
    onToast('正在生成朋友圈图片…')
    try {
      const canvas = await toCanvas(previewRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      const link = document.createElement('a')
      link.download = `微信朋友圈_${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      onToast('朋友圈图片已下载')
    } catch {
      onToast('朋友圈图片生成失败')
    }
  }, [onToast])

  return (
    <main className="moments-workbench" id="moments-editor">
      <section className="moments-controls s-card">
        <div className="s-card-header moments-card-heading">
          <h2><Camera size={18} /> 编辑朋友圈</h2>
          <span className="s-card-badge">{saved ? '已自动保存' : '本地草稿'}</span>
        </div>
        <div className="s-card-body moments-form">
          <div className="moments-form-row moments-author-row">
            <label className="moments-avatar-upload">
              {draft.avatar ? <img src={draft.avatar} alt="头像" /> : <span>{draft.author.slice(0, 1) || '我'}</span>}
              <input type="file" accept="image/*" onChange={event => { void handleAvatar(event.target.files?.[0]) }} />
            </label>
            <label>昵称<input className="me-input" value={draft.author} maxLength={20} onChange={event => update('author', event.target.value)} /></label>
          </div>
          <label>朋友圈内容<textarea className="me-textarea moments-content-input" value={draft.content} rows={5} maxLength={500} onChange={event => update('content', event.target.value)} /></label>
          <div>
            <div className="moments-label-line"><span>图片</span><small>{draft.images.length}/9</small></div>
            <div className="moments-image-editor">
              {draft.images.map((image, index) => (
                <div className="moments-edit-image" key={`${image.slice(-24)}-${index}`}>
                  <img src={image} alt={`朋友圈图片 ${index + 1}`} />
                  <button type="button" aria-label={`删除第 ${index + 1} 张图片`} onClick={() => update('images', draft.images.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={13} /></button>
                </div>
              ))}
              {draft.images.length < 9 && <label className="moments-add-image"><ImagePlus size={20} /><span>添加图片</span><input type="file" accept="image/*" multiple onChange={event => { void handleImages(event.target.files) }} /></label>}
            </div>
          </div>
          <div className="moments-form-grid">
            <label>发布时间<input className="me-input" value={draft.timeLabel} maxLength={20} onChange={event => update('timeLabel', event.target.value)} /></label>
            <label>所在位置<input className="me-input" value={draft.location} maxLength={30} placeholder="可选" onChange={event => update('location', event.target.value)} /></label>
          </div>
          <div className="moments-inline-editor">
            <label>点赞用户<input className="me-input" value={likeInput} placeholder="多个昵称用逗号分隔" onChange={event => setLikeInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addLikes() }} /></label>
            <button className="btn btn-outline" type="button" onClick={addLikes}><Plus size={14} /> 添加</button>
          </div>
          {draft.likes.length > 0 && <div className="moments-chip-list">{draft.likes.map(name => <button key={name} type="button" onClick={() => update('likes', draft.likes.filter(item => item !== name))}>{name} ×</button>)}</div>}
          <div className="moments-comment-editor">
            <label>评论人<input className="me-input" value={commentAuthor} onChange={event => setCommentAuthor(event.target.value)} /></label>
            <label>评论内容<input className="me-input" value={commentContent} onChange={event => setCommentContent(event.target.value)} /></label>
            <button className="btn btn-outline" type="button" onClick={addComment}><Plus size={14} /> 添加评论</button>
          </div>
          <button className="btn btn-primary moments-export-button" type="button" onClick={() => { void exportImage() }}><Download size={16} /> 导出朋友圈图片</button>
        </div>
      </section>

      <section className="moments-preview-column">
        <div className="moments-preview-label"><span>实时预览</span><small>模拟界面 · 仅用于创作与设计演示</small></div>
        <div ref={previewRef}>
          <WechatPhoneChrome className="moments-phone-real" title="朋友圈" rightAction="camera">
          <div className="moments-cover"><div className="moments-cover-shade" /><div className="moments-profile"><strong>{draft.author || '未命名用户'}</strong><div>{draft.avatar ? <img src={draft.avatar} alt="" /> : draft.author.slice(0, 1) || '我'}</div></div></div>
          <article className="moment-post">
            <div className="moment-avatar">{draft.avatar ? <img src={draft.avatar} alt="" /> : draft.author.slice(0, 1) || '我'}</div>
            <div className="moment-main">
              <strong className="moment-author">{draft.author || '未命名用户'}</strong>
              <p className="moment-copy">{draft.content || '分享此刻的想法…'}</p>
              {draft.images.length > 0 && <div className={`moment-image-grid count-${Math.min(draft.images.length, 9)}`}>{draft.images.map((image, index) => <img src={image} alt="" key={`${image.slice(-24)}-${index}`} />)}</div>}
              {draft.location && <div className="moment-location"><MapPin size={12} /> {draft.location}</div>}
              <div className="moment-meta"><span>{draft.timeLabel || '刚刚'}</span><button type="button">••</button></div>
              {(draft.likes.length > 0 || draft.comments.length > 0) && <div className="moment-social">
                {draft.likes.length > 0 && <div className="moment-likes"><Heart size={13} fill="currentColor" /> {draft.likes.join('，')}</div>}
                {draft.comments.map(comment => <div className="moment-comment" key={comment.id}><strong>{comment.author}：</strong>{comment.content}</div>)}
              </div>}
              {draft.likes.length === 0 && draft.comments.length === 0 && <div className="moment-empty-actions"><Heart size={14} /><MessageCircle size={14} /></div>}
            </div>
          </article>
          </WechatPhoneChrome>
        </div>
      </section>
    </main>
  )
}

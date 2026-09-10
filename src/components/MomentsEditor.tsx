import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/controls'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toCanvas } from 'html-to-image'
import { Camera, Download, Heart, ImagePlus, MapPin, MessageCircle, Plus, Trash2, X } from 'lucide-react'
import { loadMomentProject, saveMomentProject, type MomentProject } from '@/lib/project-store'
import { DEFAULT_MOMENT as emptyMoment, refreshUntouchedMomentDemo } from '@/lib/demo-defaults'
import { WechatPhoneChrome } from '@/components/WechatPhoneChrome'
import { WorkspacePanels } from './WorkspacePanels'
import { beginExportLog } from '@/lib/export-log'
import { ScenePreviewFrame } from './ScenePreviewFrame'
import { ColorField } from './ui/color-field'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import './SceneWorkspace.css'

interface MomentsEditorProps {
  onToast: (message: string) => void
  onBeforeExport?: () => Promise<boolean | string>
  onExportSuccess?: (ticket?: boolean | string) => void
}

function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function MomentsEditor({ onToast, onBeforeExport, onExportSuccess }: MomentsEditorProps) {
  const [draft, setDraft] = useState<MomentProject>(emptyMoment)
  const [ready, setReady] = useState(false)
  const [saved, setSaved] = useState(false)
  const [likeInput, setLikeInput] = useState('')
  const [commentAuthor, setCommentAuthor] = useState('小林')
  const [commentContent, setCommentContent] = useState('')
  const [coverError, setCoverError] = useState('')
  const previewRef = useRef<HTMLDivElement | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void loadMomentProject()
      .then(project => {
        if (project) {
          const restored = refreshUntouchedMomentDemo(project)
          setDraft({ ...emptyMoment, ...restored })
          setSaved(restored === project)
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

  const handleCover = useCallback(async (file?: File) => {
    setCoverError('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setCoverError('请选择图片文件')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setCoverError('背景图片不能超过 8 MB')
      return
    }
    try {
      update('coverImage', await fileAsDataUrl(file))
    } catch {
      setCoverError('背景图片读取失败，请重新选择')
    }
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
    const filename = `微信朋友圈_${Date.now()}.png`
    const log = beginExportLog({ tool: 'moments', mode: 'standard', filename })
    onToast('正在生成朋友圈图片…')
    try {
      const canvas = await toCanvas(previewRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      const ticket = onBeforeExport ? await onBeforeExport() : true
      if (!ticket) { void log.finish('cancelled', '额度校验未通过'); return }
      const link = document.createElement('a')
      link.download = filename
      link.href = canvas.toDataURL('image/png')
      link.click()
      void log.finish('download_requested')
      onToast('朋友圈图片已下载')
      onExportSuccess?.(ticket)
    } catch {
      void log.finish('failed', '朋友圈图片生成或下载失败')
      onToast('朋友圈图片生成失败')
    }
  }, [onBeforeExport, onExportSuccess, onToast])

  return (
    <WorkspacePanels
      previewTitle="朋友圈预览"
      previewDescription="修改内容后即时更新，导出保留模拟标识"
      previewActions={<Button className="btn btn-primary moments-export-button" type="button" onClick={() => { void exportImage() }}><Download size={16} /> 导出朋友圈图片</Button>}
      preview={
        <ScenePreviewFrame captureRef={previewRef}>
          <WechatPhoneChrome className="moments-phone-real" title="朋友圈" rightAction="camera">
          <div
            className={`moments-cover${draft.coverImage ? ' has-custom-background' : ''}`}
            style={{
              backgroundColor: draft.coverColor || '#75877f',
              backgroundImage: draft.coverImage ? `url(${draft.coverImage})` : undefined,
            }}
          ><div className="moments-cover-shade" /><div className="moments-profile"><strong>{draft.author || '未命名用户'}</strong><div>{draft.avatar ? <img src={draft.avatar} alt="" /> : draft.author.slice(0, 1) || '我'}</div></div></div>
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
        </ScenePreviewFrame>
      }
    >
      <div className="scene-workspace-form" id="moments-editor">
        <header className="scene-workspace-heading">
          <div><h2><Camera size={17} /> 编辑朋友圈</h2></div>
          <span className="scene-workspace-save-state" role="status">{saved ? '已自动保存' : '本地草稿'}</span>
        </header>
        <Tabs className="moments-sections" defaultValue="content">
        <TabsList className="moments-workspace-tabs" aria-label="朋友圈编辑面板"><TabsTrigger value="content">动态内容</TabsTrigger><TabsTrigger value="identity">发布身份</TabsTrigger><TabsTrigger value="social">点赞与评论</TabsTrigger></TabsList>
        <TabsContent className="scene-workspace-section" value="identity" keepMounted aria-labelledby="moment-identity-heading">
          <div className="scene-workspace-section-heading scene-section-description"><h3 id="moment-identity-heading">发布身份</h3><p>昵称、头像与个人封面</p></div>
          <div className="moments-form">
          <div className="moments-form-row moments-author-row">
            <label className="moments-avatar-upload">
              {draft.avatar ? <img src={draft.avatar} alt="头像" /> : <span>{draft.author.slice(0, 1) || '我'}</span>}
              <input type="file" accept="image/*" aria-label="上传发布者头像" onChange={event => { void handleAvatar(event.target.files?.[0]) }} />
            </label>
            <label>昵称<Input className="me-input" value={draft.author} maxLength={20} onChange={event => update('author', event.target.value)} /></label>
          </div>
          <div className="moments-cover-editor">
            <div className="moments-label-line"><span>朋友圈背景</span><small>封面图</small></div>
            <div className="chat-background-control">
              <div className="chat-background-color">
                <ColorField
                  aria-label="朋友圈背景颜色"
                  value={draft.coverColor || '#75877f'}
                  onValueChange={color => update('coverColor', color)}
                />
              </div>
              <Button variant="outline" size="sm" className="btn btn-outline btn-sm" type="button" onClick={() => coverInputRef.current?.click()}>
                <ImagePlus size={15} /> {draft.coverImage ? '更换背景图' : '上传背景图'}
              </Button>
              {draft.coverImage && (
                <Button variant="ghost" size="sm" className="btn btn-ghost btn-sm" type="button" onClick={() => update('coverImage', null)}>
                  <Trash2 size={15} /> 移除图片
                </Button>
              )}
              <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={event => { void handleCover(event.target.files?.[0]); event.currentTarget.value = '' }} />
              {draft.coverImage && <img className="chat-background-thumb" src={draft.coverImage} alt="当前朋友圈背景预览" />}
            </div>
            <small className="form-helper">背景仅保存在当前浏览器，导出的朋友圈图片会保留。</small>
            {coverError && <small className="form-error" role="alert">{coverError}</small>}
          </div>
          </div>
        </TabsContent>
        <TabsContent className="scene-workspace-section" value="content" keepMounted aria-labelledby="moment-content-heading">
          <div className="scene-workspace-section-heading scene-section-description"><h3 id="moment-content-heading">动态内容</h3><p>文字、图片与发布信息</p></div>
          <div className="moments-form">
          <label>朋友圈内容<Textarea className="me-textarea moments-content-input" value={draft.content} rows={5} maxLength={500} onChange={event => update('content', event.target.value)} /></label>
          <div>
            <div className="moments-label-line"><span>图片</span><small>{draft.images.length}/9</small></div>
            <div className="moments-image-editor">
              {draft.images.map((image, index) => (
                <div className="moments-edit-image" key={`${image.slice(-24)}-${index}`}>
                  <img src={image} alt={`朋友圈图片 ${index + 1}`} />
                  <Button variant="ghost" size="icon" style={{ width: 23, height: 23, padding: 0 }} type="button" aria-label={`删除第 ${index + 1} 张图片`} onClick={() => update('images', draft.images.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={13} /></Button>
                </div>
              ))}
              {draft.images.length < 9 && <label className="moments-add-image"><ImagePlus size={20} /><span>添加图片</span><input type="file" accept="image/*" aria-label="添加朋友圈图片" multiple onChange={event => { void handleImages(event.target.files) }} /></label>}
            </div>
          </div>
          <div className="moments-form-grid">
            <label>发布时间<Input className="me-input" value={draft.timeLabel} maxLength={20} onChange={event => update('timeLabel', event.target.value)} /></label>
            <label>所在位置<Input className="me-input" value={draft.location} maxLength={30} placeholder="可选" onChange={event => update('location', event.target.value)} /></label>
          </div>
          </div>
        </TabsContent>
        <TabsContent className="scene-workspace-section" value="social" keepMounted aria-labelledby="moment-social-heading">
          <div className="scene-workspace-section-heading scene-section-description"><h3 id="moment-social-heading">点赞与评论</h3><p>添加创作中的互动信息</p></div>
          <div className="moments-form">
          <div className="moments-inline-editor">
            <label>点赞用户<Input className="me-input" value={likeInput} placeholder="多个昵称用逗号分隔" onChange={event => setLikeInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) addLikes() }} /></label>
            <Button variant="outline" className="btn btn-outline" type="button" onClick={addLikes}><Plus size={14} /> 添加</Button>
          </div>
          {draft.likes.length > 0 && <div className="moments-chip-list">{draft.likes.map(name => <Button variant="secondary" size="sm" style={{ height: 'auto' }} key={name} type="button" aria-label={`移除 ${name} 的点赞`} onClick={() => update('likes', draft.likes.filter(item => item !== name))}>{name}<X size={12} /></Button>)}</div>}
          <div className="moments-comment-editor">
            <label>评论人<Input className="me-input" value={commentAuthor} onChange={event => setCommentAuthor(event.target.value)} /></label>
            <label>评论内容<Input className="me-input" value={commentContent} onChange={event => setCommentContent(event.target.value)} /></label>
            <Button variant="outline" className="btn btn-outline" type="button" onClick={addComment}><Plus size={14} /> 添加评论</Button>
          </div>
          </div>
        </TabsContent>
        </Tabs>
        <p className="scene-workspace-footnote">素材仅保存在当前浏览器。模拟内容仅用于创作与设计演示。</p>
      </div>
    </WorkspacePanels>
  )
}

import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { useEffect, useMemo, useRef, useState } from 'react'
import { toCanvas } from 'html-to-image'
import { Camera, ChevronRight, Download, MessageSquareText, Plus, QrCode, UserRound } from 'lucide-react'
import { loadWechatScene, saveWechatScene, type WechatSceneKind, type WechatSceneProject } from '@/lib/project-store'
import { SCENE_DEFAULT_FIELDS, refreshUntouchedSceneDemo } from '@/lib/demo-defaults'
import { WechatPhoneChrome } from '@/components/WechatPhoneChrome'
import { WorkspacePanels } from './WorkspacePanels'
import { beginExportLog } from '@/lib/export-log'
import { ScenePreviewFrame } from './ScenePreviewFrame'
import './SceneWorkspace.css'

interface FieldDefinition {
  key: string
  label: string
  placeholder?: string
  multiline?: boolean
  image?: boolean
}

const sceneDefinitions: Record<WechatSceneKind, {
  title: string
  description: string
  fields: FieldDefinition[]
  defaults: Record<string, string>
}> = {
  payment: {
    title: '支付与转账页面',
    description: '制作转账结果、收款完成等创作素材。',
    fields: [
      { key: 'avatar', label: '收款方头像', image: true },
      { key: 'payee', label: '收款方' },
      { key: 'amount', label: '金额' },
      { key: 'account', label: '对方账户' },
      { key: 'time', label: '转账时间' },
      { key: 'orderNo', label: '转账单号' },
      { key: 'note', label: '转账说明' },
    ],
    defaults: SCENE_DEFAULT_FIELDS.payment,
  },
  redpacket: {
    title: '红包详情页面',
    description: '制作红包封面和领取结果画面。',
    fields: [
      { key: 'avatar', label: '发送人头像', image: true },
      { key: 'sender', label: '发送人' },
      { key: 'greeting', label: '红包祝福' },
      { key: 'amount', label: '领取金额' },
      { key: 'status', label: '领取状态' },
    ],
    defaults: SCENE_DEFAULT_FIELDS.redpacket,
  },
  profile: {
    title: '个人资料页面',
    description: '制作个人名片和资料页创作素材。',
    fields: [
      { key: 'avatar', label: '头像', image: true },
      { key: 'nickname', label: '昵称' },
      { key: 'wechatId', label: '微信号' },
      { key: 'region', label: '地区' },
      { key: 'signature', label: '个性签名', multiline: true },
    ],
    defaults: SCENE_DEFAULT_FIELDS.profile,
  },
  group: {
    title: '群信息页面',
    description: '制作群聊资料、公告和成员列表。',
    fields: [
      { key: 'name', label: '群聊名称' },
      { key: 'count', label: '群成员人数' },
      { key: 'members', label: '成员昵称', placeholder: '使用逗号分隔' },
      { key: 'announcement', label: '群公告', multiline: true },
    ],
    defaults: SCENE_DEFAULT_FIELDS.group,
  },
}

interface WechatSceneEditorProps {
  kind: WechatSceneKind
  onToast: (message: string) => void
  onBeforeExport?: () => Promise<boolean | string>
  onExportSuccess?: (ticket?: boolean | string) => void
}

export function WechatSceneEditor({ kind, onToast, onBeforeExport, onExportSuccess }: WechatSceneEditorProps) {
  const definition = sceneDefinitions[kind]
  const [project, setProject] = useState<WechatSceneProject>({ id: kind, fields: definition.defaults, updatedAt: new Date(0).toISOString(), version: 1 })
  const [ready, setReady] = useState(false)
  const [saved, setSaved] = useState(false)
  const previewRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void loadWechatScene(kind).then(stored => {
      const restored = stored && refreshUntouchedSceneDemo(stored)
      setProject(restored ? { ...restored, fields: { ...definition.defaults, ...restored.fields } } : { id: kind, fields: definition.defaults, updatedAt: new Date(0).toISOString(), version: 1 })
      setSaved(Boolean(stored && restored === stored))
      setReady(true)
    })
  }, [definition.defaults, kind])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => {
      void saveWechatScene({ ...project, updatedAt: new Date().toISOString() })
        .then(() => setSaved(true))
        .catch(() => onToast('本地草稿保存失败'))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [onToast, project, ready])

  const updateField = (key: string, value: string) => {
    setSaved(false)
    setProject(current => ({ ...current, fields: { ...current.fields, [key]: value } }))
  }

  const updateImage = (key: string, file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => updateField(key, String(reader.result))
    reader.onerror = () => onToast('头像读取失败')
    reader.readAsDataURL(file)
  }

  const exportImage = async () => {
    if (!previewRef.current) return
    const filename = `微信${definition.title}_${Date.now()}.png`
    const log = beginExportLog({ tool: kind, mode: 'standard', filename })
    onToast('正在生成模拟页面…')
    try {
      const canvas = await toCanvas(previewRef.current, { pixelRatio: 2, backgroundColor: '#f5f5f5' })
      const ticket = onBeforeExport ? await onBeforeExport() : true
      if (!ticket) { void log.finish('cancelled', '额度校验未通过'); return }
      const link = document.createElement('a')
      link.download = filename
      link.href = canvas.toDataURL('image/png')
      link.click()
      void log.finish('download_requested')
      onToast('图片已下载')
      onExportSuccess?.(ticket)
    } catch {
      void log.finish('failed', '模拟页面生成或下载失败')
      onToast('图片生成失败')
    }
  }

  return (
    <WorkspacePanels
      previewTitle={`${definition.title.replace('页面', '')}预览`}
      previewDescription="模拟界面 · 仅用于创作与设计演示"
      previewActions={<Button className="btn btn-primary" type="button" onClick={() => { void exportImage() }}><Download size={16} /> 导出模拟页面</Button>}
      preview={
        <ScenePreviewFrame captureRef={previewRef}>
          <WechatPhoneChrome className={`scene-${kind}`} title={kind === 'payment' ? '' : kind === 'redpacket' ? '红包详情' : kind === 'profile' ? '个人信息' : `聊天信息(${project.fields.count || '0'})`}>
            <ScenePreview kind={kind} fields={project.fields} />
          </WechatPhoneChrome>
        </ScenePreviewFrame>
      }
    >
      <div className="scene-workspace-form" id={`scene-${kind}-editor`}>
        <header className="scene-workspace-heading">
          <div><h2><MessageSquareText size={17} /> {definition.title}</h2></div>
          <span className="scene-workspace-save-state" role="status">{saved ? '已自动保存' : '本地草稿'}</span>
        </header>
        <section className="scene-workspace-section" aria-labelledby={`scene-${kind}-fields-heading`}>
          <h3 className="sr-only" id={`scene-${kind}-fields-heading`}>页面内容</h3>
          <div className="scene-form">
          {definition.fields.map(field => field.image ? (
            <label className="scene-avatar-field" key={field.key}>{field.label}<span className="scene-avatar-control">
              <span className="scene-avatar-thumb">{project.fields[field.key] ? <img src={project.fields[field.key]} alt="" /> : <UserRound size={25} />}</span>
              <span className="btn btn-outline"><Camera size={14} /> 上传头像</span>
              <input type="file" accept="image/*" onChange={event => updateImage(field.key, event.target.files?.[0])} />
            </span></label>
          ) : <label className={field.multiline ? "scene-field-wide" : undefined} key={field.key}>{field.label}{field.multiline
            ? <Textarea className="me-textarea" rows={4} value={project.fields[field.key] ?? ''} placeholder={field.placeholder} onChange={event => updateField(field.key, event.target.value)} />
            : <Input className="me-input" value={project.fields[field.key] ?? ''} placeholder={field.placeholder} onChange={event => updateField(field.key, event.target.value)} />}</label>)}
          </div>
        </section>
        <div className="scene-safety-note">导出图片固定带有“模拟界面”标识，不用于伪造交易凭证、身份或欺骗他人。</div>
      </div>
    </WorkspacePanels>
  )
}

function ScenePreview({ kind, fields }: { kind: WechatSceneKind; fields: Record<string, string> }) {
  const members = useMemo(() => fields.members?.split(/[,，、]+/).map(item => item.trim()).filter(Boolean) ?? [], [fields.members])
  const avatar = (name: string) => <span className="wechat-avatar">{fields.avatar ? <img src={fields.avatar} alt="" /> : name?.slice(0, 1)}</span>
  if (kind === 'payment') return <div className="payment-preview">
    <div className="payment-payee">{avatar(fields.payee)}<strong>{fields.payee}</strong></div>
    <div className="payment-amount">¥{fields.amount}</div>
    <div className="payment-divider" />
    <div className="payment-detail"><span>转账时间</span><b>{fields.time}</b><span>转账单号</span><b>{fields.orderNo}</b><span>对方账户</span><b>{fields.account}</b><span>转账备注</span><b>{fields.note}</b></div>
    <div className="payment-bill-section"><span>账单管理</span><p><b>账单分类</b><em>转账红包 <ChevronRight size={14} /></em></p><p><b>标签</b><em>请选择 <ChevronRight size={14} /></em></p></div>
    <small className="payment-tip">转账信息请以对方账户实际展示为准</small>
  </div>
  if (kind === 'redpacket') return <div className="redpacket-preview">
    <div className="redpacket-head"><div className="redpacket-sender">{avatar(fields.sender)}<span><b>{fields.sender}的红包</b><small>{fields.greeting}</small></span></div><strong>{fields.amount}<small> 元</small></strong><p>{fields.status} <ChevronRight size={13} /></p></div>
    <div className="redpacket-summary">1个红包共{fields.amount}元，已被领取</div>
    <div className="redpacket-record">{avatar('我')}<span><b>我</b><small>12:02</small></span><strong>{fields.amount}元</strong></div>
  </div>
  if (kind === 'profile') return <div className="profile-preview">
    <div className="wechat-list-section profile-rows"><p><b>头像</b>{avatar(fields.nickname)}<ChevronRight size={18} /></p><p><b>名字</b><span>{fields.nickname}</span><ChevronRight size={18} /></p><p><b>拍一拍</b><span>设置拍一拍</span><ChevronRight size={18} /></p><p><b>微信号</b><span>{fields.wechatId}</span></p><p><b>我的二维码</b><QrCode size={22} /><ChevronRight size={18} /></p><p><b>更多</b><ChevronRight size={18} /></p></div>
    <div className="wechat-list-section profile-rows"><p><b>来电铃声</b><ChevronRight size={18} /></p><p><b>个性签名</b><span>{fields.signature}</span><ChevronRight size={18} /></p><p><b>地区</b><span>{fields.region}</span><ChevronRight size={18} /></p></div>
  </div>
  return <div className="group-preview"><div className="group-members">{members.slice(0, 8).map((member, index) => <div key={`${member}-${index}`}><span>{member.slice(0, 1)}</span><small>{member}</small></div>)}<div><span><Plus size={26} /></span><small>添加</small></div></div><div className="wechat-list-section group-rows"><p><b>群聊名称</b><span>{fields.name}</span><ChevronRight size={18} /></p><p><b>群二维码</b><QrCode size={22} /><ChevronRight size={18} /></p><p><b>群公告</b><span>{fields.announcement}</span><ChevronRight size={18} /></p><p><b>备注</b><ChevronRight size={18} /></p></div><div className="wechat-list-section group-rows"><p><b>消息免打扰</b><i className="scene-switch" /></p><p><b>置顶聊天</b><i className="scene-switch is-on" /></p><p><b>保存到通讯录</b><i className="scene-switch is-on" /></p></div><div className="wechat-list-section group-rows"><p><b>查找聊天记录</b><ChevronRight size={18} /></p></div><Button className="group-danger" type="button">清空聊天记录</Button></div>
}

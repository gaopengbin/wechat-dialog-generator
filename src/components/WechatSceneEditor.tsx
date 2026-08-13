import { useEffect, useMemo, useRef, useState } from 'react'
import { toCanvas } from 'html-to-image'
import { CheckCircle2, Download, Gift, MessageSquareText, QrCode, UserRound, UsersRound } from 'lucide-react'
import { loadWechatScene, saveWechatScene, type WechatSceneKind, type WechatSceneProject } from '@/lib/project-store'

interface FieldDefinition {
  key: string
  label: string
  placeholder?: string
  multiline?: boolean
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
      { key: 'payee', label: '收款方' },
      { key: 'amount', label: '金额' },
      { key: 'status', label: '状态文字' },
      { key: 'time', label: '完成时间' },
      { key: 'note', label: '转账说明' },
    ],
    defaults: { payee: '小林', amount: '88.00', status: '支付成功', time: '2026-08-13 20:18:26', note: '朋友聚餐' },
  },
  redpacket: {
    title: '红包详情页面',
    description: '制作红包封面和领取结果画面。',
    fields: [
      { key: 'sender', label: '发送人' },
      { key: 'greeting', label: '红包祝福' },
      { key: 'amount', label: '领取金额' },
      { key: 'status', label: '领取状态' },
    ],
    defaults: { sender: '高鹏彬', greeting: '恭喜发财，大吉大利', amount: '8.88', status: '已存入零钱' },
  },
  profile: {
    title: '个人资料页面',
    description: '制作个人名片和资料页创作素材。',
    fields: [
      { key: 'nickname', label: '昵称' },
      { key: 'wechatId', label: '微信号' },
      { key: 'region', label: '地区' },
      { key: 'signature', label: '个性签名', multiline: true },
    ],
    defaults: { nickname: '高鹏彬', wechatId: 'gaopengbin', region: '浙江 杭州', signature: '保持好奇，持续创造。' },
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
    defaults: { name: 'AI 产品共创群', count: '8', members: '高鹏彬,小林,阿杰,徐言岩,产品同学,设计师', announcement: '欢迎交流产品想法，请勿发布无关广告。' },
  },
}

interface WechatSceneEditorProps {
  kind: WechatSceneKind
  onToast: (message: string) => void
}

export function WechatSceneEditor({ kind, onToast }: WechatSceneEditorProps) {
  const definition = sceneDefinitions[kind]
  const [project, setProject] = useState<WechatSceneProject>({ id: kind, fields: definition.defaults, updatedAt: new Date(0).toISOString(), version: 1 })
  const [ready, setReady] = useState(false)
  const [saved, setSaved] = useState(false)
  const previewRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void loadWechatScene(kind).then(stored => {
      setProject(stored ?? { id: kind, fields: definition.defaults, updatedAt: new Date(0).toISOString(), version: 1 })
      setSaved(Boolean(stored))
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

  const exportImage = async () => {
    if (!previewRef.current) return
    onToast('正在生成模拟页面…')
    try {
      const canvas = await toCanvas(previewRef.current, { pixelRatio: 2, backgroundColor: '#f5f5f5' })
      const link = document.createElement('a')
      link.download = `微信${definition.title}_${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      onToast('图片已下载')
    } catch {
      onToast('图片生成失败')
    }
  }

  return (
    <main className="scene-workbench" id="scene-editor">
      <section className="scene-controls s-card">
        <div className="s-card-header scene-card-heading"><h2><MessageSquareText size={18} /> {definition.title}</h2><span className="s-card-badge">{saved ? '已自动保存' : '本地草稿'}</span></div>
        <div className="s-card-body scene-form">
          <p>{definition.description}所有字段都只保存在当前浏览器。</p>
          {definition.fields.map(field => <label key={field.key}>{field.label}{field.multiline
            ? <textarea className="me-textarea" rows={4} value={project.fields[field.key] ?? ''} placeholder={field.placeholder} onChange={event => updateField(field.key, event.target.value)} />
            : <input className="me-input" value={project.fields[field.key] ?? ''} placeholder={field.placeholder} onChange={event => updateField(field.key, event.target.value)} />}</label>)}
          <div className="scene-safety-note">导出图片固定带有“模拟界面”标识，不用于伪造交易凭证、身份或欺骗他人。</div>
          <button className="btn btn-primary" type="button" onClick={() => { void exportImage() }}><Download size={16} /> 导出模拟页面</button>
        </div>
      </section>
      <section className="scene-preview-column">
        <div className="moments-preview-label"><span>实时预览</span><small>模拟界面 · 仅用于创作与设计演示</small></div>
        <div className={`scene-phone scene-${kind}`} ref={previewRef}>
          <div className="scene-status"><span>12:02</span><span>▮▮▮ ᯤ ▰</span></div>
          <div className="scene-nav"><span>‹</span><strong>{kind === 'payment' ? '交易详情' : kind === 'redpacket' ? '微信红包' : kind === 'profile' ? '个人信息' : '聊天信息'}</strong><span>•••</span></div>
          <ScenePreview kind={kind} fields={project.fields} />
          <div className="scene-watermark">模拟界面 · 非真实微信内容</div>
        </div>
      </section>
    </main>
  )
}

function ScenePreview({ kind, fields }: { kind: WechatSceneKind; fields: Record<string, string> }) {
  const members = useMemo(() => fields.members?.split(/[,，、]+/).map(item => item.trim()).filter(Boolean) ?? [], [fields.members])
  if (kind === 'payment') return <div className="payment-preview"><CheckCircle2 size={68} /><p>{fields.status}</p><strong>¥{fields.amount}</strong><div className="scene-detail-list"><span><b>收款方</b>{fields.payee}</span><span><b>转账说明</b>{fields.note}</span><span><b>完成时间</b>{fields.time}</span><span><b>支付方式</b>零钱</span></div></div>
  if (kind === 'redpacket') return <div className="redpacket-preview"><div className="redpacket-avatar">{fields.sender?.slice(0, 1)}</div><p>{fields.sender} 的红包</p><h3>{fields.greeting}</h3><strong>{fields.amount}<small> 元</small></strong><span>{fields.status}</span><Gift size={28} /></div>
  if (kind === 'profile') return <div className="profile-preview"><div className="profile-hero"><div className="profile-avatar"><UserRound size={44} /></div><div><strong>{fields.nickname}</strong><span>微信号：{fields.wechatId}</span></div><QrCode size={24} /></div><div className="scene-settings-list"><span><b>性别</b>未设置</span><span><b>地区</b>{fields.region}</span><span><b>个性签名</b>{fields.signature}</span><span><b>朋友圈</b><i>查看主页 ›</i></span></div></div>
  return <div className="group-preview"><div className="group-members">{members.slice(0, 8).map((member, index) => <div key={`${member}-${index}`}><span>{member.slice(0, 1)}</span><small>{member}</small></div>)}<div><span>＋</span><small>添加</small></div></div><div className="scene-settings-list"><span><b>群聊名称</b>{fields.name}</span><span><b>群成员</b>{fields.count} 人</span><span><b>群公告</b>{fields.announcement}</span><span><b>消息免打扰</b><i className="scene-switch" /></span><span><b>保存到通讯录</b><i className="scene-switch is-on" /></span></div><UsersRound className="group-faded-icon" size={70} /></div>
}

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { BookOpen, Megaphone, MousePointerClick, Search, ShieldCheck, X } from 'lucide-react'
import { Button } from './ui/button'
import './UpdateAnnouncement.css'

const announcementId = '2026-10-29-complete-guide-v1'
const readKey = 'wechat-dialog-generator:announcement-read'

export function UpdateAnnouncement({ blocked = false, onOpenGuide }: { blocked?: boolean; onOpenGuide?: () => void }) {
  const [unread, setUnread] = useState(() => {
    try { return localStorage.getItem(readKey) !== announcementId }
    catch { return true }
  })
  const [open, setOpen] = useState(unread)
  function changeOpen(next: boolean) {
    setOpen(next)
    if (!next) {
      setUnread(false)
      try { localStorage.setItem(readKey, announcementId) } catch { /* Keep the dismissal for this page even if storage is unavailable. */ }
    }
  }

  return <Dialog.Root open={open && !blocked} onOpenChange={changeOpen}>
    <Dialog.Trigger disabled={blocked} render={<Button variant="outline" className="announcement-trigger" aria-label="更新公告" title="更新公告" />}>
      <Megaphone size={16} /><span>公告</span>{unread && <i aria-label="未读公告" />}
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="announcement-backdrop" />
      <Dialog.Popup className="announcement-dialog">
        <div className="announcement-topline"><span><Megaphone size={15} /> 更新公告</span><time dateTime="2026-10-29">2026.10.29</time><Dialog.Close render={<Button variant="ghost" size="icon" aria-label="关闭更新公告" />}><X size={18} /></Dialog.Close></div>
        <Dialog.Title className="announcement-title">完整功能教程上线</Dialog.Title>
        <Dialog.Description className="announcement-description">把每个功能从编辑到导出的步骤放进网站，遇到问题可以直接看对应教程。</Dialog.Description>
        <div className="announcement-body">
          <section><BookOpen size={18} /><div><h3>7 个工作页，17 篇教程</h3><p>覆盖个人对话、群聊、批量聊天图、朋友圈和常用微信页面，以及草稿、分享、账户充值、导出日志与问题排查。</p></div></section>
          <section><MousePointerClick size={18} /><div><h3>边看边练，不怕找不到按钮</h3><p>示例可复制或载入聊天页，工作页截图可点开放大。已有内容载入示例前会先确认，不会直接覆盖预览。</p></div></section>
          <section><Search size={18} /><div><h3>按功能搜索，直达当前章节</h3><p>左侧【模板与指南】可查整本手册，工作页顶部【使用教程】直接打开当前功能。手机也能通过章节选择器阅读。</p></div></section>
          <section><ShieldCheck size={18} /><div><h3>原有内容与额度不变</h3><p>这次新增使用说明，不调整已有草稿、奖励、套餐或额度核对规则。普通使用问题可直接问公众号；核对个人导出记录时再按提示提供诊断码。</p></div></section>
        </div>
        <footer className="announcement-footer"><p>关闭后不再自动弹出，可从顶部“公告”重新查看。</p>{onOpenGuide && <Dialog.Close render={<Button variant="outline" onClick={onOpenGuide} />}>查看完整教程</Dialog.Close>}<Dialog.Close render={<Button />}>我知道了</Dialog.Close></footer>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Download, Image, Megaphone, ShieldCheck, UserRound, X } from 'lucide-react'
import { Button } from './ui/button'
import './UpdateAnnouncement.css'

const announcementId = '2026-10-26-export-recovery-v1'
const readKey = 'wechat-dialog-generator:announcement-read'

export function UpdateAnnouncement({ blocked = false }: { blocked?: boolean }) {
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
        <div className="announcement-topline"><span><Megaphone size={15} /> 更新公告</span><time dateTime="2026-10-26">2026.10.26</time><Dialog.Close render={<Button variant="ghost" size="icon" aria-label="关闭更新公告" />}><X size={18} /></Dialog.Close></div>
        <Dialog.Title className="announcement-title">图片导出体验更新</Dialog.Title>
        <Dialog.Description className="announcement-description">针对近期图片加载和导出问题，优化了单张聊天图与批量导出的检查提示、加载速度和下载恢复。</Dialog.Description>
        <div className="announcement-body">
          <section><Image size={18} /><div><h3>外链图片，提前检查</h3><p>导入后自动检查外链图片能否导出。无法读取时会标明对应消息，可上传原图或重新检查。<strong>能在网页里看到，不代表外链允许截图导出。</strong></p></div></section>
          <section><UserRound size={18} /><div><h3>默认头像，加载更轻</h3><p>默认头像随页面打包，体积减少约 <strong>91%</strong>，减少截图时重复加载头像导致的超时；你上传的头像与图片保持不变。</p></div></section>
          <section><Download size={18} /><div><h3>复制失败，自动转下载</h3><p>浏览器不允许复制图片时，自动改为下载同一张图片。若下载被拦截，可点击“再次下载这张图片”，<strong>无需重新生成，不重复扣额</strong>。批量导出的未完成项会保留，修正图片后可在原队列重试。</p></div></section>
          <section><ShieldCheck size={18} /><div><h3>额度核对方式不变</h3><p>图片读取或渲染失败不消耗额度；复制转下载和回执重试沿用同一次导出记录。账号、草稿和已有额度保留。</p></div></section>
          <div className="announcement-support"><p>仍然遇到问题？联系公众号「老高 Vibe Coding」，提供失败提示、操作步骤与截图；需要核对个人导出记录时，再按提示提供诊断码。</p><p>请勿向他人提供密码或验证码。</p></div>
        </div>
        <footer className="announcement-footer"><p>关闭后不再自动弹出，可从顶部“公告”重新查看。</p><Dialog.Close render={<Button />}>我知道了</Dialog.Close></footer>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}

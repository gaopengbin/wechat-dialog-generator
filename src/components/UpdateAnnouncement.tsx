import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { MailCheck, Megaphone, ShieldCheck, UserRound, X } from 'lucide-react'
import { Button } from './ui/button'
import './UpdateAnnouncement.css'

const announcementId = '2026-09-10-account-v1'
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
        <div className="announcement-topline"><span><Megaphone size={15} /> 更新公告</span><time dateTime="2026-09-10">2026.09.10</time><Dialog.Close render={<Button variant="ghost" size="icon" aria-label="关闭更新公告" />}><X size={18} /></Dialog.Close></div>
        <Dialog.Title className="announcement-title">注册与登录，更清楚一点</Dialog.Title>
        <Dialog.Description className="announcement-description">这次更新，重点优化注册、登录和找回密码的提示，让你更顺利地开始创作。</Dialog.Description>
        <div className="announcement-body">
          <section><UserRound size={18} /><div><h3>首次使用，先注册</h3><p>验证邮箱完成注册后，即可领取 <strong>20 次额外导出额度</strong>。</p></div></section>
          <section><MailCheck size={18} /><div><h3>已有账号，直接登录</h3><p>使用注册邮箱和密码登录；忘记密码，可通过已验证的邮箱找回。收不到验证码时，请检查注册邮箱和垃圾邮件。</p></div></section>
          <section><ShieldCheck size={18} /><div><h3>原有内容与额度不受影响</h3><p>账号、创作内容和剩余额度保留，每日 <strong>10 次免费导出</strong>继续提供。</p></div></section>
          <div className="announcement-support"><p>仍然遇到问题？联系公众号「老高 Vibe Coding」，提供操作步骤与报错截图。</p><p>旧账号未验证邮箱且忘记密码，需要人工核实。请勿发送密码或验证码。</p></div>
        </div>
        <footer className="announcement-footer"><p>关闭后不再自动弹出，可从顶部“公告”重新查看。</p><Dialog.Close render={<Button />}>我知道了</Dialog.Close></footer>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { BookOpen, Megaphone, MousePointerClick, Search, ShieldCheck, X } from 'lucide-react'
import { Button } from './ui/button'
import './UpdateAnnouncement.css'

const announcementId = '2026-10-29-export-receipts-v2'
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
        <Dialog.Title className="announcement-title">导出同步与异常上报修复</Dialog.Title>
        <Dialog.Description className="announcement-description">修复图片生成后成功记录长时间待同步的问题，完整功能教程继续保留。</Dialog.Description>
        <div className="announcement-body">
          <section><MousePointerClick size={18} /><div><h3>修复成功记录同步卡住</h3><p>同步请求增加硬超时；联网、切回页面或返回编辑器时会继续处理待同步记录，单条异常不再长时间阻塞后续记录。</p></div></section>
          <section><Search size={18} /><div><h3>修正失败上报版本兼容</h3><p>修正前后端版本校验不一致，失败记录可正常接收；上报不包含聊天内容、图片或文件名。</p></div></section>
          <section><ShieldCheck size={18} /><div><h3>原编号重试，不重复扣额度</h3><p>已确认的导出重试不会再扣一次。本次排查确认的历史异常操作已单独保护，不补扣。草稿、奖励和套餐规则不变。</p></div></section>
          <section><BookOpen size={18} /><div><h3>完整功能教程继续保留</h3><p>7 个工作页、17 篇教程可从左侧【模板与指南】查找。工作页顶部【使用教程】直达对应功能；核对个人导出记录时，再按提示提供诊断码。</p></div></section>
        </div>
        <footer className="announcement-footer"><p>关闭后不再自动弹出，可从顶部“公告”重新查看。</p>{onOpenGuide && <Dialog.Close render={<Button variant="outline" onClick={onOpenGuide} />}>查看完整教程</Dialog.Close>}<Dialog.Close render={<Button />}>我知道了</Dialog.Close></footer>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}

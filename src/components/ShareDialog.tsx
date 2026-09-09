import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Download, Share2, X } from 'lucide-react'
import { createInvite, getGrowth, revokeInvite, type AccountSession, type Growth } from '@/lib/account-api'
import { trackGrowthEvent, growthReason } from '@/lib/growth-analytics'

async function renderCard(canvas: HTMLCanvasElement, url: string) {
  await document.fonts.ready
  canvas.width = 800; canvas.height = 1000
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#f1f6f2'; ctx.fillRect(0, 0, 800, 1000)
  ctx.fillStyle = '#086943'; ctx.fillRect(0, 0, 800, 12)
  const text = (value: string, x: number, y: number, size: number, color = '#163b2b', weight = 500) => {
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px "Microsoft YaHei", sans-serif`; ctx.fillText(value, x, y)
  }
  text('老高出品 / 微信创作工具箱', 60, 88, 23, '#527063')
  text('把创意，', 60, 206, 66, '#163b2b', 700)
  text('变成一张好图。', 60, 294, 66, '#163b2b', 700)
  text('对话 · 朋友圈 · 场景模拟', 64, 364, 29)
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(60, 408, 680, 166, 24); ctx.fill()
  text('不用安装，打开就能创作', 90, 466, 28, '#163b2b', 700)
  text('每日 10 次免费导出', 90, 512, 25)
  text('验证注册，再领 20 次奖励', 90, 548, 25, '#086943')
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, url, { width: 240, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#163b2b', light: '#ffffff' } })
  ctx.drawImage(qr, 60, 623)
  text('扫码，开始创作', 338, 706, 30, '#163b2b', 700)
  text('内容本地处理', 338, 755, 25, '#527063')
  text('分享好工具，让灵感流动', 338, 798, 22, '#527063')
  text('独立创作工具，非微信官方产品', 60, 941, 20, '#527063')
}

export function ShareDialog({ session, onClose, onAccount }: { session: AccountSession | null; onClose: () => void; onAccount: () => void }) {
  const [growth, setGrowth] = useState<Growth | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [ready, setReady] = useState(false)
  const card = useRef<HTMLCanvasElement>(null)
  const panel = useRef<HTMLElement>(null)
  const linkField = useRef<HTMLInputElement>(null)
  const trackedOpen = useRef(false)
  useEffect(() => { if (!trackedOpen.current) { trackedOpen.current = true; trackGrowthEvent('share_dialog_viewed') } }, [])
  const base = new URL(window.location.pathname, window.location.origin)
  if (code) base.searchParams.set('invite', code)
  const url = base.toString()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overlay = panel.current?.parentElement
    const siblings = Array.from(overlay?.parentElement?.children || []).filter(el => el !== overlay) as HTMLElement[]
    const previousInert = siblings.map(el => el.inert)
    siblings.forEach(el => { el.inert = true })
    panel.current?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input') || [])
        if (event.shiftKey && [items[0], panel.current].includes(document.activeElement as HTMLElement)) { event.preventDefault(); items.at(-1)?.focus() }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus() }
      }
    }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); siblings.forEach((el, i) => { el.inert = previousInert[i] }); previous?.focus() }
  }, [onClose])
  useEffect(() => {
    if (!session) return
    let active = true
    getGrowth().then(data => { if (active) { setGrowth(data); setCode(data.links.find(l => !l.revoked_at)?.code || '') } }).catch(() => { if (active) setNotice('邀请记录加载失败，请关闭后重试；仍可分享普通链接') })
    return () => { active = false }
  }, [session])
  useEffect(() => {
    let active = true
    // Render offscreen so an older QR promise cannot overwrite a new invitation card.
    const draft = document.createElement('canvas')
    renderCard(draft, url).then(() => { if (active && card.current) { card.current.width = draft.width; card.current.height = draft.height; card.current.getContext('2d')!.drawImage(draft, 0, 0); setReady(true) } }).catch(() => { if (active) setNotice('卡片生成失败，仍可复制下方链接') })
    return () => { active = false }
  }, [url])
  const activate = async () => {
    if (!session?.user.email_verified_at) { onAccount(); return }
    setBusy(true); setNotice('')
    try { const result = await createInvite(); setReady(false); setCode(result.code); setGrowth(await getGrowth()); linkField.current?.focus() }
    catch (error) { setNotice(error instanceof Error ? error.message : '创建失败，请重试') }
    finally { setBusy(false) }
  }
  const revoke = async () => {
    if (!window.confirm('停用后，旧链接仍可打开工具，但不再接受新的邀请归因。已登记的邀请仍按规则结算。确定停用？')) return
    setBusy(true)
    try { await revokeInvite(code); setReady(false); setCode(''); setGrowth(await getGrowth()); setNotice('邀请链接已停用，可重新创建') }
    catch (error) { setNotice(error instanceof Error ? error.message : '停用失败') }
    finally { setBusy(false) }
  }
  const copy = async () => {
    trackGrowthEvent('share_action', { action: 'copy', outcome: 'started', reason: 'none' })
    try { await navigator.clipboard.writeText(url); trackGrowthEvent('share_action', { action: 'copy', outcome: 'succeeded', reason: 'none' }); setNotice('链接已复制。对方打开并满足规则后才会发奖。') }
    catch { trackGrowthEvent('share_action', { action: 'copy', outcome: 'failed', reason: 'unavailable' }); linkField.current?.select(); setNotice('自动复制不可用，链接已选中，请长按复制或按 Ctrl+C') }
  }
  const download = () => {
    trackGrowthEvent('share_action', { action: 'card', outcome: 'started', reason: 'none' })
    try {
      const link = document.createElement('a'); link.download = '微信创作工具箱-分享卡片.png'; link.href = card.current!.toDataURL('image/png'); link.click()
      trackGrowthEvent('share_action', { action: 'card', outcome: 'download_requested', reason: 'none' }); setNotice('已请求保存 PNG，可发送给好友；保存卡片本身不会发奖。')
    } catch { trackGrowthEvent('share_action', { action: 'card', outcome: 'failed', reason: 'unavailable' }); setNotice('保存未发起，请重试或复制链接') }
  }
  const share = async () => {
    trackGrowthEvent('share_action', { action: 'system', outcome: 'started', reason: 'none' })
    if (!navigator.share) { trackGrowthEvent('share_action', { action: 'system', outcome: 'unsupported', reason: 'unavailable' }); return copy() }
    try { await navigator.share({ title: '微信创作工具箱', text: '打开即用，验证注册赠 20 次导出。', url }); trackGrowthEvent('share_action', { action: 'system', outcome: 'returned', reason: 'none' }); setNotice('已完成系统分享操作，奖励以有效访问及邀请记录为准。') }
    catch (error) { trackGrowthEvent('share_action', { action: 'system', outcome: growthReason(error) === 'cancelled' ? 'cancelled' : 'failed', reason: growthReason(error) }); setNotice(error instanceof DOMException && error.name === 'AbortError' ? '已取消分享，未计入奖励。' : '系统分享不可用，请复制链接或保存卡片。') }
  }
  return <div className="account-overlay" onMouseDown={e => { if (e.currentTarget === e.target) onClose() }}>
    <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="share-title" className="account-dialog share-dialog">
      <button className="account-close" onClick={onClose} aria-label="关闭分享"><X size={18} /></button>
      <span className="account-eyebrow">让好工具被更多人看见</span><h2 id="share-title">分享创作，也分享灵感</h2>
      <div className="share-layout"><div className="share-card-wrap"><canvas ref={card} aria-label="微信创作工具箱分享卡片，含产品介绍及当前分享链接的二维码" /></div><div>
        <p className="account-intro">{code ? '专属邀请已开启，二维码和链接均已带上邀请标识。' : '当前是普通分享。验证邮箱后可开启专属邀请奖励。'}</p>
        {!code && <button className="account-primary-button" disabled={busy} onClick={() => void activate()}>{session?.user.email_verified_at ? '开启我的邀请链接' : '登录 / 验证邮箱，开启奖励'}</button>}
        <label className="share-link-label">{code ? '我的邀请链接' : '工具链接'}<input ref={linkField} readOnly value={url} onFocus={e => e.target.select()} /></label>
        <div className="share-actions"><button onClick={() => void copy()}><Copy size={16} />复制链接</button><button disabled={!ready || busy} onClick={download}><Download size={16} />保存卡片</button><button onClick={() => void share()}><Share2 size={16} />系统分享</button></div>
        <p role="status" className="account-notice">{notice}</p>
        <div className="share-rules"><h3>奖励怎么拿？</h3><p><b>+20</b> 新注册或老账号首次完成邮箱验证，仅领一次。</p><p><b>+20</b> 首次有另一位已验证用户打开你的邀请链接。</p><p><b>+30</b> 新用户经你的链接验证注册，并完成首次导出。每日最多结算 10 人，超出可在后续导出时结算。</p><p>复制、保存、取消分享不直接发奖。同一新用户仅归属一个邀请人，不支持给老账号补填邀请。</p></div>
        {growth && <p className="account-intro">已验证邀请 {growth.invited} 人 · 已奖励 {growth.rewarded} 人。到账明细可在「我的账户」查看。</p>}
        {code && <button className="account-text-button" disabled={busy} onClick={() => void revoke()}>停用当前邀请链接</button>}
      </div></div>
      <p className="account-privacy">卡片不含你的邮箱、头像或对话。扫码只打开工具，不自动上传内容。</p>
    </section>
  </div>
}

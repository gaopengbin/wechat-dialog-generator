import { useEffect, useState } from 'react'
import { BellRing, Copy, Search, X } from 'lucide-react'

export type OfficialAccountPlacement = 'header' | 'export'

interface OfficialAccountDialogProps {
  open: boolean
  placement: OfficialAccountPlacement
  authenticated: boolean
  busy: boolean
  redeemMessage: string
  onClose: () => void
  onCopyId: () => void
  onLogin: () => void
  onRedeem: (code: string) => Promise<void>
}

export const officialAccountId = 'laogaovibecoding'
const officialAccountQrUrl = 'https://laogao.xyz/packages/qr-assets/gzh.jpg'

export function OfficialAccountDialog({ open, placement, authenticated, busy, redeemMessage, onClose, onCopyId, onLogin, onRedeem }: OfficialAccountDialogProps) {
  const [qrAvailable, setQrAvailable] = useState(true)
  const [code, setCode] = useState('')

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setCode(''); onClose() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="official-account-overlay" role="presentation" onMouseDown={event => {
      if (event.currentTarget === event.target) { setCode(''); onClose() }
    }}>
      <section className="official-account-dialog" role="dialog" aria-modal="true" aria-labelledby="official-account-title">
        <button className="official-account-close" type="button" onClick={() => { setCode(''); onClose() }} aria-label="关闭">
          <X size={18} />
        </button>

        <div className="official-account-mark" aria-hidden="true">
          <BellRing size={24} />
        </div>
        <span className="official-account-eyebrow">微信公众号</span>
        <h2 id="official-account-title">
          {placement === 'export' ? '导出成功，再领取 20 次额度' : '关注公众号，领取更多导出额度'}
        </h2>
        <p className="official-account-description">
          关注后回复关键词“额度”，获取 15 分钟有效的一次性兑换码；登录账户兑换后立即增加 20 次导出额度。
        </p>

        <div className="official-account-connect">
          <div className={`official-account-qr${qrAvailable ? '' : ' is-unavailable'}`}>
            {qrAvailable
              ? <img src={officialAccountQrUrl} alt="老高 Vibe Coding 公众号二维码" onError={() => setQrAvailable(false)} />
              : <BellRing size={30} aria-hidden="true" />}
            <small>{qrAvailable ? '微信扫码 · 手机长按识别' : '二维码暂时无法加载'}</small>
          </div>
          <div className="official-account-profile">
            <div className="official-account-name">
              <span>公众号</span>
              <strong>老高 Vibe Coding</strong>
            </div>
            <ul className="official-account-benefits">
              <li>关注后回复“额度”获取兑换码</li>
              <li>每个账户限领一次，奖励 20 次导出</li>
            </ul>
            <div className="official-account-search">
              <span><Search size={15} /> 无法扫码时搜索公众号 ID</span>
              <strong>{officialAccountId}</strong>
              <button type="button" onClick={onCopyId}><Copy size={15} /> 复制</button>
            </div>
          </div>
        </div>

        <div className="official-account-redeem">
          <div><span>关注奖励</span><strong>兑换 20 次额外导出</strong></div>
          {authenticated ? (
            <form onSubmit={event => { event.preventDefault(); void onRedeem(code) }}>
              <input value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="例如 LG-ABCD-2345" required />
              <button type="submit" disabled={busy}>{busy ? '兑换中…' : '立即兑换'}</button>
            </form>
          ) : <button className="official-account-login" type="button" onClick={() => { setCode(''); onLogin() }}>登录后兑换</button>}
          {redeemMessage && <small>{redeemMessage}</small>}
        </div>

        <div className="official-account-actions">
          <button className="official-account-dismiss" type="button" onClick={() => { setCode(''); onClose() }}>暂时不用，继续制作</button>
        </div>
        <small className="official-account-note">未登录仍有每日 10 次免费额度；账户仅同步额度，不上传创作内容。</small>
      </section>
    </div>
  )
}

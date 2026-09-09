import { useEffect, useState } from 'react'
import { ArrowUpRight, Gift, Megaphone, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getRewards, type AccountSession } from '@/lib/account-api'
import { rewardPromotion } from '@/lib/reward-promotion'

export function RewardHeaderButton({ onClick }: { onClick: () => void }) {
  return <Button type="button" className="reward-header-button" style={{ background: '#c2410c', color: '#fff', borderRadius: 10, gap: 7, padding: '0 12px', fontWeight: 700 }} onClick={onClick} aria-label="分享有奖，查看奖励规则">
    <Gift size={17} /><span>分享有奖</span><small>+30/人</small>
  </Button>
}

export function RewardPromotion({ session, refreshKey, onAccount, onShare }: {
  session: AccountSession | null; refreshKey: string; onAccount: () => void; onShare: () => void
}) {
  const [loaded, setLoaded] = useState<{ id: string; kinds: string[] } | null>(null)
  const id = session?.user.id
  const verified = session?.user.email_verified_at
  useEffect(() => {
    if (!id || !verified) return
    let active = true
    const refresh = () => {
      getRewards().then(data => { if (active) setLoaded({ id, kinds: data.rewards.map(r => r.kind) }) })
        .catch(() => { if (active) setLoaded(null) })
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => { active = false; window.removeEventListener('focus', refresh) }
  }, [id, verified, refreshKey])
  const promotion = rewardPromotion(session?.user || null, loaded?.id === id ? loaded?.kinds ?? null : null)
  return <section className="reward-promotion" aria-label="免费额度与分享奖励">
    <div className="reward-promotion-copy">
      <span className={`reward-promotion-badge${promotion.claimable ? ' is-claimable' : ''}`}><Gift size={14} />{promotion.badge}</span>
      <h2>{promotion.title}</h2>
      <p>{promotion.detail}</p>
    </div>
    <Button type="button" className="reward-claim-button" style={{ background: '#c2410c', color: '#fff', borderRadius: 10, height: 44, gap: 8, fontWeight: 700 }} onClick={promotion.target === 'account' ? onAccount : onShare}>
      {promotion.action}<ArrowUpRight size={18} />
    </Button>
    <button type="button" className="reward-invite-ticket" onClick={onShare} aria-label="邀请好友，每成功邀请一人奖励30次，查看条件">
      <span className="reward-ticket-icon"><Megaphone size={23} /></span>
      <span className="reward-ticket-copy"><b>邀请好友 · 持续有奖</b><small>验证注册并完成首次导出</small></span>
      <span className="reward-ticket-value"><strong>+30</strong><small>次 / 人</small></span>
      <Ticket className="reward-ticket-watermark" size={64} aria-hidden="true" />
    </button>
  </section>
}

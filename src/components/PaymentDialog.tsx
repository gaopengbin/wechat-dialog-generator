import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { CreditCard, ExternalLink, RefreshCw, X } from 'lucide-react'
import { Button } from './ui/button'
import { assertExportIdentity, captureExportIdentity, isExportIdentityCurrent, createPaymentOrder, getPaymentOrders, getPaymentProducts, refreshPaymentOrder, resumePaymentOrder, restoreAccount, type AccountSession, type ExportQuota, type PaymentOrder, type PaymentProduct, type PaymentCampaign } from '@/lib/account-api'
import { paymentError, paymentIntentKey, reserveCheckoutWindow, safeCheckoutUrl } from '@/lib/payment-ui'
import './PaymentDialog.css'

const states = { pending: '待付款 / 待确认', paid: '已支付 · 已到账', closed: '已关闭', refunding: '退款处理中', refunded: '已退款' }
const money = (fen: number) => `¥${(fen / 100).toFixed(2)}`
const date = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })

export function PaymentDialog({ session, onClose, onAccount, onQuota }: {
  session: AccountSession | null; onClose: () => void; onAccount: () => void; onQuota: (userId: string, quota: ExportQuota) => void
}) {
  const [products, setProducts] = useState<PaymentProduct[]>([])
  const [campaign, setCampaign] = useState<PaymentCampaign | null>(null)
  const [showDay, setShowDay] = useState(false)
  const [available, setAvailable] = useState(false)
  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [checkout, setCheckout] = useState<{ id: string; url: string } | null>(null)
  const lock = useRef(false)
  const identity = useRef(captureExportIdentity(session)).current
  const onQuotaRef = useRef(onQuota)
  useEffect(() => { onQuotaRef.current = onQuota }, [onQuota])
  const userId = session?.user.id
  const load = useCallback(async () => {
    const [catalog, history, account] = await Promise.all([getPaymentProducts(), userId ? getPaymentOrders(identity) : Promise.resolve({ orders: [] }), userId ? restoreAccount() : Promise.resolve(null)])
    assertExportIdentity(identity)
    setProducts(catalog.products); setAvailable(catalog.available); setOrders(history.orders); setLoaded(true)
    setCampaign(catalog.campaign || null)
    // An authenticated backend history response can retire only the exact known order.
    // Missing/ambiguous create responses deliberately keep their retry key.
    if (userId) for (const order of history.orders) {
      if (!['paid', 'closed', 'refunded'].includes(order.state)) continue
      const key = paymentIntentKey(userId, order.product_id)
      if (sessionStorage.getItem(`${key}:order`) === order.id) {
        sessionStorage.removeItem(key); sessionStorage.removeItem(`${key}:order`)
      }
    }
    if (account?.user.id === userId && account) onQuotaRef.current(account.user.id, account.quota)
    setCheckout(current => current && history.orders.some(order => order.id === current.id && order.state === 'pending') ? current : null)
  }, [userId, identity])
  const run = useCallback(async (operation: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { assertExportIdentity(identity); await operation() } catch (e) { setNotice(''); setError(paymentError(e)) }
    finally { lock.current = false; setBusy(false) }
  }, [identity])
  useEffect(() => { void run(load) }, [load, run])
  useEffect(() => {
    if (!campaign?.active) return
    const delay = Math.max(1000, Math.min(60000, Date.parse(campaign.ends_at) - Date.parse(campaign.server_now) + 100))
    const timer = setInterval(() => void run(load), delay)
    return () => clearInterval(timer)
  }, [campaign, load, run])

  async function prepare(product: PaymentProduct) {
    if (!session?.user.email_verified_at || !available || !loaded || product.purchasable === false) return
    await run(async () => {
      const popup = reserveCheckoutWindow()
      try {
      setCheckout(null); setNotice('正在准备订单，请勿重复操作。')
      const key = paymentIntentKey(session.user.id, product.id)
      let id = sessionStorage.getItem(key)
      if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id) }
      const result = await createPaymentOrder(product.id, id, product.amount_fen, identity)
      assertExportIdentity(identity)
      sessionStorage.setItem(`${key}:order`, result.order_id)
      if (result.state === 'pending' && result.checkout_url) {
        setCheckout({ id: result.order_id, url: safeCheckoutUrl(result.checkout_url) })
        setNotice(popup.navigate(result.checkout_url) ? '已自动打开支付宝收银台，付款后请回到此页点击“查询到账”。' : '浏览器未能自动打开收银台，请点击“打开支付宝收银台”；付款后查询到账，不要重复下单。')
      } else {
        popup.close()
        setNotice(`订单状态：${states[result.state]}，请刷新核对余额。`)
        const checked = await refreshPaymentOrder(result.order_id, identity)
        if (isExportIdentityCurrent(identity)) onQuota(session.user.id, checked.quota)
        if (checked.state !== 'pending') { sessionStorage.removeItem(key); sessionStorage.removeItem(`${key}:order`) }
      }
      await load()
      } finally { popup.close() }
    })
  }
  async function check(order: PaymentOrder) {
    if (!userId) return
    await run(async () => {
      const result = await refreshPaymentOrder(order.id, identity)
      assertExportIdentity(identity)
      onQuota(userId, result.quota)
      setOrders(current => current.map(item => item.id === order.id ? { ...item, state: result.state } : item))
      if (result.state !== 'pending') {
        setCheckout(current => current?.id === order.id ? null : current)
        sessionStorage.removeItem(paymentIntentKey(userId, order.product_id))
        sessionStorage.removeItem(`${paymentIntentKey(userId, order.product_id)}:order`)
      }
      setNotice(result.state === 'paid' ? '支付已确认，充值额度已同步到账。' : result.state === 'pending' ? '暂未确认付款。若已支付，请稍后再查询，不要重复付款。' : `订单状态：${states[result.state]}`)
    })
  }
  async function resume(order: PaymentOrder) {
    await run(async () => {
      const popup = reserveCheckoutWindow()
      try {
      setCheckout(null)
      const result = await resumePaymentOrder(order.id, identity)
      assertExportIdentity(identity)
      if (result.state === 'pending' && result.checkout_url) {
        setCheckout({ id: order.id, url: safeCheckoutUrl(result.checkout_url) })
        setNotice(popup.navigate(result.checkout_url) ? '已恢复原订单收银台并自动打开，不会新建订单。付款后请回到此页查询到账。' : '已恢复原订单收银台，但浏览器未能自动打开。请点击“打开支付宝收银台”，无需重新下单。')
      } else { popup.close(); setNotice(`订单状态：${states[result.state]}，请刷新核对余额。`); await load() }
      } finally { popup.close() }
    })
  }
  const pending = orders.some(order => order.state === 'pending')
  const member = session?.quota.membership
  const productCard = (product: PaymentProduct) => <article key={product.id} className={product.id === 'member-year' ? 'payment-product-featured' : undefined}>
    <span className="payment-product-name">{product.subject}{product.id === 'member-year' && <small>长期使用推荐</small>}</span>
    <div className="payment-price"><strong>{money(product.amount_fen)}</strong>{campaign?.active && product.regular_amount_fen && <span>计划常规价 {money(product.regular_amount_fen)}</span>}</div>
    <p>{product.kind === 'membership' ? `${product.duration_days === 1 ? '24 小时' : `${product.duration_days} 天`}内不限导出次数` : `${product.credits} 次导出 · 不设到期日`}</p>
    <small>{product.kind === 'membership' ? '包含批量制作 · 不自动续费' : '包含批量制作 · 按成功图片计次'}</small>
    <Button disabled={busy || !session?.user.email_verified_at || pending || product.purchasable === false} onClick={() => void prepare(product)}>{product.purchasable === false ? '暂时停售' : product.kind === 'membership' ? `购买${product.subject}` : `购买 ${product.credits} 次`}</Button>
  </article>
  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <Dialog.Portal><Dialog.Backdrop className="payment-backdrop" /><Dialog.Popup className="payment-dialog">
      <header><Dialog.Title><CreditCard size={20} /> 充值与订单</Dialog.Title><Dialog.Close disabled={busy} render={<Button variant="ghost" size="icon" aria-label="关闭充值" />}><X size={18} /></Dialog.Close></header>
      <Dialog.Description className="payment-muted">偶尔制作选次数包，高频批量选会员。支付宝确认支付后，权益计入当前账户。</Dialog.Description>
      <div className="payment-body">
        <div className="payment-balance"><span>充值余额</span><strong>{session ? session.quota.paid_remaining ?? 0 : '—'}<small> 次</small></strong><span>{session ? `当前账户：${session.user.display_name}` : '登录后查看余额与订单'}</span></div>
        {member?.active && member.expires_at && <p className="payment-membership">会员生效中 · 不限导出次数<br />有效至 {date(member.expires_at)}（北京时间），次数包与奖励余额保留。</p>}
        {!session && <Button onClick={onAccount}>登录后充值</Button>}
        {session && !session.user.email_verified_at && <Button onClick={onAccount}>验证邮箱后充值</Button>}
        {error && <p role="alert" className="payment-error">{error}</p>}
        {!loaded && busy && <p role="status">正在读取套餐与订单…</p>}
        {loaded && !available && <p className="payment-muted">支付宝充值暂未开放，暂时不能创建新订单。已有订单仍可查询。</p>}
        {available && campaign?.active && <div className="payment-launch"><strong>限时首发优惠 · 30 天</strong><span>截至 {date(campaign.ends_at)}（北京时间）</span><small>活动结束后按计划常规价销售；受收款限额影响的套餐届时暂停购买。</small></div>}
        {available && <><section aria-label="导出次数套餐" className="payment-products">{products.filter(p => p.id !== 'member-day').map(productCard)}</section>{products.some(p => p.id === 'member-day') && <><Button variant="ghost" size="sm" aria-expanded={showDay} aria-controls="payment-day-product" onClick={() => setShowDay(value => !value)}>{showDay ? '收起临时使用套餐' : '只用一天？查看 24 小时日卡'}</Button>{showDay && <section id="payment-day-product" aria-label="临时使用套餐" className="payment-products payment-day">{products.filter(p => p.id === 'member-day').map(productCard)}</section>}</>}</>}
        {pending && <p className="payment-muted">已有待确认订单，已付款请查询到账；尚未付款可点击“继续付款”恢复原收银台，请勿重复下单。</p>}
        {checkout && <div className="payment-checkout"><a href={checkout.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> 打开支付宝收银台</a><p>收款方与金额请以收银台为准。打开收银台不代表付款成功。</p></div>}
        {notice && <p role="status" className="payment-notice">{notice}</p>}
        <section className="payment-orders"><h3>充值订单 <span>最近 50 笔</span></h3>{loaded && !orders.length && <p className="payment-muted">暂无充值订单。</p>}{orders.map(order => <article key={order.id}><div><strong>{money(order.amount_fen)} · {order.kind === 'membership' ? order.subject || `${order.duration_days} 天会员` : `${order.credits} 次`}</strong><span>{states[order.state]}</span></div><small>{new Date(order.created_at).toLocaleString('zh-CN')}</small><code>{order.id}</code>{order.state === 'pending' && <div className="payment-order-actions"><Button variant="outline" size="sm" disabled={busy} onClick={() => void check(order)}>查询到账</Button>{available && session?.user.email_verified_at && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void resume(order)}>继续付款</Button>}</div>}</article>)}</section>
        <p className="payment-muted">会员从支付确认起计时，续购日／月／年卡均顺延现有会员到期时间，不自动续费。会员期间不扣免费、奖励和次数包额度；到期后按免费、奖励、次数包顺序使用。权益覆盖本地创作与批量导出，不包含未来另行收费的 AI 或云服务。</p>
        <p className="payment-muted">订单或退款问题请联系公众号「老高 Vibe Coding」，提供订单号，不要发送密码或密钥。会员退款需人工核对使用情况。</p>
      </div>
      <footer><span>不读取支付宝密码 · 不自动代付</span><Button variant="outline" disabled={busy} onClick={() => void run(load)}><RefreshCw size={14} /> 刷新套餐与订单</Button></footer>
    </Dialog.Popup></Dialog.Portal>
  </Dialog.Root>
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { CreditCard, LogOut, ShieldCheck, UserRound, X } from 'lucide-react'
import { AccountApiError, getRewards, requestEmailCode, resetAccountPassword, type AccountSession, type Reward } from '@/lib/account-api'
import { emailValidationMessage } from '@/lib/email-validation'
import { trackGrowthEvent } from '@/lib/growth-analytics'
import { Button } from './ui/button'

interface AccountDialogProps {
  open: boolean
  session: AccountSession | null
  busy: boolean
  error: string
  onClose: () => void
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string, displayName: string, challengeId: string, code: string) => Promise<void>
  onVerify: (email: string, challengeId: string, code: string) => Promise<void>
  onLogout: () => Promise<void>
  onRecharge: () => void
}

export function AccountDialog({ open, session, busy, error, onClose: closeParent, onLogin, onRegister, onVerify, onLogout, onRecharge }: AccountDialogProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login')
  const [email, setEmail] = useState<string | null>(null)
  const [emailError, setEmailError] = useState('')
  const emailInput = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState('')
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [notice, setNotice] = useState('')
  const [localError, setLocalError] = useState('')
  const [showParentError, setShowParentError] = useState(true)
  const [rewards, setRewards] = useState<Reward[]>([])
  const panel = useRef<HTMLElement>(null)
  const locked = busy || sending
  const purpose = session ? 'bind' : mode === 'reset' ? 'reset' : 'register'
  const targetEmail = email ?? (session?.user.email ?? '')
  const formMode = session ? session.user.email_verified_at ? 'account' : 'bind' : mode
  const viewedMode = useRef('')
  useEffect(() => {
    if (!open) { viewedMode.current = ''; return }
    if (viewedMode.current !== formMode) { viewedMode.current = formMode; trackGrowthEvent('account_form_viewed', { mode: formMode }) }
  }, [open, formMode])
  const onClose = useCallback(() => { trackGrowthEvent('account_form_closed', { mode: formMode }); closeParent() }, [closeParent, formMode])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const overlay = panel.current?.parentElement
    const siblings = Array.from(overlay?.parentElement?.children || []).filter(el => el !== overlay) as HTMLElement[]
    const previousInert = siblings.map(el => el.inert)
    siblings.forEach(el => { el.inert = true })
    panel.current?.focus()
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const elements = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]') || [])
      const first = elements[0], last = elements.at(-1)
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', close)
    return () => { window.removeEventListener('keydown', close); siblings.forEach((el, i) => { el.inert = previousInert[i] }); previous?.focus() }
  }, [onClose, open])
  useEffect(() => {
    if (!cooldown) return
    const id = window.setTimeout(() => setCooldown(n => Math.max(0, n - 1)), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])
  useEffect(() => {
    if (!open || !session) return
    let active = true
    getRewards().then(r => { if (active) setRewards(r.rewards) }).catch(() => { if (active) setLocalError('奖励记录暂时加载失败，请重新打开账户重试') })
    return () => { active = false }
  }, [open, session])
  if (!open) return null

  const changeMode = (next: typeof mode) => { if (next !== mode) trackGrowthEvent('account_form_closed', { mode: formMode }); setMode(next); setPassword(''); setChallenge(''); setCode(''); setCooldown(0); setNotice(''); setLocalError(''); setEmailError(''); setShowParentError(false) }
  const validateEmail = () => {
    const message = emailValidationMessage(targetEmail)
    setEmailError(message)
    if (message) emailInput.current?.focus()
    return !message
  }
  const sendCode = async () => {
    if (!validateEmail()) return
    setSending(true); setLocalError(''); setNotice(''); setShowParentError(false)
    try { const result = await requestEmailCode(targetEmail.trim(), purpose); setChallenge(result.challenge_id); setCooldown(result.retry_after); setNotice(result.message) }
    catch (err) {
      if (err instanceof AccountApiError && err.code === 'invalid_email') { setEmailError('邮箱格式不正确，请检查完整地址，例如 name@qq.com'); emailInput.current?.focus() }
      else setLocalError(err instanceof Error ? err.message : '发送失败，请重试')
    }
    finally { setSending(false) }
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setLocalError(''); setNotice(''); setShowParentError(true)
    if (!validateEmail()) return
    if (session) await onVerify(targetEmail.trim(), challenge, code)
    else if (mode === 'login') await onLogin(targetEmail.trim(), password)
    else if (mode === 'register') await onRegister(targetEmail.trim(), password, displayName, challenge, code)
    else {
      setSending(true)
      try { await resetAccountPassword(targetEmail.trim(), password, challenge, code); changeMode('login'); setPassword(''); setNotice('密码已更新，其他设备已退出，请用新密码登录') }
      catch (err) { setLocalError(err instanceof Error ? err.message : '重置失败') }
      finally { setSending(false) }
    }
  }
  const emailField = <label>邮箱<input ref={emailInput} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={targetEmail} disabled={locked} aria-invalid={Boolean(emailError)} aria-describedby="account-email-feedback" onChange={event => { const value = event.target.value; setEmail(value); setChallenge(''); setCode(''); setNotice(''); if (emailError) setEmailError(emailValidationMessage(value)) }} onBlur={() => { if (targetEmail) setEmailError(emailValidationMessage(targetEmail)) }} onInvalid={event => { event.preventDefault(); setEmailError(emailValidationMessage(targetEmail) || '请输入有效邮箱，例如 name@qq.com'); emailInput.current?.focus() }} placeholder="name@qq.com" required maxLength={160} /><span id="account-email-feedback" className={emailError ? 'account-field-error' : 'account-field-hint'} role={emailError ? 'alert' : undefined}>{emailError || '填写你能正常收信的完整邮箱地址'}</span></label>
  const verificationFields = <>
    {emailField}
    <label>邮箱验证码<div className="account-code-row"><input aria-label="邮箱验证码" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="6 位验证码" required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} disabled={locked} /><button type="button" disabled={locked || cooldown > 0} onClick={() => void sendCode()}>{sending ? '发送中…' : cooldown ? `${cooldown} 秒后重发` : '获取验证码'}</button></div></label>
  </>
  const visibleError = localError || (showParentError ? error : '')
  const feedback = <><div role="status" className="account-notice">{notice}</div>{visibleError && <div role="alert" className="account-error">{visibleError}</div>}</>
  return <div className="account-overlay" onMouseDown={event => { if (event.currentTarget === event.target && !locked) onClose() }}>
    <section ref={panel} tabIndex={-1} className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
      <button className="account-close" type="button" disabled={locked} onClick={onClose} aria-label="关闭"><X size={18} /></button>
      <div className="account-avatar"><UserRound size={24} /></div>
      <span className="account-eyebrow">{session ? '我的账户' : '微信创作工具箱'}</span>
      <h2 id="account-title">{session ? session.user.display_name : mode === 'login' ? '登录后继续创作' : mode === 'reset' ? '找回你的账户' : '验证邮箱，开始创作'}</h2>
      {session ? <>
        <p className="account-email">{session.user.email} · {session.user.email_verified_at ? '已验证' : '待验证'}</p>
        <div className="account-quota-grid"><div><span>今日免费</span><strong>{session.quota.daily_remaining}</strong><small>/ {session.quota.daily_limit} 次</small></div><div><span>奖励额度</span><strong>{session.quota.bonus_remaining}</strong><small>次</small></div></div>
        <section className="account-billing" aria-label="充值与会员">
          <div className="account-billing-row">
            <div className="account-paid-balance"><span>充值余额</span><strong>{session.quota.paid_remaining ?? 0}<small> 次</small></strong></div>
            <Button className="account-recharge-button" aria-label={`支付宝充值 · 余额 ${session.quota.paid_remaining ?? 0} 次`} disabled={locked} onClick={onRecharge}><CreditCard size={15} /> 充值 / 选套餐</Button>
          </div>
          {session.quota.membership?.active && session.quota.membership.expires_at && <p className="account-membership-note">会员不限次 · 有效至 {new Date(session.quota.membership.expires_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}（北京时间）。次数包和奖励余额保留。</p>}
        </section>
        {!session.user.email_verified_at && <form className="account-form" onSubmit={event => void submit(event)}><p className="account-intro">首次验证邮箱赠 20 次导出。原有账号、项目和额度全部保留；如原邮箱填错，可改为你能收信的邮箱。</p>{verificationFields}{feedback}<button className="account-primary-button" disabled={locked || !challenge}>验证邮箱并领取 20 次</button></form>}
        {session.user.email_verified_at && feedback}
        <details className="account-rewards"><summary>奖励明细 · {rewards.length} 笔</summary>{rewards.length ? rewards.map((r, i) => <div key={i}><span>{({ email_verified: '邮箱验证', first_share: '首次有效分享', referral: '成功邀请' } as Record<string, string>)[r.kind] || r.kind}<small>{new Date(r.created_at).toLocaleString('zh-CN')}</small></span><strong>+{r.amount}</strong></div>) : <p>暂无本次活动奖励记录，历史公众号奖励仍计入余额。</p>}</details>
        <p className="account-security"><ShieldCheck size={15} /> 创作内容留在本机，账号同步邮箱和额度。</p>
        <button className="account-secondary-button" type="button" disabled={locked} onClick={() => void onLogout()}><LogOut size={15} /> 退出登录</button>
      </> : <>
        <p className="account-intro">{mode === 'login' ? '首次使用请先注册。已注册账号使用邮箱和密码登录。' : mode === 'reset' ? '仅向已注册并验证的邮箱发送重置验证码；没有注册过，请先注册。' : '每日 10 次免费导出，验证邮箱完成注册后额外赠 20 次。'}</p>
        <div className="account-tabs"><button className={mode === 'login' ? 'is-active' : ''} disabled={locked} type="button" onClick={() => changeMode('login')}>登录</button><button className={mode === 'register' ? 'is-active' : ''} disabled={locked} type="button" onClick={() => changeMode('register')}>注册</button></div>
        <form className="account-form" onSubmit={event => void submit(event)}>
          {mode === 'register' && <label>昵称<input autoComplete="nickname" value={displayName} disabled={locked} onChange={event => setDisplayName(event.target.value)} required maxLength={32} /></label>}
          {mode === 'login' ? emailField : verificationFields}
          <label>{mode === 'reset' ? '新密码' : '密码'}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} disabled={locked} onChange={event => setPassword(event.target.value)} placeholder="8–72 个字符" required minLength={8} maxLength={72} /></label>
          {feedback}<button className="account-primary-button" disabled={locked || (mode !== 'login' && !challenge)}>{busy ? '请稍候…' : mode === 'login' ? '登录' : mode === 'reset' ? '更新密码' : '验证并注册 · 领取 20 次'}</button>
        </form>
        {mode === 'login' && <button className="account-text-button" disabled={locked} onClick={() => changeMode('reset')}>忘记密码？</button>}
        {mode !== 'register' && <Button variant="outline" className="account-secondary-button" disabled={locked} onClick={() => changeMode('register')}>首次使用？去注册</Button>}
        {mode === 'reset' && <p className="account-intro">收不到邮件？确认填写的是注册邮箱并检查垃圾邮件。老账号未验证且忘记密码，请联系公众号「老高 Vibe Coding」核实，不要反复获取验证码。</p>}
        <p className="account-privacy">验证码 5 分钟有效、只能使用一次。我们不索取你的验证码。</p>
      </>}
    </section>
  </div>
}

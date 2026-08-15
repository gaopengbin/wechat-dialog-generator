import { useEffect, useState } from 'react'
import { LogOut, ShieldCheck, UserRound, X } from 'lucide-react'
import type { AccountSession } from '@/lib/account-api'

interface AccountDialogProps {
  open: boolean
  session: AccountSession | null
  busy: boolean
  error: string
  onClose: () => void
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string, displayName: string) => Promise<void>
  onLogout: () => Promise<void>
}

export function AccountDialog({ open, session, busy, error, onClose, onLogin, onRegister, onLogout }: AccountDialogProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose, open])

  if (!open) return null

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (mode === 'login') await onLogin(email, password)
    else await onRegister(email, password, displayName)
  }

  return (
    <div className="account-overlay" role="presentation" onMouseDown={event => {
      if (event.currentTarget === event.target) onClose()
    }}>
      <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <button className="account-close" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        {session ? (
          <>
            <div className="account-avatar"><UserRound size={24} /></div>
            <span className="account-eyebrow">我的账户</span>
            <h2 id="account-title">{session.user.display_name}</h2>
            <p className="account-email">{session.user.email}</p>
            <div className="account-quota-grid">
              <div><span>今日免费</span><strong>{session.quota.daily_remaining}</strong><small>/ {session.quota.daily_limit} 次</small></div>
              <div><span>奖励额度</span><strong>{session.quota.bonus_remaining}</strong><small>次</small></div>
            </div>
            <p className="account-security"><ShieldCheck size={15} /> 项目内容仍只保存在本机，账户仅同步额度。</p>
            <button className="account-secondary-button" type="button" disabled={busy} onClick={() => { void onLogout() }}><LogOut size={15} /> 退出登录</button>
          </>
        ) : (
          <>
            <div className="account-avatar"><UserRound size={24} /></div>
            <span className="account-eyebrow">导出额度账户</span>
            <h2 id="account-title">{mode === 'login' ? '登录后继续创作' : '创建免费账户'}</h2>
            <p className="account-intro">每日 10 次免费导出，关注公众号还可领取 20 次额外额度。</p>
            <div className="account-tabs">
              <button className={mode === 'login' ? 'is-active' : ''} type="button" onClick={() => setMode('login')}>登录</button>
              <button className={mode === 'register' ? 'is-active' : ''} type="button" onClick={() => setMode('register')}>注册</button>
            </div>
            <form className="account-form" onSubmit={event => { void submit(event) }}>
              {mode === 'register' && <label>昵称<input autoComplete="nickname" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="怎么称呼你" required maxLength={32} /></label>}
              <label>邮箱<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" required /></label>
              <label>密码<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="至少 8 个字符" required minLength={8} maxLength={72} /></label>
              {error && <div className="account-error">{error}</div>}
              <button className="account-primary-button" type="submit" disabled={busy}>{busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}</button>
            </form>
            <p className="account-privacy">不上传聊天内容、头像或生成图片。</p>
          </>
        )}
      </section>
    </div>
  )
}

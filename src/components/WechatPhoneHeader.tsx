import type { PhoneSettings } from '@/types'
import './PhonePreview.css'

export type WechatHeaderAction = 'dots' | 'camera' | 'none'

interface WechatPhoneHeaderProps {
  settings: PhoneSettings
  title?: string
  variant?: 'chat' | 'compact'
  rightAction?: WechatHeaderAction
}

function SignalIcon({ bars, secondaryBars, dual = false }: { bars: number; secondaryBars?: number; dual?: boolean }) {
  const asset = `${import.meta.env.BASE_URL}${dual ? 'ios-dual-signal.png' : 'ios-cell-signal-official.png'}`
  const primaryWidth = `${Math.max(1, Math.min(4, bars)) * 25}%`
  const secondaryWidth = `${Math.max(1, Math.min(4, secondaryBars ?? bars)) * 25}%`
  return <span className={`wc-official-signal ${dual ? 'wc-official-signal-dual' : 'wc-official-signal-single'}`} aria-label={dual ? '双卡信号' : '蜂窝网络信号'}>
    <img className="wc-official-signal-base" src={asset} alt="" />
    <span className="wc-official-signal-active wc-official-signal-primary" style={{ width: primaryWidth }}><img src={asset} alt="" /></span>
    {dual && <span className="wc-official-signal-active wc-official-signal-secondary" style={{ width: secondaryWidth }}><img src={asset} alt="" /></span>}
  </span>
}

function WifiIcon() {
  return <span className="wc-official-wifi" aria-label="Wi-Fi 已开启"><img src={`${import.meta.env.BASE_URL}ios-wifi-official.png`} alt="" /></span>
}

function AndroidSignalIcon({ bars }: { bars: number }) {
  const activeBars = Math.max(1, Math.min(4, bars))
  const signalBars = [{ x: .75, y: 10, height: 4 }, { x: 4.25, y: 6.5, height: 7.5 }, { x: 7.75, y: 3, height: 11 }, { x: 11.25, y: 0, height: 14 }]
  return <svg className="wc-android-signal" viewBox="0 0 14 14" aria-label={`信号 ${bars} 格`}>{signalBars.map((bar, index) => <rect key={bar.x} x={bar.x} y={bar.y} width="2.5" height={bar.height} rx=".5" opacity={activeBars > index ? 1 : .22} />)}</svg>
}

function AndroidWifiIcon() {
  return <svg className="wc-android-wifi" viewBox="0 0 18 13" aria-label="Wi-Fi 已开启"><path d="M.523 3.314a.5.5 0 0 0-.007.701l.707.707a.5.5 0 0 0 .715.008c3.998-3.64 10.128-3.64 14.126 0a.5.5 0 0 0 .715-.008l.707-.707a.5.5 0 0 0-.007-.701C12.698-1.105 5.304-1.105.523 3.314Z" /><path d="M15.011 6.49a.49.49 0 0 0-.009-.698C11.592 2.736 6.411 2.736 3 5.792a.49.49 0 0 0-.009.698l.707.707a.5.5 0 0 0 .719.012c2.625-2.279 6.543-2.279 9.168 0a.5.5 0 0 0 .719-.012l.707-.707Z" /><path d="M5.465 8.964a.48.48 0 0 1 .016-.691c2.034-1.697 5.006-1.697 7.04 0a.48.48 0 0 1 .016.691l-.707.708a.52.52 0 0 1-.731.026c-1.24-.931-2.956-.931-4.195 0a.52.52 0 0 1-.731-.026l-.708-.708Z" /><path d="M10.062 11.439c.195-.195.197-.519-.04-.66a1.99 1.99 0 0 0-2.042 0c-.237.141-.235.465-.04.66l.707.707a.5.5 0 0 0 .708 0l.707-.707Z" /></svg>
}

function AndroidBatteryIcon({ level }: { level: number }) {
  return <span className={`wc-android-battery${level <= 20 ? ' wc-android-battery-low' : ''}${level < 55 ? ' wc-android-battery-sparse' : ''}`} aria-label={`电量 ${level}%`}><span className="wc-android-battery-fill" style={{ width: `${Math.max(4, level)}%` }} /><strong>{level}</strong><i /></span>
}

export function WechatPhoneHeader({ settings, title, variant = 'chat', rightAction = 'dots' }: WechatPhoneHeaderProps) {
  return <div className={`wechat-shared-header is-${variant} is-${settings.platform}`}>
    <div className="wc-status-bar">
      <div className="wc-time">{settings.time}</div>
      <div className="wc-status-icons">{settings.platform === 'ios' ? <><div className="wc-signal-group"><SignalIcon bars={settings.signal} secondaryBars={settings.secondarySignal} dual={settings.simMode === 'dual'} />{settings.wifiEnabled && <WifiIcon />}</div><div className="wc-battery-wrap" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}ios-battery-dark.png)` }}><span className="wc-battery-level" aria-label={`电量 ${settings.battery}%`}><i style={{ width: `${settings.battery}%` }} /></span></div></> : <><div className="wc-android-signal-group"><AndroidSignalIcon bars={settings.signal} />{settings.simMode === 'dual' && <AndroidSignalIcon bars={settings.secondarySignal} />}</div>{settings.wifiEnabled && <AndroidWifiIcon />}<AndroidBatteryIcon level={settings.battery} /></>}</div>
    </div>
    <div className="wc-nav">
      <div className="wc-nav-left"><svg width="27" height="52" viewBox="0 0 27 52" fill="none"><path d="M25 2L3 26l22 24" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>{variant === 'chat' && settings.unreadCount > 0 && <span className="wc-nav-badge">{settings.unreadCount}</span>}</div>
      <div className="wc-nav-center"><span>{title === undefined ? (settings.contactName || '对方') : title}</span></div>
      <div className="wc-nav-right">{rightAction === 'dots' ? <div className="wc-nav-dots"><i /><i /><i /></div> : rightAction === 'camera' ? <i className="wechat-shared-camera" /> : null}</div>
    </div>
  </div>
}

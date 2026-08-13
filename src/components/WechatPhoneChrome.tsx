import './PhonePreview.css'

interface WechatPhoneChromeProps {
  title?: string
  children: React.ReactNode
  className?: string
  watermark?: boolean
  rightAction?: 'dots' | 'camera' | 'none'
}

function SignalIcon() {
  return (
    <svg className="wechat-chrome-signal" viewBox="0 0 17 12" role="img" aria-label="蜂窝网络信号">
      <rect x="0" y="8" width="2.6" height="4" rx="1" />
      <rect x="4.5" y="6" width="2.6" height="6" rx="1" />
      <rect x="9" y="3" width="2.6" height="9" rx="1" />
      <rect x="13.5" y="0" width="2.6" height="12" rx="1" />
    </svg>
  )
}

function WifiIcon() {
  return <img className="wechat-chrome-wifi" src={`${import.meta.env.BASE_URL}ios-wifi-official.png`} alt="Wi-Fi" />
}

export function WechatPhoneChrome({ title = '', children, className = '', watermark = true, rightAction = 'dots' }: WechatPhoneChromeProps) {
  return (
    <div className={`wechat-phone-chrome ${className}`}>
      <div className="wechat-chrome-screen">
        <div className="wechat-chrome-status">
          <strong>12:02</strong>
          <div className="wechat-chrome-status-icons">
            <SignalIcon />
            <WifiIcon />
            <span className="wechat-chrome-battery" aria-label="电量 87%"><i /></span>
          </div>
        </div>
        <div className="wechat-chrome-nav">
          <span className="wechat-chrome-back" aria-hidden="true" />
          <strong>{title}</strong>
          <span className={`wechat-chrome-action is-${rightAction}`} aria-hidden="true">
            {rightAction === 'dots' ? '•••' : rightAction === 'camera' ? <i className="wechat-chrome-camera-icon" /> : ''}
          </span>
        </div>
        <div className="wechat-chrome-content">{children}</div>
        {watermark && <div className="wechat-chrome-watermark">模拟界面 · 非真实微信内容</div>}
        <div className="wechat-chrome-home-indicator" />
      </div>
    </div>
  )
}

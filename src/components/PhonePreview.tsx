import { useRef, useEffect } from 'react';
import type { ChatUser, ChatMessage, PhoneSettings } from '@/types';
import { getDefaultAvatar } from '@/lib/parser';
import './PhonePreview.css';

interface PhonePreviewProps {
  users: ChatUser[];
  messages: ChatMessage[];
  settings: PhoneSettings;
  selfId: number | null;
  phoneRef?: React.RefObject<HTMLDivElement | null>;
  onUpdateMessage?: (msgId: number, content: string) => void;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Apple Support status icon assets, cropped and layered so signal strength remains configurable.
function SignalIcon({ bars, secondaryBars, dual = false }: { bars: number; secondaryBars?: number; dual?: boolean }) {
  const asset = `${import.meta.env.BASE_URL}${dual ? 'ios-dual-signal.png' : 'ios-cell-signal-official.png'}`;
  const primaryWidth = `${Math.max(1, Math.min(4, bars)) * 25}%`;
  const secondaryWidth = `${Math.max(1, Math.min(4, secondaryBars ?? bars)) * 25}%`;

  return (
    <span
      className={`wc-official-signal ${dual ? 'wc-official-signal-dual' : 'wc-official-signal-single'}`}
      aria-label={dual ? `双卡信号 ${bars} 格、${secondaryBars ?? bars} 格` : `信号 ${bars} 格`}
    >
      <img className="wc-official-signal-base" src={asset} alt="" />
      <span className="wc-official-signal-active wc-official-signal-primary" style={{ width: primaryWidth }}>
        <img src={asset} alt="" />
      </span>
      {dual && (
        <span className="wc-official-signal-active wc-official-signal-secondary" style={{ width: secondaryWidth }}>
          <img src={asset} alt="" />
        </span>
      )}
    </span>
  );
}

function WifiIcon() {
  return (
    <span className="wc-official-wifi" aria-label="Wi-Fi 已开启">
      <img src={`${import.meta.env.BASE_URL}ios-wifi-official.png`} alt="" />
    </span>
  );
}

// Geometry from Android's official 2024 SystemUI status-bar resources.
function AndroidSignalIcon({ bars }: { bars: number }) {
  const activeBars = Math.max(1, Math.min(4, bars));
  const signalBars = [
    { x: 0.75, y: 10, height: 4 },
    { x: 4.25, y: 6.5, height: 7.5 },
    { x: 7.75, y: 3, height: 11 },
    { x: 11.25, y: 0, height: 14 },
  ];
  return (
    <svg className="wc-android-signal" viewBox="0 0 14 14" aria-label={`信号 ${bars} 格`}>
      {signalBars.map((bar, index) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={bar.y}
          width="2.5"
          height={bar.height}
          rx="0.5"
          opacity={activeBars > index ? 1 : 0.22}
        />
      ))}
    </svg>
  );
}

function AndroidWifiIcon() {
  return (
    <svg className="wc-android-wifi" viewBox="0 0 18 13" aria-label="Wi-Fi 已开启">
      <path d="M.523 3.314a.5.5 0 0 0-.007.701l.707.707a.5.5 0 0 0 .715.008c3.998-3.64 10.128-3.64 14.126 0a.5.5 0 0 0 .715-.008l.707-.707a.5.5 0 0 0-.007-.701C12.698-1.105 5.304-1.105.523 3.314Z" />
      <path d="M15.011 6.49a.49.49 0 0 0-.009-.698C11.592 2.736 6.411 2.736 3 5.792a.49.49 0 0 0-.009.698l.707.707a.5.5 0 0 0 .719.012c2.625-2.279 6.543-2.279 9.168 0a.5.5 0 0 0 .719-.012l.707-.707Z" />
      <path d="M5.465 8.964a.48.48 0 0 1 .016-.691c2.034-1.697 5.006-1.697 7.04 0a.48.48 0 0 1 .016.691l-.707.708a.52.52 0 0 1-.731.026c-1.24-.931-2.956-.931-4.195 0a.52.52 0 0 1-.731-.026l-.708-.708Z" />
      <path d="M10.062 11.439c.195-.195.197-.519-.04-.66a1.99 1.99 0 0 0-2.042 0c-.237.141-.235.465-.04.66l.707.707a.5.5 0 0 0 .708 0l.707-.707Z" />
    </svg>
  );
}

function AndroidBatteryIcon({ level }: { level: number }) {
  return (
    <span className={`wc-android-battery${level <= 20 ? ' wc-android-battery-low' : ''}${level < 55 ? ' wc-android-battery-sparse' : ''}`} aria-label={`电量 ${level}%`}>
      <span className="wc-android-battery-fill" style={{ width: `${Math.max(4, level)}%` }} />
      <strong>{level}</strong>
      <i />
    </span>
  );
}

function TimeNotice({ content }: { content: string }) {
  return (
    <div className="wc-notice">
      <span className="wc-notice-bg">{content}</span>
    </div>
  );
}

function ChatBubble({ msg, user, userIndex, isSelf, isGroup, selfColor, otherColor, onUpdateMessage }: {
  msg: ChatMessage;
  user: ChatUser;
  userIndex: number;
  isSelf: boolean;
  isGroup: boolean;
  selfColor: string;
  otherColor: string;
  onUpdateMessage?: (msgId: number, content: string) => void;
}) {
  const avatarSrc = user.avatar || getDefaultAvatar(userIndex);
  const bubbleColor = isSelf ? selfColor : otherColor;
  const imgInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateMessage) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onUpdateMessage(msg.id, ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const renderContent = () => {
    switch (msg.type) {
      case 'text':
        return (
          <div className="wc-bubble" style={{ background: bubbleColor }}>
            <span className="wc-arrow" style={{ background: bubbleColor }} />
            <span dangerouslySetInnerHTML={{ __html: escHtml(msg.content).replace(/\n/g, '<br>') }} />
          </div>
        );
      case 'image': {
        const hasImage = msg.content && !msg.content.includes('placeholder');
        return (
          <div className="wc-bubble wc-bubble-image" onClick={() => imgInputRef.current?.click()} style={{ cursor: 'pointer' }}>
            {hasImage ? (
              <img src={msg.content} alt="" />
            ) : (
              <div className="wc-img-placeholder">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" fill="#999" stroke="none" /><path d="M21 15l-5-5L5 21" /></svg>
                <span>点击上传图片</span>
              </div>
            )}
            <input ref={imgInputRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
          </div>
        );
      }
      case 'voice': {
        const dur = msg.params.duration || 2;
        const w = 180 + Math.min(dur * 30, 400);
        return (
          <div className="wc-voice-stack">
            <div className="wc-bubble wc-bubble-voice" style={{ background: bubbleColor, width: `${w}px` }}>
              <span className="wc-arrow" style={{ background: bubbleColor }} />
              {isSelf ? (
                <><span className="wc-voice-dur">{dur}&quot;</span><img className="wc-voice-wave" src={`${import.meta.env.BASE_URL}wechat-voice-icon2.png`} alt="" /></>
              ) : (
                <><img className="wc-voice-wave" src={`${import.meta.env.BASE_URL}wechat-voice-icon1.png`} alt="" /><span className="wc-voice-dur">{dur}&quot;</span>{!msg.params.transcript && <i className="wc-voice-unread" />}</>
              )}
            </div>
            {msg.params.transcript && (
              <div className="wc-voice-transcript">{escHtml(msg.params.transcript)}</div>
            )}
          </div>
        );
      }
      case 'redpacket':
        return (
          <div className="wc-bubble wc-bubble-redpacket">
            <span className="wc-arrow" style={{ background: '#f79c46' }} />
            <div className="wc-rp-content">
              <div className="wc-rp-icon wc-rp-icon-redpacket"><img src={`${import.meta.env.BASE_URL}wechat-trans-icon3.png`} alt="" /></div>
              <div className="wc-rp-info">
                <span>{escHtml(msg.params.remark || '恭喜发财，大吉大利')}</span>
              </div>
            </div>
            <div className="wc-rp-bottom"><span>微信红包</span></div>
          </div>
        );
      case 'transfer':
        return (
          <div className="wc-bubble wc-bubble-transfer">
            <span className="wc-arrow" style={{ background: '#f79c46' }} />
            <div className="wc-rp-content">
              <div className="wc-rp-icon"><img src={`${import.meta.env.BASE_URL}wechat-trans-icon1.png`} alt="" /></div>
              <div className="wc-rp-info">
                <span>¥{parseFloat(msg.params.amount || '0').toFixed(2)}</span>
                <small>{escHtml(msg.params.remark || '转账')}</small>
              </div>
            </div>
            <div className="wc-rp-bottom"><span>微信转账</span></div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`wc-dialog ${isSelf ? 'wc-dialog-right' : ''}`}>
      <div className="wc-face">
        <img src={avatarSrc} alt={user.name} />
      </div>
      <div className="wc-body">
        {!isSelf && isGroup && <div className="wc-nick">{user.name}</div>}
        {renderContent()}
      </div>
    </div>
  );
}

export function PhonePreview({ users, messages, settings, selfId, phoneRef, onUpdateMessage }: PhonePreviewProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (bodyRef.current) {
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [messages]);

  const isGroup = users.length > 2;

  return (
    <div className="wc-phone-scale-wrap">
      <div className="wc-phone-wrap">
        <div className="wc-phone-content">
          <div className={`wc-phone wc-phone-${settings.platform}`} ref={phoneRef}>
            {/* Status bar */}
            <div className="wc-phone-top">
              <div className="wc-status-bar">
                <div className="wc-time">{settings.time}</div>
                <div className="wc-status-icons">
                  {settings.platform === 'ios' ? (
                    <>
                      <div className="wc-signal-group">
                        <SignalIcon
                          bars={settings.signal}
                          secondaryBars={settings.secondarySignal}
                          dual={settings.simMode === 'dual'}
                        />
                        {settings.wifiEnabled && <WifiIcon />}
                      </div>
                      <div
                        className="wc-battery-wrap"
                        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}ios-battery-dark.png)` }}
                      >
                        <span className="wc-battery-level" aria-label={`电量 ${settings.battery}%`}>
                          <i style={{ width: `${settings.battery}%` }} />
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="wc-android-signal-group">
                        <AndroidSignalIcon bars={settings.signal} />
                        {settings.simMode === 'dual' && <AndroidSignalIcon bars={settings.secondarySignal} />}
                      </div>
                      {settings.wifiEnabled && <AndroidWifiIcon />}
                      <AndroidBatteryIcon level={settings.battery} />
                    </>
                  )}
                </div>
              </div>
              {/* Nav bar */}
              <div className="wc-nav">
                <div className="wc-nav-left">
                  <svg width="27" height="52" viewBox="0 0 27 52" fill="none">
                    <path d="M25 2L3 26l22 24" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {settings.unreadCount > 0 && (
                    <span className="wc-nav-badge">{settings.unreadCount}</span>
                  )}
                </div>
                <div className="wc-nav-center">
                  <span>{settings.contactName || '对方'}</span>
                </div>
                <div className="wc-nav-right">
                  <div className="wc-nav-dots"><i /><i /><i /></div>
                </div>
              </div>
            </div>

            {/* Chat body */}
            <div className="wc-chat-body" ref={bodyRef}>
              <div className="wc-chat-content">
                {messages.map((msg) => {
                  if (msg.type === 'time') {
                    return <TimeNotice key={msg.id} content={msg.content} />;
                  }
                  const userIndex = users.findIndex(u => u.id === msg.senderId);
                  const user = users[userIndex] || users[0];
                  const isSelf = msg.senderId === selfId;
                  return (
                    <ChatBubble
                      key={msg.id}
                      msg={msg}
                      user={user}
                      userIndex={userIndex >= 0 ? userIndex : 0}
                      isSelf={isSelf}
                      isGroup={isGroup}
                      selfColor={settings.selfBubbleColor}
                      otherColor={settings.otherBubbleColor}
                      onUpdateMessage={onUpdateMessage}
                    />
                  );
                })}
              </div>
            </div>

            {/* Bottom bar */}
            <div className="wc-bottom">
              <div className="wc-bottom-chat">
                <div className="wc-bottom-inner">
                  {/* 语音按钮 */}
                  <div className="wc-bottom-icon">
                    <img src={`${import.meta.env.BASE_URL}wechat-bottom-icon1.png`} alt="语音" />
                  </div>
                  {/* 输入框 */}
                  <div className="wc-input-box">
                    <svg className="wc-input-mic" viewBox="0 0 48 48" fill="none" stroke="#999" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 20v9a5 5 0 0 0 10 0v-9a5 5 0 0 0-10 0z" />
                      <path d="M14 28c0 5.5 4.5 10 10 10s10-4.5 10-10" />
                      <line x1="24" y1="38" x2="24" y2="42" />
                    </svg>
                  </div>
                  {/* 表情按钮 */}
                  <div className="wc-bottom-icon">
                    <img src={`${import.meta.env.BASE_URL}wechat-bottom-icon2.png`} alt="表情" />
                  </div>
                  {/* 加号按钮 */}
                  <div className="wc-bottom-icon">
                    <img src={`${import.meta.env.BASE_URL}wechat-bottom-icon3.png`} alt="加号" />
                  </div>
                </div>
              </div>
              <div className="wc-home-indicator"><i /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

function SignalIcon({ bars }: { bars: number }) {
  return (
    <svg width="54" height="36" viewBox="0 0 54 36">
      <rect x="0" y="27" width="9" height="9" rx="1.5" fill={bars >= 1 ? '#000' : '#ccc'} />
      <rect x="13" y="20" width="9" height="16" rx="1.5" fill={bars >= 2 ? '#000' : '#ccc'} />
      <rect x="26" y="12" width="9" height="24" rx="1.5" fill={bars >= 3 ? '#000' : '#ccc'} />
      <rect x="39" y="3" width="9" height="33" rx="1.5" fill={bars >= 4 ? '#000' : '#ccc'} />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="48" height="36" viewBox="0 0 24 18" fill="#000">
      <path d="M12 2C7.8 2 4 3.7 1.2 6.5l1.5 1.5C5 5.8 8.3 4.5 12 4.5s7 1.3 9.3 3.5l1.5-1.5C19.9 3.7 16.2 2 12 2z" />
      <path d="M12 7C9.1 7 6.5 8.1 4.6 10l1.5 1.5C7.8 9.8 9.8 9 12 9s4.2.8 5.9 2.5L19.4 10C17.5 8.1 14.9 7 12 7z" />
      <path d="M12 12c-1.7 0-3.2.7-4.3 1.8l1.5 1.5c.7-.8 1.7-1.3 2.8-1.3s2.1.5 2.8 1.3l1.5-1.5C15.2 12.7 13.7 12 12 12z" />
      <circle cx="12" cy="17" r="1.5" />
    </svg>
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
        const barCount = Math.min(Math.max(3, Math.floor(dur / 1.5)), 8);
        const bars = Array.from({ length: barCount }, (_, i) => {
          const h = 12 + Math.round((i / barCount) * 30);
          return <span key={i} style={{ height: `${h}px` }} />;
        });
        return (
          <div className="wc-bubble wc-bubble-voice" style={{ background: bubbleColor, width: `${w}px`, flexDirection: isSelf ? 'row-reverse' : 'row' }}>
            <span className="wc-arrow" style={{ background: bubbleColor }} />
            {isSelf ? (
              <><span className="wc-voice-dur">{dur}"</span><div className="wc-voice-bars">{bars}</div></>
            ) : (
              <><div className="wc-voice-bars">{bars}</div><span className="wc-voice-dur">{dur}"</span></>
            )}
          </div>
        );
      }
      case 'redpacket':
        return (
          <div className="wc-bubble wc-bubble-redpacket">
            <span className="wc-arrow" style={{ background: '#f79c46' }} />
            <div className="wc-rp-content">
              <div className="wc-rp-icon">🧧</div>
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
              <div className="wc-rp-icon">💰</div>
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
          <div className="wc-phone" ref={phoneRef}>
            {/* Status bar */}
            <div className="wc-phone-top">
              <div className="wc-status-bar">
                <div className="wc-time">{settings.time}</div>
                <div className="wc-signal-group">
                  <SignalIcon bars={settings.signal} />
                  <WifiIcon />
                </div>
                <div className="wc-battery-wrap">
                  <div className="wc-battery-outer">
                    <div className="wc-battery-inner" style={{ width: `${settings.battery}%` }} />
                  </div>
                  <div className="wc-battery-tip" />
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

import { useRef, useState } from 'react';
import { ImagePlus, Settings, Trash2 } from 'lucide-react';
import type { PhoneSettings } from '@/types';

interface SettingsPanelProps {
  settings: PhoneSettings;
  onSettingsChange: (settings: PhoneSettings) => void;
}

export function SettingsPanel({ settings, onSettingsChange }: SettingsPanelProps) {
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [backgroundError, setBackgroundError] = useState('');

  const update = (patch: Partial<PhoneSettings>) => {
    onSettingsChange({ ...settings, ...patch });
  };

  const handleBackgroundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setBackgroundError('请选择图片文件');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setBackgroundError('背景图片不能超过 8MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBackgroundError('');
      update({ backgroundImage: String(reader.result) });
    };
    reader.onerror = () => setBackgroundError('图片读取失败，请重新选择');
    reader.readAsDataURL(file);
  };

  return (
    <div className="s-card">
      <div className="s-card-header">
        <h2><Settings size={20} /> 外观设置</h2>
      </div>
      <div className="s-card-body">
        <div className="form-grid">
          <div className="form-item">
            <label className="form-label">系统样式</label>
            <select className="form-input" value={settings.platform} onChange={(e) => update({ platform: e.target.value as PhoneSettings['platform'] })}>
              <option value="ios">iOS</option>
              <option value="android">Android（Google）</option>
            </select>
          </div>
          <div className="form-item">
            <label className="form-label">手机时间</label>
            <input type="time" className="form-input" value={settings.time} onChange={(e) => update({ time: e.target.value })} />
          </div>
          <div className="form-item">
            <label className="form-label">聊天标题</label>
            <input type="text" className="form-input" value={settings.contactName} onChange={(e) => update({ contactName: e.target.value })} />
          </div>
          <div className="form-item">
            <label className="form-label">主卡信号</label>
            <select className="form-input" value={settings.signal} onChange={(e) => update({ signal: parseInt(e.target.value) })}>
              <option value={1}>1格</option>
              <option value={2}>2格</option>
              <option value={3}>3格</option>
              <option value={4}>4格</option>
            </select>
          </div>
          <div className="form-item">
            <label className="form-label">SIM 卡</label>
            <select className="form-input" value={settings.simMode} onChange={(e) => update({ simMode: e.target.value as PhoneSettings['simMode'] })}>
              <option value="single">单卡</option>
              <option value="dual">双卡</option>
            </select>
          </div>
          {settings.simMode === 'dual' && (
            <div className="form-item">
              <label className="form-label">副卡信号</label>
              <select className="form-input" value={settings.secondarySignal} onChange={(e) => update({ secondarySignal: parseInt(e.target.value) })}>
                <option value={1}>1格</option>
                <option value={2}>2格</option>
                <option value={3}>3格</option>
                <option value={4}>4格</option>
              </select>
            </div>
          )}
          <div className="form-item">
            <label className="form-label">Wi-Fi</label>
            <select className="form-input" value={settings.wifiEnabled ? 'on' : 'off'} onChange={(e) => update({ wifiEnabled: e.target.value === 'on' })}>
              <option value="on">开启</option>
              <option value="off">关闭</option>
            </select>
          </div>
          <div className="form-item">
            <label className="form-label">未读消息</label>
            <input type="number" className="form-input" min={0} max={99} value={settings.unreadCount} onChange={(e) => update({ unreadCount: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="form-item">
            <label className="form-label">电量 {settings.battery}%</label>
            <input type="range" className="form-range" min={0} max={100} value={settings.battery} onChange={(e) => update({ battery: parseInt(e.target.value) })} />
          </div>
          <div className="form-item">
            <label className="form-label">自己气泡色</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" className="form-color" value={settings.selfBubbleColor} onChange={(e) => update({ selfBubbleColor: e.target.value })} />
              <span style={{ fontSize: 13, color: '#6b7280' }}>{settings.selfBubbleColor}</span>
            </div>
          </div>
          <div className="form-item">
            <label className="form-label">他人气泡色</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" className="form-color" value={settings.otherBubbleColor} onChange={(e) => update({ otherBubbleColor: e.target.value })} />
              <span style={{ fontSize: 13, color: '#6b7280' }}>{settings.otherBubbleColor}</span>
            </div>
          </div>
          <div className="form-item form-item-wide">
            <label className="form-label">聊天背景</label>
            <div className="chat-background-control">
              <div className="chat-background-color">
                <input
                  type="color"
                  className="form-color"
                  value={settings.backgroundColor || '#ededed'}
                  aria-label="聊天背景颜色"
                  onChange={(event) => update({ backgroundColor: event.target.value })}
                />
                <span>{settings.backgroundColor || '#ededed'}</span>
              </div>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => backgroundInputRef.current?.click()}>
                <ImagePlus size={15} /> {settings.backgroundImage ? '更换背景图' : '上传背景图'}
              </button>
              {settings.backgroundImage && (
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => update({ backgroundImage: null })}>
                  <Trash2 size={15} /> 移除图片
                </button>
              )}
              <input ref={backgroundInputRef} type="file" accept="image/*" hidden onChange={handleBackgroundUpload} />
              {settings.backgroundImage && <img className="chat-background-thumb" src={settings.backgroundImage} alt="当前聊天背景预览" />}
            </div>
            <small className="form-help">背景仅保存在当前浏览器，截图和长截图都会保留；分享链接不会携带本地图片。</small>
            {backgroundError && <small className="form-error" role="alert">{backgroundError}</small>}
          </div>
        </div>
      </div>
    </div>
  );
}

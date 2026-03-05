import { Settings } from 'lucide-react';
import type { PhoneSettings } from '@/types';

interface SettingsPanelProps {
  settings: PhoneSettings;
  onSettingsChange: (settings: PhoneSettings) => void;
}

export function SettingsPanel({ settings, onSettingsChange }: SettingsPanelProps) {
  const update = (patch: Partial<PhoneSettings>) => {
    onSettingsChange({ ...settings, ...patch });
  };

  return (
    <div className="s-card">
      <div className="s-card-header">
        <h2><Settings size={20} /> 外观设置</h2>
      </div>
      <div className="s-card-body">
        <div className="form-grid">
          <div className="form-item">
            <label className="form-label">手机时间</label>
            <input type="time" className="form-input" value={settings.time} onChange={(e) => update({ time: e.target.value })} />
          </div>
          <div className="form-item">
            <label className="form-label">聊天标题</label>
            <input type="text" className="form-input" value={settings.contactName} onChange={(e) => update({ contactName: e.target.value })} />
          </div>
          <div className="form-item">
            <label className="form-label">信号格数</label>
            <select className="form-input" value={settings.signal} onChange={(e) => update({ signal: parseInt(e.target.value) })}>
              <option value={1}>1格</option>
              <option value={2}>2格</option>
              <option value={3}>3格</option>
              <option value={4}>4格</option>
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
        </div>
      </div>
    </div>
  );
}

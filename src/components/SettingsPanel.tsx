import { useId, useRef, useState } from 'react';
import { ImagePlus, Settings, Trash2 } from 'lucide-react';
import type { PhoneSettings } from '@/types';
import { Input } from './ui/input';
import { SelectField } from './ui/select';
import { Slider, Switch } from './ui/controls';
import { ColorField, TimeField } from './ui/color-field';
import { Button } from './ui/button';

interface SettingsPanelProps {
  settings: PhoneSettings;
  onSettingsChange: (settings: PhoneSettings) => void;
  disabled?: boolean;
}

export function SettingsPanel({ settings, onSettingsChange, disabled = false }: SettingsPanelProps) {
  const fieldId = useId();
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [backgroundError, setBackgroundError] = useState('');

  const update = (patch: Partial<PhoneSettings>) => {
    if (disabled) return;
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
            <label className="form-label" htmlFor={`${fieldId}-platform`}>系统样式</label>
            <SelectField id={`${fieldId}-platform`} disabled={disabled} value={settings.platform} onValueChange={platform => update({ platform: platform as PhoneSettings['platform'] })} options={[{ value: 'ios', label: 'iOS' }, { value: 'android', label: 'Android（Google）' }]} />
          </div>
          <div className="form-item">
            <label className="form-label" htmlFor={`${fieldId}-time`}>手机时间</label>
            <TimeField id={`${fieldId}-time`} disabled={disabled} aria-label="手机时间" value={settings.time} onValueChange={time => update({ time })} />
          </div>
          <div className="form-item">
            <label className="form-label" htmlFor={`${fieldId}-title`}>聊天标题</label>
            <Input id={`${fieldId}-title`} disabled={disabled} value={settings.contactName} onChange={(e) => update({ contactName: e.target.value })} />
          </div>
          <div className="form-item">
            <label className="form-label" htmlFor={`${fieldId}-signal`}>主卡信号</label>
            <SelectField id={`${fieldId}-signal`} disabled={disabled} value={String(settings.signal)} onValueChange={signal => update({ signal: Number(signal) })} options={[1, 2, 3, 4].map(signal => ({ value: String(signal), label: `${signal} 格` }))} />
          </div>
          <div className="form-item">
            <label className="form-label" htmlFor={`${fieldId}-sim`}>SIM 卡</label>
            <SelectField id={`${fieldId}-sim`} disabled={disabled} value={settings.simMode} onValueChange={simMode => update({ simMode: simMode as PhoneSettings['simMode'] })} options={[{ value: 'single', label: '单卡' }, { value: 'dual', label: '双卡' }]} />
          </div>
          {settings.simMode === 'dual' && (
            <div className="form-item">
              <label className="form-label" htmlFor={`${fieldId}-secondary`}>副卡信号</label>
              <SelectField id={`${fieldId}-secondary`} disabled={disabled} value={String(settings.secondarySignal)} onValueChange={secondarySignal => update({ secondarySignal: Number(secondarySignal) })} options={[1, 2, 3, 4].map(signal => ({ value: String(signal), label: `${signal} 格` }))} />
            </div>
          )}
          <div className="form-item">
            <label className="form-label" htmlFor={`${fieldId}-wifi`}>Wi-Fi</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minHeight: 38 }}>
              <Switch id={`${fieldId}-wifi`} disabled={disabled} aria-label="Wi-Fi" checked={settings.wifiEnabled} onCheckedChange={wifiEnabled => update({ wifiEnabled })} />
              <span style={{ fontSize: 13, color: '#53675b' }}>{settings.wifiEnabled ? '已开启' : '已关闭'}</span>
            </div>
          </div>
          <div className="form-item">
            <label className="form-label" htmlFor={`${fieldId}-unread`}>未读消息</label>
            <Input id={`${fieldId}-unread`} disabled={disabled} type="number" min={0} max={99} value={settings.unreadCount} onChange={(e) => update({ unreadCount: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="form-item">
            <label className="form-label" htmlFor={`${fieldId}-battery`}>电量 {settings.battery}%</label>
            <Slider id={`${fieldId}-battery`} disabled={disabled} aria-label="电量" min={0} max={100} value={settings.battery} onValueChange={battery => update({ battery })} />
          </div>
          <div className="form-item">
            <label className="form-label" htmlFor={`${fieldId}-self-color`}>自己气泡色</label>
            <ColorField id={`${fieldId}-self-color`} disabled={disabled} aria-label="自己气泡色" value={settings.selfBubbleColor} onValueChange={selfBubbleColor => update({ selfBubbleColor })} />
          </div>
          <div className="form-item">
            <label className="form-label" htmlFor={`${fieldId}-other-color`}>他人气泡色</label>
            <ColorField id={`${fieldId}-other-color`} disabled={disabled} aria-label="他人气泡色" value={settings.otherBubbleColor} onValueChange={otherBubbleColor => update({ otherBubbleColor })} />
          </div>
          <div className="form-item form-item-wide">
            <label className="form-label">聊天背景</label>
            <div className="chat-background-control">
              <div className="chat-background-color">
                <ColorField
                  disabled={disabled}
                  value={settings.backgroundColor || '#ededed'}
                  aria-label="聊天背景颜色"
                  onValueChange={backgroundColor => update({ backgroundColor })}
                />
              </div>
              <Button variant="outline" size="sm" disabled={disabled} className="btn btn-outline btn-sm" type="button" onClick={() => backgroundInputRef.current?.click()}>
                <ImagePlus size={15} /> {settings.backgroundImage ? '更换背景图' : '上传背景图'}
              </Button>
              {settings.backgroundImage && (
                <Button variant="ghost" size="sm" disabled={disabled} className="btn btn-ghost btn-sm" type="button" onClick={() => update({ backgroundImage: null })}>
                  <Trash2 size={15} /> 移除图片
                </Button>
              )}
              <input ref={backgroundInputRef} disabled={disabled} type="file" accept="image/*" hidden onChange={handleBackgroundUpload} />
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

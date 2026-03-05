import { useState, useRef } from 'react';
import { PlusCircle, Type, Image, Gift, Banknote, Mic, Clock } from 'lucide-react';
import type { ChatUser, ChatMessage, MessageType } from '@/types';

interface MessageEditorProps {
  users: ChatUser[];
  selfId: number | null;
  onAddMessage: (msg: Omit<ChatMessage, 'id'>) => void;
}

const MSG_TYPES: { type: MessageType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: '文字', icon: <Type size={14} /> },
  { type: 'image', label: '图片', icon: <Image size={14} /> },
  { type: 'redpacket', label: '红包', icon: <Gift size={14} /> },
  { type: 'transfer', label: '转账', icon: <Banknote size={14} /> },
  { type: 'voice', label: '语音', icon: <Mic size={14} /> },
  { type: 'time', label: '时间', icon: <Clock size={14} /> },
];

export function MessageEditor({ users, selfId, onAddMessage }: MessageEditorProps) {
  const [msgType, setMsgType] = useState<MessageType>('text');
  const [senderId, setSenderId] = useState<number | ''>(selfId ?? '');
  const [textContent, setTextContent] = useState('');
  const [remark, setRemark] = useState('');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('3');
  const [timeContent, setTimeContent] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAdd = () => {
    if (msgType === 'time') {
      if (!timeContent.trim()) return;
      onAddMessage({ type: 'time', senderId: selfId ?? 1, content: timeContent.trim(), params: {} });
      setTimeContent('');
      return;
    }

    if (!senderId) return;

    switch (msgType) {
      case 'text':
        if (!textContent.trim()) return;
        onAddMessage({ type: 'text', senderId: senderId as number, content: textContent.trim(), params: {} });
        setTextContent('');
        break;
      case 'image':
        onAddMessage({
          type: 'image',
          senderId: senderId as number,
          content: imagePreview || '',
          params: {},
        });
        setImagePreview(null);
        break;
      case 'redpacket':
        onAddMessage({
          type: 'redpacket',
          senderId: senderId as number,
          content: '',
          params: { remark: remark || '恭喜发财，大吉大利' },
        });
        setRemark('');
        break;
      case 'transfer':
        onAddMessage({
          type: 'transfer',
          senderId: senderId as number,
          content: '',
          params: { amount: amount || '0', remark: remark || '转账' },
        });
        setAmount('');
        setRemark('');
        break;
      case 'voice':
        onAddMessage({
          type: 'voice',
          senderId: senderId as number,
          content: '',
          params: { duration: parseInt(duration || '3', 10) },
        });
        setDuration('3');
        break;
    }
  };

  const renderFields = () => {
    if (msgType === 'time') {
      return (
        <input
          className="me-input"
          type="text"
          placeholder="如：3月15日 下午14:00"
          value={timeContent}
          onChange={e => setTimeContent(e.target.value)}
        />
      );
    }

    return (
      <>
        <select
          className="me-select"
          value={senderId}
          onChange={e => setSenderId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">选择发送人</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>
              {u.name}{u.id === selfId ? '（自己）' : ''}
            </option>
          ))}
        </select>

        {msgType === 'text' && (
          <textarea
            className="me-textarea"
            placeholder="输入消息内容..."
            value={textContent}
            onChange={e => setTextContent(e.target.value)}
            rows={2}
          />
        )}

        {msgType === 'image' && (
          <div className="me-img-area">
            {imagePreview ? (
              <div className="me-img-preview">
                <img src={imagePreview} alt="" />
                <button className="me-img-remove" onClick={() => setImagePreview(null)}>✕</button>
              </div>
            ) : (
              <button className="me-img-upload" onClick={() => imgRef.current?.click()}>
                <Image size={20} />
                <span>选择图片</span>
              </button>
            )}
            <input ref={imgRef} type="file" accept="image/*" hidden onChange={handleImageChange} />
          </div>
        )}

        {msgType === 'redpacket' && (
          <input
            className="me-input"
            type="text"
            placeholder="红包备注（默认：恭喜发财，大吉大利）"
            value={remark}
            onChange={e => setRemark(e.target.value)}
          />
        )}

        {msgType === 'transfer' && (
          <div className="me-row">
            <input
              className="me-input"
              type="text"
              placeholder="金额"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              className="me-input"
              type="text"
              placeholder="备注（默认：转账）"
              value={remark}
              onChange={e => setRemark(e.target.value)}
              style={{ flex: 2 }}
            />
          </div>
        )}

        {msgType === 'voice' && (
          <div className="me-row">
            <input
              className="me-input"
              type="number"
              min={1}
              max={60}
              placeholder="语音秒数"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              style={{ width: 100 }}
            />
            <span className="me-hint">秒</span>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="s-card">
      <div className="s-card-header">
        <h2><PlusCircle size={20} /> 添加消息</h2>
      </div>
      <div className="s-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="me-type-tabs">
          {MSG_TYPES.map(t => (
            <button
              key={t.type}
              className={`me-type-tab ${msgType === t.type ? 'active' : ''}`}
              onClick={() => setMsgType(t.type)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {renderFields()}

        <button className="btn btn-primary btn-sm" onClick={handleAdd}>
          <PlusCircle size={15} /> 添加
        </button>
      </div>
    </div>
  );
}

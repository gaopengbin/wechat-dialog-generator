import { Disclosure } from './ui/controls';
import { useState, useRef } from 'react';
import { PlusCircle, Type, Image, Gift, Banknote, Mic, Clock, X } from 'lucide-react';
import type { ChatUser, ChatMessage, MessageType } from '@/types';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { SelectField } from './ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/controls';
import { Button } from './ui/button';

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
  const [voiceTranscript, setVoiceTranscript] = useState('');
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
          params: {
            duration: parseInt(duration || '3', 10),
            transcript: voiceTranscript.trim() || undefined,
          },
        });
        setDuration('3');
        setVoiceTranscript('');
        break;
    }
  };

  const renderFields = () => {
    if (msgType === 'time') {
      return (
        <Input
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
        <SelectField
          aria-label="发送人"
          value={String(senderId)}
          onValueChange={value => setSenderId(value ? Number(value) : '')}
          placeholder="选择发送人"
          options={[{ value: '', label: '选择发送人' }, ...users.map(user => ({ value: String(user.id), label: `${user.name}${user.id === selfId ? '（自己）' : ''}` }))]}
        />

        {msgType === 'text' && (
          <Textarea
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
                <Button variant="destructive" size="icon" type="button" className="me-img-remove" style={{ width: 20, height: 20, padding: 0 }} aria-label="移除消息图片" onClick={() => setImagePreview(null)}><X size={14} /></Button>
              </div>
            ) : (
              <Button variant="outline" className="me-img-upload" style={{ width: 100, height: 80 }} onClick={() => imgRef.current?.click()}>
                <Image size={20} />
                <span>选择图片</span>
              </Button>
            )}
            <input ref={imgRef} type="file" accept="image/*" hidden onChange={handleImageChange} />
          </div>
        )}

        {msgType === 'redpacket' && (
          <Input
            className="me-input"
            type="text"
            placeholder="红包备注（默认：恭喜发财，大吉大利）"
            value={remark}
            onChange={e => setRemark(e.target.value)}
          />
        )}

        {msgType === 'transfer' && (
          <div className="me-row">
            <Input
              className="me-input"
              type="text"
              placeholder="金额"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ flex: 1 }}
            />
            <Input
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
            <Input
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
            <Textarea
              className="me-textarea"
              placeholder="转文字内容（可选）"
              value={voiceTranscript}
              onChange={e => setVoiceTranscript(e.target.value)}
              rows={2}
              style={{ flex: 1 }}
            />
          </div>
        )}
      </>
    );
  };

  return (
    <div className="s-card message-editor-card">
      <Disclosure title={<span className="message-editor-heading"><PlusCircle size={17} /> 添加消息</span>}>
      <div className="s-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Tabs value={msgType} onValueChange={value => setMsgType(value as MessageType)}>
        <TabsList className="me-type-tabs" aria-label="消息类型">
          {MSG_TYPES.map(t => (
            <TabsTrigger
              key={t.type}
              value={t.type}
              className={`me-type-tab ${msgType === t.type ? 'active' : ''}`}
            >
              {t.icon} {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {MSG_TYPES.map(type => <TabsContent key={type.type} value={type.type} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{msgType === type.type && renderFields()}</TabsContent>)}
        </Tabs>

        <Button size="sm" className="btn btn-primary btn-sm" onClick={handleAdd}>
          <PlusCircle size={15} /> 添加
        </Button>
      </div>
      </Disclosure>
    </div>
  );
}

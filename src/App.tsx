import { useState, useRef, useCallback } from 'react';
import { toCanvas } from 'html-to-image';
import { Download, Copy, Image as ImageIcon, MessageSquare } from 'lucide-react';
import { ImportPanel } from '@/components/ImportPanel';
import { UserAvatarManager } from '@/components/UserAvatarManager';
import { SettingsPanel } from '@/components/SettingsPanel';
import { PhonePreview } from '@/components/PhonePreview';
import { parseChatRecord } from '@/lib/parser';
import type { ChatUser, ChatMessage, PhoneSettings } from '@/types';

function App() {
  const [importText, setImportText] = useState('');
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<PhoneSettings>({
    time: '12:02',
    signal: 4,
    battery: 60,
    contactName: '',
    unreadCount: 1,
    selfBubbleColor: '#95ec69',
    otherBubbleColor: '#ffffff',
  });
  const [selfId, setSelfId] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  }, []);

  const handleImport = useCallback(() => {
    if (!importText.trim()) {
      showToast('请先输入聊天记录文本');
      return;
    }
    const result = parseChatRecord(importText);
    if (result.messages.length === 0) {
      showToast('未解析到任何消息');
      return;
    }
    setUsers(result.users);
    setMessages(result.messages);
    setSelfId(result.users[0]?.id ?? null);
    if (result.users.length >= 3) {
      const otherNames = result.users.slice(1).map(u => u.name);
      const nameStr = result.users.length <= 4
        ? otherNames.join('、')
        : otherNames.slice(0, 2).join('、') + '等';
      setSettings(s => ({ ...s, contactName: nameStr + '(' + result.users.length + ')' }));
    } else if (result.users.length === 2) {
      setSettings(s => ({ ...s, contactName: result.users[1].name }));
    } else if (result.users.length === 1) {
      setSettings(s => ({ ...s, contactName: result.users[0].name }));
    }
    showToast(`成功导入 ${result.messages.length} 条消息（${result.users.length} 个用户）`);
  }, [importText, showToast]);

  const handleUpdateAvatar = useCallback((userId: number, avatar: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, avatar } : u));
  }, []);

  const handleRemoveAvatar = useCallback((userId: number) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, avatar: null } : u));
  }, []);

  const handleUpdateMessage = useCallback((msgId: number, content: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content } : m));
  }, []);

  // 用 html-to-image 截图（基于浏览器自身渲染，无文字偏移问题）
  const capturePhone = useCallback(async (longshot = false): Promise<HTMLCanvasElement | null> => {
    const phone = phoneRef.current;
    if (!phone) return null;
    const content = phone.closest('.wc-phone-content') as HTMLElement | null;
    const wrap = phone.closest('.wc-phone-wrap') as HTMLElement | null;
    const scaleWrap = phone.closest('.wc-phone-scale-wrap') as HTMLElement | null;
    if (!content || !wrap) return null;

    // 保存原始样式
    const saved = {
      ct: content.style.transform, co: content.style.transformOrigin,
      ww: wrap.style.width, wh: wrap.style.height, wo: wrap.style.overflow,
      wr: wrap.style.borderRadius, ws: wrap.style.boxShadow,
      sp: scaleWrap?.style.position ?? '', st: scaleWrap?.style.top ?? '',
      sl: scaleWrap?.style.left ?? '', sw: scaleWrap?.style.width ?? '',
      sh: scaleWrap?.style.height ?? '',
    };

    // 记录当前聊天区滚动位置
    const chatBody = phone.querySelector('.wc-chat-body') as HTMLElement | null;
    const chatContent = phone.querySelector('.wc-chat-content') as HTMLElement | null;
    const scrollTop = chatBody?.scrollTop ?? 0;
    const savedContentMargin = chatContent?.style.marginTop ?? '';

    // 移除缩放，展开至原始尺寸
    content.style.transform = 'none';
    wrap.style.width = '1125px';
    wrap.style.height = '2436px';
    wrap.style.overflow = 'hidden';
    wrap.style.borderRadius = '0';
    wrap.style.boxShadow = 'none';
    if (scaleWrap) {
      scaleWrap.style.position = 'fixed';
      scaleWrap.style.top = '0';
      scaleWrap.style.left = '-9999px';
      scaleWrap.style.width = '1125px';
      scaleWrap.style.height = '2436px';
    }

    // 普通截图：用 margin-top 偏移模拟当前滚动位置（html-to-image 克隆会丢失 scrollTop）
    if (!longshot && chatContent && scrollTop > 0) {
      chatContent.style.marginTop = `-${scrollTop}px`;
    }

    // 长截图：释放 chat body 滚动
    let longOrig: Record<string, string> | null = null;
    if (longshot) {
      const bottom = phone.querySelector('.wc-bottom') as HTMLElement;
      if (chatBody && bottom) {
        longOrig = {
          ph: phone.style.height, po: phone.style.overflow,
          bp: chatBody.style.position, bt: chatBody.style.top, bb: chatBody.style.bottom,
          bo: chatBody.style.overflowY, bh: chatBody.style.height,
          dp: bottom.style.position, db: bottom.style.bottom,
        };
        phone.style.height = 'auto'; phone.style.overflow = 'visible';
        wrap.style.height = 'auto';
        chatBody.style.position = 'relative'; chatBody.style.top = 'auto';
        chatBody.style.bottom = 'auto'; chatBody.style.overflowY = 'visible';
        chatBody.style.height = 'auto';
        bottom.style.position = 'relative'; bottom.style.bottom = 'auto';
      }
    }

    // 等待浏览器重新布局
    await new Promise(r => setTimeout(r, 50));
    const totalH = longshot ? phone.scrollHeight : 2436;

    let canvas: HTMLCanvasElement | null = null;
    try {
      canvas = await toCanvas(phone, {
        width: 1125,
        height: totalH,
        pixelRatio: 1,
        backgroundColor: '#ededed',
      });
    } finally {
      // 还原所有样式
      content.style.transform = saved.ct; content.style.transformOrigin = saved.co;
      wrap.style.width = saved.ww; wrap.style.height = saved.wh;
      wrap.style.overflow = saved.wo; wrap.style.borderRadius = saved.wr;
      wrap.style.boxShadow = saved.ws;
      if (scaleWrap) {
        scaleWrap.style.position = saved.sp; scaleWrap.style.top = saved.st;
        scaleWrap.style.left = saved.sl; scaleWrap.style.width = saved.sw;
        scaleWrap.style.height = saved.sh;
      }
      // 还原滚动偏移
      if (chatContent) chatContent.style.marginTop = savedContentMargin;
      // 还原聊天区滚动位置
      if (chatBody && scrollTop > 0) {
        requestAnimationFrame(() => { chatBody.scrollTop = scrollTop; });
      }
      if (longshot && longOrig) {
        const chatBody = phone.querySelector('.wc-chat-body') as HTMLElement;
        const bottom = phone.querySelector('.wc-bottom') as HTMLElement;
        if (chatBody && bottom) {
          phone.style.height = longOrig.ph; phone.style.overflow = longOrig.po;
          chatBody.style.position = longOrig.bp; chatBody.style.top = longOrig.bt;
          chatBody.style.bottom = longOrig.bb; chatBody.style.overflowY = longOrig.bo;
          chatBody.style.height = longOrig.bh;
          bottom.style.position = longOrig.dp; bottom.style.bottom = longOrig.db;
        }
      }
    }
    return canvas;
  }, []);

  const handleGenerateImage = useCallback(async () => {
    if (!phoneRef.current) return;
    showToast('正在生成图片...');
    try {
      const canvas = await capturePhone(false);
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = '微信聊天记录_' + Date.now() + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('图片已生成并下载！');
    } catch (e: unknown) {
      showToast('生成失败：' + (e instanceof Error ? e.message : String(e)));
    }
  }, [showToast, capturePhone]);

  const handleCopyImage = useCallback(async () => {
    if (!phoneRef.current) return;
    showToast('正在生成图片...');
    try {
      const canvas = await capturePhone(false);
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          showToast('图片已复制到剪贴板！');
        } catch {
          showToast('复制失败，请使用下载功能');
        }
      });
    } catch {
      showToast('操作失败');
    }
  }, [showToast, capturePhone]);

  const handleGenerateLongImage = useCallback(async () => {
    if (!phoneRef.current) return;
    showToast('正在生成长截图...');
    try {
      const canvas = await capturePhone(true);
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = '微信聊天记录_长截图_' + Date.now() + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('长截图已生成并下载！');
    } catch (e: unknown) {
      showToast('生成失败：' + (e instanceof Error ? e.message : String(e)));
    }
  }, [showToast, capturePhone]);

  const hasMessages = messages.length > 0;

  return (
    <>
      <header className="app-header">
        <h1>
          <MessageSquare size={22} />
          微信对话生成器
        </h1>
        {hasMessages && (
          <div className="app-header-actions">
            <button className="btn btn-white btn-sm" onClick={handleGenerateImage}>
              <Download size={15} /> 生成图片
            </button>
            <button className="btn btn-white btn-sm" onClick={handleCopyImage}>
              <Copy size={15} /> 复制
            </button>
            <button className="btn btn-white btn-sm" onClick={handleGenerateLongImage}>
              <ImageIcon size={15} /> 长截图
            </button>
          </div>
        )}
      </header>

      <main className="app-main">
        <div className="app-left">
          <ImportPanel text={importText} onTextChange={setImportText} onImport={handleImport} />
          {users.length > 0 && (
            <UserAvatarManager users={users} selfId={selfId} onUpdateAvatar={handleUpdateAvatar} onRemoveAvatar={handleRemoveAvatar} onSetSelf={setSelfId} />
          )}
          {hasMessages && (
            <SettingsPanel settings={settings} onSettingsChange={setSettings} />
          )}
        </div>
        {hasMessages && (
          <PhonePreview users={users} messages={messages} settings={settings} selfId={selfId} phoneRef={phoneRef} onUpdateMessage={handleUpdateMessage} />
        )}
      </main>

      {toast && <div className="toast-msg">{toast}</div>}
    </>
  );
}

export default App;

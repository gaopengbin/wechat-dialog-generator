import { useState, useRef, useCallback, useEffect } from 'react';
import { toCanvas } from 'html-to-image';
import { BellRing, CircleDollarSign, Download, Copy, Gift, Image as ImageIcon, MessageSquare, Share2, ShieldCheck, Sparkles, UserRound, UsersRound, Zap } from 'lucide-react';
import { ImportPanel } from '@/components/ImportPanel';
import { UserAvatarManager } from '@/components/UserAvatarManager';
import { MessageEditor } from '@/components/MessageEditor';
import { SettingsPanel } from '@/components/SettingsPanel';
import { PhonePreview } from '@/components/PhonePreview';
import { GrowthContent } from '@/components/GrowthContent';
import { ProjectPanel } from '@/components/ProjectPanel';
import { MomentsEditor } from '@/components/MomentsEditor';
import { WechatSceneEditor } from '@/components/WechatSceneEditor';
import { AccountDialog } from '@/components/AccountDialog';
import {
  OfficialAccountDialog,
  officialAccountId,
  type OfficialAccountPlacement,
} from '@/components/OfficialAccountDialog';
import { parseChatRecord } from '@/lib/parser';
import {
  activeProjectStorageKey,
  copyProject,
  deleteProject,
  listProjects,
  projectHasContent,
  projectName,
  saveProject,
  type ChatProject,
  type ChatProjectSnapshot,
} from '@/lib/project-store';
import {
  messageCountBucket,
  participantCountBucket,
  trackProductEvent,
} from '@/lib/product-analytics';
import {
  AccountApiError,
  consumeAccountExport,
  consumeGuestExport,
  guestQuota,
  loginAccount,
  logoutAccount,
  redeemFollowBonus,
  registerAccount,
  restoreAccount,
  type AccountSession,
} from '@/lib/account-api';
import { createSameTemplateUrl, readSameTemplateHash } from '@/lib/share-link';
import type { ChatUser, ChatMessage, PhoneSettings } from '@/types';

const defaultSettings: PhoneSettings = {
  platform: 'ios',
  time: '12:02',
  signal: 4,
  secondarySignal: 3,
  simMode: 'single',
  wifiEnabled: true,
  battery: 60,
  contactName: '',
  unreadCount: 1,
  selfBubbleColor: '#95ec69',
  otherBubbleColor: '#ffffff',
};

function App() {
  const [officialAccountPrompt, setOfficialAccountPrompt] = useState<OfficialAccountPlacement | null>(null);
  const [accountPrompt, setAccountPrompt] = useState(false);
  const [accountSession, setAccountSession] = useState<AccountSession | null>(null);
  const [visibleQuota, setVisibleQuota] = useState(() => guestQuota());
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [redeemMessage, setRedeemMessage] = useState('');
  const [activeTool, setActiveTool] = useState<'chat' | 'moments' | 'payment' | 'redpacket' | 'profile' | 'group'>(() => {
    try {
      const stored = localStorage.getItem('wechat-dialog-generator:active-tool');
      return ['moments', 'payment', 'redpacket', 'profile', 'group'].includes(stored ?? '')
        ? stored as 'moments' | 'payment' | 'redpacket' | 'profile' | 'group'
        : 'chat';
    } catch {
      return 'chat';
    }
  });
  const [importText, setImportText] = useState('');
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<PhoneSettings>(defaultSettings);
  const [selfId, setSelfId] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [projects, setProjects] = useState<ChatProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectName, setActiveProjectName] = useState('');
  const [activeProjectCreatedAt, setActiveProjectCreatedAt] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dialogTracked = useRef(false);
  const editorRef = useRef<HTMLElement | null>(null);
  const restoredProjectTracked = useRef(false);
  const skipNextSave = useRef(false);

  useEffect(() => {
    void trackProductEvent('page_view');
    void restoreAccount().then(session => {
      if (session) {
        setAccountSession(session);
        setVisibleQuota(session.quota);
      }
    }).catch(() => {
      // The editor remains usable when the account service is temporarily unavailable.
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('wechat-dialog-generator:active-tool', activeTool);
    } catch {
      // Tool switching still works for the current page session.
    }
  }, [activeTool]);

  useEffect(() => {
    let cancelled = false;

    async function restoreWorkspace() {
      if (!('indexedDB' in window)) {
        setStorageAvailable(false);
        setStorageReady(true);
        return;
      }
      try {
        const storedProjects = await listProjects();
        if (cancelled) return;
        setProjects(storedProjects);

        let sharedSnapshot: ChatProjectSnapshot | null = null;
        try {
          sharedSnapshot = await readSameTemplateHash(window.location.hash);
        } catch {
          if (!cancelled) setToast('分享模板已失效或内容格式不正确');
        }
        if (sharedSnapshot) {
          setActiveTool('chat');
          setImportText(sharedSnapshot.importText);
          setUsers(sharedSnapshot.users);
          setMessages(sharedSnapshot.messages);
          setSettings(sharedSnapshot.settings);
          setSelfId(sharedSnapshot.selfId);
          setActiveProjectId(null);
          setActiveProjectName(`${projectName(sharedSnapshot)} 同款`);
          setActiveProjectCreatedAt(null);
          setSaveState('idle');
          dialogTracked.current = sharedSnapshot.messages.length > 0;
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
          void trackProductEvent('shared_template_opened');
          return;
        }

        let storedId: string | null = null;
        try {
          storedId = localStorage.getItem(activeProjectStorageKey);
        } catch {
          storedId = null;
        }
        const active = storedProjects.find(project => project.id === storedId);
        if (active) {
          skipNextSave.current = true;
          setImportText(active.importText);
          setUsers(active.users);
          setMessages(active.messages);
          setSettings(active.settings);
          setSelfId(active.selfId);
          setActiveProjectId(active.id);
          setActiveProjectName(active.name);
          setActiveProjectCreatedAt(active.createdAt);
          setSaveState('saved');
          dialogTracked.current = active.messages.length > 0;
          if (!restoredProjectTracked.current) {
            restoredProjectTracked.current = true;
            void trackProductEvent('project_reopened', {
              message_count_bucket: messageCountBucket(active.messages.length),
            });
          }
        }
      } catch {
        if (!cancelled) {
          setStorageAvailable(false);
          setSaveState('error');
        }
      } finally {
        if (!cancelled) setStorageReady(true);
      }
    }

    void restoreWorkspace();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!storageReady || !storageAvailable) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    const snapshot: ChatProjectSnapshot = { importText, users, messages, settings, selfId };
    if (!projectHasContent(snapshot)) return;

    setSaveState('saving');
    const timer = window.setTimeout(() => {
      const now = new Date().toISOString();
      const isNewProject = activeProjectId === null;
      const id = activeProjectId ?? crypto.randomUUID();
      const name = activeProjectName.trim() || projectName(snapshot);
      const project: ChatProject = {
        ...snapshot,
        id,
        name,
        createdAt: activeProjectCreatedAt ?? now,
        updatedAt: now,
        version: 1,
      };

      void saveProject(project).then(() => {
        if (isNewProject) skipNextSave.current = true;
        setActiveProjectId(id);
        setActiveProjectName(name);
        setActiveProjectCreatedAt(project.createdAt);
        setProjects(current => [project, ...current.filter(item => item.id !== id)]);
        setSaveState('saved');
        try {
          localStorage.setItem(activeProjectStorageKey, id);
        } catch {
          // IndexedDB remains the source of truth when localStorage is unavailable.
        }
        if (isNewProject) {
          void trackProductEvent('project_created', {
            creation_source: messages.length > 0 ? 'editor' : 'import_draft',
          });
        }
      }).catch(() => {
        setStorageAvailable(false);
        setSaveState('error');
      });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    activeProjectCreatedAt,
    activeProjectId,
    activeProjectName,
    importText,
    messages,
    selfId,
    settings,
    storageAvailable,
    storageReady,
    users,
  ]);

  useEffect(() => {
    if (dialogTracked.current || messages.length === 0) return;
    dialogTracked.current = true;
    void trackProductEvent('dialog_created', {
      message_count_bucket: messageCountBucket(messages.length),
      participant_count_bucket: participantCountBucket(users.length),
    });
  }, [messages.length, users.length]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  }, []);

  const openOfficialAccountPrompt = useCallback((placement: OfficialAccountPlacement) => {
    if (placement === 'export') {
      try {
        if (localStorage.getItem('wechat-dialog-generator:official-account-export-prompted')) return;
        localStorage.setItem('wechat-dialog-generator:official-account-export-prompted', '1');
      } catch {
        // The prompt still works when browser storage is unavailable.
      }
    }
    setRedeemMessage('');
    setOfficialAccountPrompt(placement);
    void trackProductEvent('official_account_prompt_viewed', { placement });
  }, []);

  const closeOfficialAccountPrompt = useCallback(() => setOfficialAccountPrompt(null), []);

  const copyOfficialAccountId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(officialAccountId);
      void trackProductEvent('official_account_id_copied', {
        placement: officialAccountPrompt ?? 'header',
      });
      showToast('公众号 ID 已复制，请到微信搜索关注');
    } catch {
      showToast(`请在微信搜索：${officialAccountId}`);
    }
  }, [officialAccountPrompt, showToast]);

  const promptAfterExport = useCallback(() => {
    window.setTimeout(() => openOfficialAccountPrompt('export'), 700);
  }, [openOfficialAccountPrompt]);

  const handleLogin = useCallback(async (email: string, password: string) => {
    setAccountBusy(true);
    setAccountError('');
    try {
      const session = await loginAccount(email, password);
      setAccountSession(session);
      setVisibleQuota(session.quota);
      setAccountPrompt(false);
      showToast('登录成功');
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : '登录失败，请稍后重试');
    } finally {
      setAccountBusy(false);
    }
  }, [showToast]);

  const handleRegister = useCallback(async (email: string, password: string, displayName: string) => {
    setAccountBusy(true);
    setAccountError('');
    try {
      const session = await registerAccount(email, password, displayName);
      setAccountSession(session);
      setVisibleQuota(session.quota);
      setAccountPrompt(false);
      showToast('账户创建成功，已登录');
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : '注册失败，请稍后重试');
    } finally {
      setAccountBusy(false);
    }
  }, [showToast]);

  const handleLogout = useCallback(async () => {
    setAccountBusy(true);
    try {
      await logoutAccount();
      setAccountSession(null);
      setVisibleQuota(guestQuota());
      setAccountPrompt(false);
      showToast('已退出登录');
    } finally {
      setAccountBusy(false);
    }
  }, [showToast]);

  const authorizeExport = useCallback(async () => {
    try {
      const quota = accountSession ? await consumeAccountExport() : consumeGuestExport();
      setVisibleQuota(quota);
      if (accountSession) setAccountSession(current => current ? { ...current, quota } : current);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '暂时无法确认导出额度';
      showToast(message);
      if (error instanceof AccountApiError && error.code === 'quota_exhausted') {
        if (accountSession) openOfficialAccountPrompt('export');
        else {
          setAccountError('今日免费额度已用完，登录后可继续使用并领取关注奖励。');
          setAccountPrompt(true);
        }
      }
      return false;
    }
  }, [accountSession, openOfficialAccountPrompt, showToast]);

  const handleRedeem = useCallback(async (code: string) => {
    setAccountBusy(true);
    setRedeemMessage('');
    try {
      const result = await redeemFollowBonus(code);
      setVisibleQuota(result.quota);
      setAccountSession(current => current ? { ...current, quota: result.quota } : current);
      setRedeemMessage(`领取成功，已增加 ${result.granted} 次导出额度。`);
      showToast(`已领取 ${result.granted} 次额外导出额度`);
    } catch (error) {
      setRedeemMessage(error instanceof Error ? error.message : '兑换失败，请稍后重试');
    } finally {
      setAccountBusy(false);
    }
  }, [showToast]);

  const persistCurrentProject = useCallback(async () => {
    if (!storageAvailable) return;
    const snapshot: ChatProjectSnapshot = { importText, users, messages, settings, selfId };
    if (!projectHasContent(snapshot)) return;
    const now = new Date().toISOString();
    const id = activeProjectId ?? crypto.randomUUID();
    const project: ChatProject = {
      ...snapshot,
      id,
      name: activeProjectName.trim() || projectName(snapshot),
      createdAt: activeProjectCreatedAt ?? now,
      updatedAt: now,
      version: 1,
    };
    await saveProject(project);
    setProjects(current => [project, ...current.filter(item => item.id !== id)]);
    if (!activeProjectId) {
      void trackProductEvent('project_created', {
        creation_source: messages.length > 0 ? 'editor' : 'import_draft',
      });
    }
  }, [
    activeProjectCreatedAt,
    activeProjectId,
    activeProjectName,
    importText,
    messages,
    selfId,
    settings,
    storageAvailable,
    users,
  ]);

  const resetEditor = useCallback(() => {
    skipNextSave.current = true;
    setImportText('');
    setUsers([]);
    setMessages([]);
    setSettings(defaultSettings);
    setSelfId(null);
    setActiveProjectId(null);
    setActiveProjectName('');
    setActiveProjectCreatedAt(null);
    setSaveState('idle');
    dialogTracked.current = false;
    try {
      localStorage.removeItem(activeProjectStorageKey);
    } catch {
      // The editor can still start a new in-memory project.
    }
  }, []);

  const handleCreateProject = useCallback(async () => {
    try {
      await persistCurrentProject();
      resetEditor();
      showToast('已新建空白对话，上一份内容已自动保存');
    } catch {
      showToast('保存当前项目失败，请稍后重试');
    }
  }, [persistCurrentProject, resetEditor, showToast]);

  const handleOpenProject = useCallback(async (project: ChatProject) => {
    if (project.id === activeProjectId) return;
    try {
      await persistCurrentProject();
    } catch {
      showToast('当前项目保存失败，暂未切换');
      return;
    }
    skipNextSave.current = true;
    setImportText(project.importText);
    setUsers(project.users);
    setMessages(project.messages);
    setSettings(project.settings);
    setSelfId(project.selfId);
    setActiveProjectId(project.id);
    setActiveProjectName(project.name);
    setActiveProjectCreatedAt(project.createdAt);
    setSaveState('saved');
    dialogTracked.current = project.messages.length > 0;
    try {
      localStorage.setItem(activeProjectStorageKey, project.id);
    } catch {
      // Project switching still works for the current page session.
    }
    void trackProductEvent('project_reopened', {
      message_count_bucket: messageCountBucket(project.messages.length),
    });
    showToast(`已打开“${project.name}”`);
  }, [activeProjectId, persistCurrentProject, showToast]);

  const handleDuplicateProject = useCallback(async (source: ChatProject) => {
    try {
      const duplicate = copyProject(source);
      await saveProject(duplicate);
      setProjects(current => [duplicate, ...current]);
      void trackProductEvent('project_duplicated');
      showToast(`已复制“${source.name}”`);
    } catch {
      showToast('复制项目失败');
    }
  }, [showToast]);

  const handleDeleteProject = useCallback(async (project: ChatProject) => {
    if (!window.confirm(`确定删除“${project.name}”吗？此操作无法撤销。`)) return;
    try {
      await deleteProject(project.id);
      setProjects(current => current.filter(item => item.id !== project.id));
      if (project.id === activeProjectId) resetEditor();
      showToast('项目已从本机删除');
    } catch {
      showToast('删除项目失败');
    }
  }, [activeProjectId, resetEditor, showToast]);

  const handleUseTemplate = useCallback((content: string) => {
    setImportText(content);
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('模板已载入，点击“解析并导入”即可预览');
  }, [showToast]);

  const handleShare = useCallback(async () => {
    const shareData = {
      title: '微信对话生成器',
      text: '在线制作微信聊天截图与长截图，无需登录即可使用，每日免费导出 10 次，内容仅在浏览器本地处理。',
      url: 'https://chat.laogao.xyz/',
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        showToast('分享面板已打开');
        return;
      }
      await navigator.clipboard.writeText(shareData.url);
      showToast('链接已复制，可以分享给朋友了');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      showToast('分享失败，请稍后再试');
    }
  }, [showToast]);

  const handleShareSame = useCallback(async () => {
    if (!messages.length) {
      showToast('请先创建对话内容');
      return;
    }
    if (!window.confirm('分享链接会包含当前对话文字和样式，不包含已上传的头像与图片。确定生成吗？')) return;
    try {
      const snapshot: ChatProjectSnapshot = { importText, users, messages, settings, selfId };
      const url = await createSameTemplateUrl(snapshot, window.location.href);
      void trackProductEvent('shared_template_created');
      if (navigator.share) {
        await navigator.share({
          title: `${activeProjectName.trim() || settings.contactName || '微信对话'}同款模板`,
          text: '打开链接即可复用这份对话排版，头像和图片需要自行重新上传。',
          url,
        });
        showToast('同款模板分享面板已打开');
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast('同款模板链接已复制');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      showToast(error instanceof Error ? error.message : '生成同款链接失败');
    }
  }, [activeProjectName, importText, messages, selfId, settings, showToast, users]);

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

  const handleAddMessage = useCallback((msg: Omit<ChatMessage, 'id'>) => {
    setMessages(prev => {
      const maxId = prev.reduce((max, m) => Math.max(max, m.id), 0);
      return [...prev, { ...msg, id: maxId + 1 }];
    });
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
      if (!(await authorizeExport())) return;
      const link = document.createElement('a');
      link.download = '微信聊天记录_' + Date.now() + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      void trackProductEvent('image_exported', {
        capture_mode: 'standard',
        message_count_bucket: messageCountBucket(messages.length),
      });
      showToast('图片已生成并下载！');
      promptAfterExport();
    } catch (e: unknown) {
      showToast('生成失败：' + (e instanceof Error ? e.message : String(e)));
    }
  }, [showToast, capturePhone, messages.length, promptAfterExport, authorizeExport]);

  const handleCopyImage = useCallback(async () => {
    if (!phoneRef.current) return;
    showToast('正在生成图片...');
    try {
      const canvas = await capturePhone(false);
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          if (!(await authorizeExport())) return;
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          void trackProductEvent('image_exported', {
            capture_mode: 'clipboard',
            message_count_bucket: messageCountBucket(messages.length),
          });
          showToast('图片已复制到剪贴板！');
          promptAfterExport();
        } catch {
          showToast('复制失败，请使用下载功能');
        }
      });
    } catch {
      showToast('操作失败');
    }
  }, [showToast, capturePhone, messages.length, promptAfterExport, authorizeExport]);

  const handleGenerateLongImage = useCallback(async () => {
    if (!phoneRef.current) return;
    showToast('正在生成长截图...');
    try {
      const canvas = await capturePhone(true);
      if (!canvas) return;
      if (!(await authorizeExport())) return;
      const link = document.createElement('a');
      link.download = '微信聊天记录_长截图_' + Date.now() + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      void trackProductEvent('image_exported', {
        capture_mode: 'long',
        message_count_bucket: messageCountBucket(messages.length),
      });
      showToast('长截图已生成并下载！');
      promptAfterExport();
    } catch (e: unknown) {
      showToast('生成失败：' + (e instanceof Error ? e.message : String(e)));
    }
  }, [showToast, capturePhone, messages.length, promptAfterExport, authorizeExport]);

  const hasMessages = messages.length > 0;

  return (
    <>
      <header className="app-header">
        <h1>
          <MessageSquare size={22} />
          微信创作工具箱
        </h1>
        <div className="app-header-right">
          {!hasMessages && activeTool === 'chat' && (
            <nav className="app-nav" aria-label="页面导航">
              <a href="#editor">开始制作</a>
              <a href="#templates">模板</a>
              <a href="#guide">教程</a>
              <a href="#faq">常见问题</a>
            </nav>
          )}
          {hasMessages && activeTool === 'chat' && (
            <div className="app-header-actions">
              <button className="btn btn-primary btn-sm" onClick={handleGenerateImage}>
                <Download size={15} /> 生成图片
              </button>
              <button className="btn btn-outline btn-sm" onClick={handleCopyImage}>
                <Copy size={15} /> 复制
              </button>
              <button className="btn btn-outline btn-sm" onClick={handleGenerateLongImage}>
                <ImageIcon size={15} /> 长截图
              </button>
              <button className="btn btn-outline btn-sm" onClick={handleShareSame}>
                <Share2 size={15} /> 生成同款
              </button>
            </div>
          )}
          <button className="official-account-trigger" type="button" aria-label="关注公众号" onClick={() => openOfficialAccountPrompt('header')}>
            <BellRing size={15} /><span>关注公众号</span>
          </button>
          <button className="account-trigger" type="button" aria-label={`账户：${accountSession?.user.display_name ?? '未登录'}，剩余 ${visibleQuota.total_remaining} 次`} onClick={() => { setAccountError(''); setAccountPrompt(true) }}>
            <UserRound size={15} />
            <span>{accountSession ? accountSession.user.display_name : '登录'}</span>
            <small>{visibleQuota.total_remaining} 次</small>
          </button>
        </div>
      </header>

      <nav className="wechat-tool-dock" aria-label="微信创作工具箱">
        <button className={activeTool === 'chat' ? 'is-active' : ''} type="button" onClick={() => setActiveTool('chat')}>
          <MessageSquare size={18} /><span><strong>聊天生成器</strong><small>对话、群聊与长截图</small></span>
        </button>
        <button className={activeTool === 'moments' ? 'is-active' : ''} type="button" onClick={() => setActiveTool('moments')}>
          <ImageIcon size={18} /><span><strong>朋友圈生成器</strong><small>图文、点赞与评论</small></span>
        </button>
        <button className={activeTool === 'payment' ? 'is-active' : ''} type="button" onClick={() => setActiveTool('payment')}><CircleDollarSign size={17} /><span><strong>支付与转账</strong><small>结果与详情页面</small></span></button>
        <button className={activeTool === 'redpacket' ? 'is-active' : ''} type="button" onClick={() => setActiveTool('redpacket')}><Gift size={17} /><span><strong>红包详情</strong><small>封面与领取结果</small></span></button>
        <button className={activeTool === 'profile' ? 'is-active' : ''} type="button" onClick={() => setActiveTool('profile')}><UserRound size={17} /><span><strong>个人资料</strong><small>资料与名片页面</small></span></button>
        <button className={activeTool === 'group' ? 'is-active' : ''} type="button" onClick={() => setActiveTool('group')}><UsersRound size={17} /><span><strong>群信息</strong><small>成员、名称与公告</small></span></button>
      </nav>

      <section className="product-intro">
        <div>
          <span className="intro-badge"><Sparkles size={14} /> 微信内容创作工具箱</span>
          <h2>{activeTool === 'chat' ? <>把对话排成一张<br /><em>清晰、自然的聊天截图</em></> : activeTool === 'moments' ? <>把图文排成一条<br /><em>自然、完整的朋友圈</em></> : <>把微信场景做成一张<br /><em>可编辑的创作素材</em></>}</h2>
          <p>{activeTool === 'chat' ? '支持单聊、群聊、图片、语音、红包和转账消息，可导出高清截图与完整长截图。' : activeTool === 'moments' ? '自由编辑头像、图文、位置、点赞与评论，实时预览并导出高清朋友圈图片。' : '支付、红包、个人资料与群信息页面统一编辑、本地保存，并导出带安全标识的高清模拟界面。'}</p>
          <div className="intro-actions">
            <a className="btn btn-primary" href={activeTool === 'chat' ? '#editor' : activeTool === 'moments' ? '#moments-editor' : '#scene-editor'}><Zap size={16} /> 立即开始制作</a>
            {activeTool === 'chat' && <a className="btn btn-outline" href="#templates">浏览对话模板</a>}
            <button className="btn btn-outline" type="button" onClick={handleShare}>
              <Share2 size={16} /> 分享工具
            </button>
          </div>
        </div>
        <div className="intro-trust">
          <span><ShieldCheck size={18} /> 对话和头像仅在本地处理</span>
          <span>无弹窗广告</span>
          <span>游客每日免费 10 次</span>
        </div>
      </section>

      {activeTool === 'chat' && <ProjectPanel
        projects={projects}
        activeProjectId={activeProjectId}
        activeProjectName={activeProjectName}
        saveState={saveState}
        storageAvailable={storageAvailable}
        onCreate={() => { void handleCreateProject(); }}
        onOpen={project => { void handleOpenProject(project); }}
        onRename={setActiveProjectName}
        onDuplicate={project => { void handleDuplicateProject(project); }}
        onDelete={project => { void handleDeleteProject(project); }}
      />}

      {activeTool === 'chat' && <main className="app-main" id="editor" ref={editorRef}>
        <div className="app-left">
          <ImportPanel text={importText} onTextChange={setImportText} onImport={handleImport} />
          {users.length > 0 && (
            <UserAvatarManager users={users} selfId={selfId} onUpdateAvatar={handleUpdateAvatar} onRemoveAvatar={handleRemoveAvatar} onSetSelf={setSelfId} />
          )}
          {users.length > 0 && (
            <MessageEditor users={users} selfId={selfId} onAddMessage={handleAddMessage} />
          )}
          {hasMessages && (
            <SettingsPanel settings={settings} onSettingsChange={setSettings} />
          )}
        </div>
        {hasMessages && (
          <PhonePreview users={users} messages={messages} settings={settings} selfId={selfId} phoneRef={phoneRef} onUpdateMessage={handleUpdateMessage} />
        )}
      </main>}

      {activeTool === 'moments' && <MomentsEditor onToast={showToast} onBeforeExport={authorizeExport} onExportSuccess={promptAfterExport} />}
      {(['payment', 'redpacket', 'profile', 'group'] as const).includes(activeTool as 'payment' | 'redpacket' | 'profile' | 'group') && (
        <WechatSceneEditor key={activeTool} kind={activeTool as 'payment' | 'redpacket' | 'profile' | 'group'} onToast={showToast} onBeforeExport={authorizeExport} onExportSuccess={promptAfterExport} />
      )}

      {activeTool === 'chat' && <GrowthContent onUseTemplate={handleUseTemplate} />}

      <footer className="analytics-note">
        聊天内容、头像和生成图片始终在本地处理；站点仅记录匿名访问、创建和导出事件。
      </footer>

      {toast && <div className="toast-msg">{toast}</div>}
      <OfficialAccountDialog
        open={officialAccountPrompt !== null}
        placement={officialAccountPrompt ?? 'header'}
        authenticated={accountSession !== null}
        busy={accountBusy}
        redeemMessage={redeemMessage}
        onClose={closeOfficialAccountPrompt}
        onCopyId={copyOfficialAccountId}
        onLogin={() => { closeOfficialAccountPrompt(); setAccountError(''); setAccountPrompt(true) }}
        onRedeem={handleRedeem}
      />
      <AccountDialog
        open={accountPrompt}
        session={accountSession}
        busy={accountBusy}
        error={accountError}
        onClose={() => setAccountPrompt(false)}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onLogout={handleLogout}
      />
    </>
  );
}

export default App;

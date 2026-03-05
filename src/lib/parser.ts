import type { ChatUser, ChatMessage, MessageType } from '@/types';

const SELF_ALIASES = new Set(['我', '自己', 'me', 'Me', 'ME', 'myself', '本人']);
const MD_MSG_REG = /^\*\*(.+?)\*\*\s*[：:]\s*(.+)$/;
const MD_TIME_REG = /^\*{0,2}【(.+?)】\*{0,2}$/;
const TIME_REG = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(\s+\d{1,2}:\d{2})?$/;
const TIME_REG2 = /^\d{1,2}:\d{2}$/;
const TIME_REG3 = /^(\d{4}年)?\d{1,2}月\d{1,2}日/;
const TIME_REG4 = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+(上午|下午|凌晨)$/;

// 特殊消息类型正则
const IMG_REG = /^\[图片\]\s*(.*)$/;
const IMG_MD_REG = /^!\[.*?\]\((.+?)\)$/;
const RP_REG = /^\[红包\]\s*(.*)$/;
const TRANSFER_REG = /^\[转账\]\s*(.*)$/;
const VOICE_REG = /^\[语音\]\s*(\d+)?$/;

function parseSpecialContent(content: string): { type: MessageType; content: string; params: ChatMessage['params'] } | null {
  // [图片]url 或 ![alt](url)
  let m = content.match(IMG_REG);
  if (m) return { type: 'image', content: m[1] || '/placeholder-image.png', params: {} };
  m = content.match(IMG_MD_REG);
  if (m) return { type: 'image', content: m[1], params: {} };
  // [红包]备注
  m = content.match(RP_REG);
  if (m) return { type: 'redpacket', content: '', params: { remark: m[1] || '恭喜发财，大吉大利' } };
  // [转账]金额 或 [转账]金额:备注
  m = content.match(TRANSFER_REG);
  if (m) {
    const parts = (m[1] || '0').split(/[:：]/);
    return { type: 'transfer', content: '', params: { amount: parts[0] || '0', remark: parts[1] || '转账' } };
  }
  // [语音]秒数
  m = content.match(VOICE_REG);
  if (m) return { type: 'voice', content: '', params: { duration: parseInt(m[1] || '3', 10) } };
  return null;
}

const AVATAR_FILES = [
  'avatar_1.png',
  'avatar_2.png',
  'avatar_3.png',
  'avatar_4.png',
];

export function getDefaultAvatar(index: number): string {
  const base = import.meta.env.BASE_URL;
  return `${base}${AVATAR_FILES[index % AVATAR_FILES.length]}`;
}

interface ParseResult {
  users: ChatUser[];
  messages: ChatMessage[];
}

export function parseChatRecord(text: string): ParseResult {
  const lines = text.split('\n');
  const orderedNames: string[] = [];
  const seenNames = new Set<string>();

  // First pass: collect all unique sender names in order
  lines.forEach(rawLine => {
    let line = rawLine.trim();
    if (!line) return;
    if (/^#+\s/.test(line) || /^>/.test(line) || /^[-=*]{3,}$/.test(line)) return;
    line = line.replace(/^[-*]\s+/, '');
    if (MD_TIME_REG.test(line)) return;
    const stripped = line.replace(/\*\*/g, '').trim();
    if (TIME_REG.test(stripped) || TIME_REG2.test(stripped) || TIME_REG3.test(stripped) || TIME_REG4.test(stripped)) return;

    const mdMatch = line.match(MD_MSG_REG);
    if (mdMatch) {
      const name = mdMatch[1].replace(/\s+/g, '').trim();
      if (!seenNames.has(name) && !SELF_ALIASES.has(name)) {
        seenNames.add(name);
        orderedNames.push(name);
      }
      return;
    }
    const colonIdx = line.search(/[：:]/);
    if (colonIdx > 0) {
      const name = line.slice(0, colonIdx).trim().replace(/\*\*/g, '');
      if (!seenNames.has(name) && !SELF_ALIASES.has(name)) {
        seenNames.add(name);
        orderedNames.push(name);
      }
    }
  });

  // Build users list: first name is "self"
  const users: ChatUser[] = [];
  let nextId = 1;
  if (orderedNames.length > 0) {
    users.push({ id: nextId++, name: orderedNames[0], avatar: null });
    for (let i = 1; i < orderedNames.length; i++) {
      users.push({ id: nextId++, name: orderedNames[i], avatar: null });
    }
  }

  const nameMap: Record<string, number> = {};
  const selfUser = users[0];
  if (selfUser) {
    SELF_ALIASES.forEach(a => (nameMap[a.toLowerCase()] = selfUser.id));
    nameMap[selfUser.name.toLowerCase()] = selfUser.id;
    for (let i = 1; i < users.length; i++) {
      nameMap[users[i].name.toLowerCase()] = users[i].id;
    }
  }

  // Second pass: parse messages
  const messages: ChatMessage[] = [];
  let msgId = 1;

  lines.forEach(rawLine => {
    let line = rawLine.trim();
    if (!line) return;
    if (/^#+\s/.test(line)) return;
    if (/^>/.test(line)) return;
    if (/^[-=*]{3,}$/.test(line)) return;
    line = line.replace(/^[-*]\s+/, '');

    // Markdown time: **【xxx】**
    const mdTimeMatch = line.match(MD_TIME_REG);
    if (mdTimeMatch) {
      messages.push({ id: msgId++, type: 'time', senderId: selfUser?.id ?? 1, content: mdTimeMatch[1], params: {} });
      return;
    }

    // Plain time
    const stripped = line.replace(/\*\*/g, '').trim();
    if (TIME_REG.test(stripped) || TIME_REG2.test(stripped) || TIME_REG3.test(stripped) || TIME_REG4.test(stripped)) {
      messages.push({ id: msgId++, type: 'time', senderId: selfUser?.id ?? 1, content: stripped, params: {} });
      return;
    }

    // Markdown message: **Name**：content
    const mdMsgMatch = line.match(MD_MSG_REG);
    if (mdMsgMatch) {
      const rawName = mdMsgMatch[1].replace(/\s+/g, '').trim();
      let content = mdMsgMatch[2].trim();
      content = content.replace(/@\S+/g, '').trim();
      if (!content) return;
      const nameLower = rawName.toLowerCase();
      let senderId: number;
      if (SELF_ALIASES.has(rawName) || SELF_ALIASES.has(nameLower) || nameLower === selfUser?.name.toLowerCase()) {
        senderId = selfUser?.id ?? 1;
      } else if (nameMap[nameLower] !== undefined) {
        senderId = nameMap[nameLower];
      } else {
        const newUser: ChatUser = { id: nextId++, name: rawName, avatar: null };
        users.push(newUser);
        nameMap[nameLower] = newUser.id;
        senderId = newUser.id;
      }
      const special = parseSpecialContent(content);
      if (special) {
        messages.push({ id: msgId++, type: special.type, senderId, content: special.content, params: special.params });
      } else {
        messages.push({ id: msgId++, type: 'text', senderId, content, params: {} });
      }
      return;
    }

    // Plain format: Name：content
    const colonIdx = line.search(/[：:]/);
    if (colonIdx > 0) {
      const rawName = line.slice(0, colonIdx).trim().replace(/\*\*/g, '');
      const content = line.slice(colonIdx + 1).trim();
      if (!content) return;
      const nameLower = rawName.toLowerCase();
      let senderId: number;
      if (SELF_ALIASES.has(rawName) || SELF_ALIASES.has(nameLower) || nameLower === selfUser?.name.toLowerCase()) {
        senderId = selfUser?.id ?? 1;
      } else if (nameMap[nameLower] !== undefined) {
        senderId = nameMap[nameLower];
      } else {
        const newUser: ChatUser = { id: nextId++, name: rawName, avatar: null };
        users.push(newUser);
        nameMap[nameLower] = newUser.id;
        senderId = newUser.id;
      }
      const special2 = parseSpecialContent(content);
      if (special2) {
        messages.push({ id: msgId++, type: special2.type, senderId, content: special2.content, params: special2.params });
      } else {
        messages.push({ id: msgId++, type: 'text', senderId, content, params: {} });
      }
    }
  });

  return { users, messages };
}

export const EXAMPLE_TEXT = `**【3月1日 14:32】**

**张三**：你好，在忙不？有个事想请你帮个忙

**李四**：不忙，怎么了？

**张三**：有个项目需要你帮忙处理下数据

**李四**：你说，尽管开口

**【3月1日 20:18】**

**张三**：资料都发你了，麻烦查收一下

**张三**：[图片]https://picsum.photos/400/300

**李四**：收到，我晚上看看

**李四**：[红包]辛苦费

**张三**：太感谢了兄弟！`;

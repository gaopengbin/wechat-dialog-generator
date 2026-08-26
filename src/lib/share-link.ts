import type { ChatMessage, ChatUser, PhoneSettings } from '@/types'
import type { ChatProjectSnapshot } from '@/lib/project-store'

const SHARE_PREFIX = 'same='
const SHARE_VERSION = 1
const MAX_SHARE_URL_LENGTH = 60_000
const MAX_DECODED_BYTES = 512_000
const messageTypes = new Set(['text', 'time', 'image', 'voice', 'redpacket', 'transfer'])

function base64UrlEncode(bytes: Uint8Array) {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function transform(bytes: Uint8Array, kind: 'compress' | 'decompress') {
  const stream = kind === 'compress'
    ? new CompressionStream('gzip')
    : new DecompressionStream('gzip')
  const writer = stream.writable.getWriter()
  await writer.write(bytes as Uint8Array<ArrayBuffer>)
  await writer.close()
  return new Uint8Array(await new Response(stream.readable).arrayBuffer())
}

function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback
}

function boundedText(value: unknown, maximum: number) {
  return String(value ?? '').slice(0, maximum)
}

function sanitizeSettings(value: unknown): PhoneSettings {
  const settings = value && typeof value === 'object' ? value as Partial<PhoneSettings> : {}
  const color = (candidate: unknown, fallback: string) => /^#[0-9a-f]{6}$/i.test(String(candidate))
    ? String(candidate)
    : fallback
  return {
    platform: settings.platform === 'android' ? 'android' : 'ios',
    time: boundedText(settings.time || '12:02', 8),
    signal: boundedNumber(settings.signal, 4, 1, 4),
    secondarySignal: boundedNumber(settings.secondarySignal, 3, 1, 4),
    simMode: settings.simMode === 'dual' ? 'dual' : 'single',
    wifiEnabled: settings.wifiEnabled !== false,
    battery: boundedNumber(settings.battery, 60, 1, 100),
    contactName: boundedText(settings.contactName, 64),
    unreadCount: boundedNumber(settings.unreadCount, 1, 0, 999),
    selfBubbleColor: color(settings.selfBubbleColor, '#95ec69'),
    otherBubbleColor: color(settings.otherBubbleColor, '#ffffff'),
    backgroundColor: color(settings.backgroundColor, '#ededed'),
    // Uploaded background images stay local, just like avatars and message images.
    backgroundImage: null,
  }
}

export function sanitizeSharedSnapshot(value: unknown): ChatProjectSnapshot {
  if (!value || typeof value !== 'object') throw new Error('分享模板格式无效')
  const candidate = value as Partial<ChatProjectSnapshot>
  if (!Array.isArray(candidate.users) || !Array.isArray(candidate.messages)) {
    throw new Error('分享模板缺少对话数据')
  }

  const users: ChatUser[] = candidate.users.slice(0, 20).map((user, index) => ({
    id: boundedNumber(user?.id, index + 1, 0, Number.MAX_SAFE_INTEGER),
    name: boundedText(user?.name || `用户${index + 1}`, 64),
    // Uploaded avatars stay local and are intentionally excluded from share URLs.
    avatar: null,
  }))
  const validUserIds = new Set(users.map((user) => user.id))
  const messages: ChatMessage[] = candidate.messages.slice(0, 250).map((message, index) => {
    const originalType = messageTypes.has(String(message?.type)) ? message.type : 'text'
    const imagePlaceholder = originalType === 'image'
    return {
      id: boundedNumber(message?.id, index + 1, 0, Number.MAX_SAFE_INTEGER),
      type: imagePlaceholder ? 'text' : originalType,
      senderId: validUserIds.has(Number(message?.senderId)) ? Number(message.senderId) : users[0]?.id ?? 0,
      content: imagePlaceholder
        ? '[图片位置，请重新上传图片]'
        : boundedText(message?.content, 5_000),
      params: {
        duration: message?.params?.duration === undefined
          ? undefined
          : boundedNumber(message.params.duration, 1, 1, 60),
        transcript: boundedText(message?.params?.transcript, 2_000) || undefined,
        amount: boundedText(message?.params?.amount, 32) || undefined,
        remark: boundedText(message?.params?.remark, 100) || undefined,
      },
    }
  })
  const selfId = validUserIds.has(Number(candidate.selfId)) ? Number(candidate.selfId) : users[0]?.id ?? null
  return {
    importText: '',
    users,
    messages,
    settings: sanitizeSettings(candidate.settings),
    selfId,
  }
}

export async function createSameTemplateUrl(snapshot: ChatProjectSnapshot, baseUrl: string) {
  const payload = JSON.stringify({ version: SHARE_VERSION, snapshot: sanitizeSharedSnapshot(snapshot) })
  const compressed = await transform(new TextEncoder().encode(payload), 'compress')
  const url = new URL(baseUrl)
  url.hash = `${SHARE_PREFIX}g1.${base64UrlEncode(compressed)}`
  if (url.href.length > MAX_SHARE_URL_LENGTH) {
    throw new Error('当前对话内容较多，分享链接过长，请精简消息后重试')
  }
  return url.href
}

export async function readSameTemplateHash(hash: string) {
  if (!hash.startsWith(`#${SHARE_PREFIX}`)) return null
  const token = hash.slice(SHARE_PREFIX.length + 1)
  if (!token.startsWith('g1.')) throw new Error('分享模板版本不受支持')
  const decoded = await transform(base64UrlDecode(token.slice(3)), 'decompress')
  if (decoded.byteLength > MAX_DECODED_BYTES) throw new Error('分享模板内容过大')
  const parsed = JSON.parse(new TextDecoder().decode(decoded)) as { version?: unknown; snapshot?: unknown }
  if (parsed.version !== SHARE_VERSION) throw new Error('分享模板版本不受支持')
  return sanitizeSharedSnapshot(parsed.snapshot)
}

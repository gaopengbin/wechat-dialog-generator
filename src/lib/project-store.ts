import type { ChatMessage, ChatUser, PhoneSettings } from '@/types'

const databaseName = 'wechat-dialog-generator'
const databaseVersion = 3
const projectStore = 'projects'
const momentStore = 'moment-projects'
const sceneStore = 'scene-projects'

export const activeProjectStorageKey = 'wechat-dialog-generator:active-project'

export interface ChatProjectSnapshot {
  importText: string
  users: ChatUser[]
  messages: ChatMessage[]
  settings: PhoneSettings
  selfId: number | null
}

export interface ChatProject extends ChatProjectSnapshot {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  version: 1
}

export interface MomentComment {
  id: string
  author: string
  content: string
}

export interface MomentProject {
  id: 'active'
  author: string
  avatar: string | null
  content: string
  images: string[]
  location: string
  timeLabel: string
  likes: string[]
  comments: MomentComment[]
  updatedAt: string
  version: 1
}

export type WechatSceneKind = 'payment' | 'redpacket' | 'profile' | 'group'

export interface WechatSceneProject {
  id: WechatSceneKind
  fields: Record<string, string>
  updatedAt: string
  version: 1
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(projectStore)) {
        const store = database.createObjectStore(projectStore, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      }
      if (!database.objectStoreNames.contains(momentStore)) {
        database.createObjectStore(momentStore, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(sceneStore)) {
        database.createObjectStore(sceneStore, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'))
  })
}

export async function loadMomentProject() {
  return withNamedStore<MomentProject | undefined>(momentStore, 'readonly', store => store.get('active'))
}

export async function saveMomentProject(project: MomentProject) {
  await withNamedStore(momentStore, 'readwrite', store => store.put(project))
  return project
}

export async function loadWechatScene(kind: WechatSceneKind) {
  return withNamedStore<WechatSceneProject | undefined>(sceneStore, 'readonly', store => store.get(kind))
}

export async function saveWechatScene(project: WechatSceneProject) {
  await withNamedStore(sceneStore, 'readwrite', store => store.put(project))
  return project
}

async function withNamedStore<T>(
  name: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase()
  try {
    return await requestResult(operation(database.transaction(name, mode).objectStore(name)))
  } finally {
    database.close()
  }
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase()
  try {
    return await requestResult(operation(database.transaction(projectStore, mode).objectStore(projectStore)))
  } finally {
    database.close()
  }
}

export async function listProjects() {
  const projects = await withStore('readonly', store => store.getAll()) as ChatProject[]
  return projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function saveProject(project: ChatProject) {
  await withStore('readwrite', store => store.put(project))
  return project
}

export async function deleteProject(projectId: string) {
  await withStore('readwrite', store => store.delete(projectId))
}

export function projectName(snapshot: ChatProjectSnapshot, date = new Date()) {
  const contact = snapshot.settings.contactName.trim()
  if (contact) return `${contact}的对话`
  const participant = snapshot.users.find(user => user.id !== snapshot.selfId)?.name
  if (participant) return `${participant}的对话`
  const stamp = new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
  return `未命名对话 ${stamp}`
}

export function projectHasContent(snapshot: ChatProjectSnapshot) {
  return snapshot.messages.length > 0 || snapshot.users.length > 0 || snapshot.importText.trim().length > 0
}

export function copyProject(project: ChatProject, now = new Date()) {
  const timestamp = now.toISOString()
  return {
    ...structuredClone(project),
    id: crypto.randomUUID(),
    name: `${project.name} 副本`,
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies ChatProject
}

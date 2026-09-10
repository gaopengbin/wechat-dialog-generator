import type { MomentProject, WechatSceneKind, WechatSceneProject } from './project-store'

export const DEFAULT_MOMENT: MomentProject = {
  id: 'active', author: '小明', avatar: null, coverColor: '#75877f', coverImage: null,
  content: '分享此刻的想法…', images: [], location: '', timeLabel: '刚刚', likes: [], comments: [],
  updatedAt: new Date(0).toISOString(), version: 1,
}

export const SCENE_DEFAULT_FIELDS: Record<WechatSceneKind, Record<string, string>> = {
  payment: { avatar: '', payee: '小林', amount: '88.00', account: '小林', time: '2026-08-13 20:18:26', orderNo: '2026081320182688120635', note: '朋友聚餐' },
  redpacket: { avatar: '', sender: '小明', greeting: '恭喜发财，大吉大利', amount: '8.88', status: '已存入零钱' },
  profile: { avatar: '', nickname: '小明', wechatId: 'xiaoming_demo', region: '浙江 杭州', signature: '保持好奇，持续创造。' },
  group: { name: 'AI 产品共创群', count: '8', members: '小明,小林,阿杰,小雨,产品同学,设计师', announcement: '欢迎交流产品想法，请勿发布无关广告。' },
}

// These values only identify untouched, auto-saved examples from older versions.
// Never replace a name inside an edited draft, uploaded image, or saved chat project.
const legacyDemoName = '高鹏彬'
const legacySceneFields: Partial<typeof SCENE_DEFAULT_FIELDS> = {
  redpacket: { ...SCENE_DEFAULT_FIELDS.redpacket, sender: legacyDemoName },
  profile: { ...SCENE_DEFAULT_FIELDS.profile, nickname: legacyDemoName, wechatId: 'gaopengbin' },
  group: { ...SCENE_DEFAULT_FIELDS.group, members: `${legacyDemoName},小林,阿杰,徐言岩,产品同学,设计师` },
}

function sameData(left: object, right: object, ignored: string[] = []) {
  const leftValues = left as Record<string, unknown>, rightValues = right as Record<string, unknown>
  const leftKeys = Object.keys(left).filter(key => !ignored.includes(key))
  const rightKeys = Object.keys(right).filter(key => !ignored.includes(key))
  return leftKeys.length === rightKeys.length && rightKeys.every(key => Object.hasOwn(left, key) && JSON.stringify(leftValues[key]) === JSON.stringify(rightValues[key]))
}

export function refreshUntouchedMomentDemo(project: MomentProject): MomentProject {
  const previous = { ...DEFAULT_MOMENT, author: legacyDemoName }
  if (!sameData(project, previous, ['updatedAt'])) return project
  return { ...structuredClone(DEFAULT_MOMENT), updatedAt: project.updatedAt }
}

export function refreshUntouchedSceneDemo(project: WechatSceneProject): WechatSceneProject {
  const previous = legacySceneFields[project.id]
  const previousGroup = { ...SCENE_DEFAULT_FIELDS.group, members: '小明,小林,阿杰,徐言岩,产品同学,设计师' }
  const matchesPrevious = previous && sameData(project.fields, previous)
  const matchesPreviousGroup = project.id === 'group' && sameData(project.fields, previousGroup)
  if (project.version !== 1 || (!matchesPrevious && !matchesPreviousGroup)) return project
  return { ...project, fields: { ...SCENE_DEFAULT_FIELDS[project.id] } }
}

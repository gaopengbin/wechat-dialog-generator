import { CircleDollarSign, Copy, Gift, Image, MessageSquare, UserRound, UsersRound } from 'lucide-react'
export const workspaceTools = [
  { id: 'chat', title: '聊天生成器', description: '对话、群聊与长截图', detail: '粘贴聊天记录，调整角色与消息，制作高清聊天图。', icon: MessageSquare, tag: '常用' },
  { id: 'batch', title: '批量聊天图', description: '多组对话 · 长图 · ZIP', detail: '一次导入多组聊天，逐组调整，批量打包导出。', icon: Copy, tag: '效率工具' },
  { id: 'moments', title: '朋友圈生成器', description: '图文、点赞与评论', detail: '组合图片和文案，自由编辑点赞、评论与封面。', icon: Image },
  { id: 'payment', title: '支付与转账', description: '结果与详情页面', detail: '编辑转账详情，制作带模拟标识的演示素材。', icon: CircleDollarSign },
  { id: 'redpacket', title: '红包详情', description: '封面与领取结果', detail: '自定义祝福语、金额与领取结果，模拟红包场景。', icon: Gift },
  { id: 'profile', title: '个人资料', description: '资料与名片页面', detail: '修改头像、昵称与个人信息，用于设计和创作。', icon: UserRound },
  { id: 'group', title: '群信息', description: '成员、名称与公告', detail: '搭建群聊信息页面，编辑成员、群名称和公告。', icon: UsersRound },
] as const

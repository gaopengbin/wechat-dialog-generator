export type Promotion = { badge: string; title: string; detail: string; action: string; target: 'account' | 'share'; claimable: boolean }

// A missing/failed reward response is unknown, never evidence of an unclaimed reward.
export function rewardPromotion(user: { email_verified_at: string | null } | null, rewardKinds: string[] | null): Promotion {
  if (!user) return { badge: '新用户福利', title: '验证注册，免费领 20 次导出', detail: '已有账号？登录后查看你的专属奖励。', action: '登录 / 注册领福利', target: 'account', claimable: false }
  if (!user.email_verified_at) return { badge: '免费额度可领取', title: '你的 20 次免费额度，待领取', detail: '完成邮箱验证即可到账，原有账号和额度不变。', action: '验证邮箱，领 20 次', target: 'account', claimable: true }
  if (rewardKinds === null) return { badge: '分享有奖', title: '把好工具分享出去，把创作额度领回来', detail: '首次有效分享 +20 次，成功邀请新用户再奖 +30 次。', action: '查看分享奖励', target: 'share', claimable: false }
  if (!rewardKinds.includes('first_share')) return { badge: '首次分享奖励待解锁', title: '首次有效分享，再领 20 次', detail: '另一位已验证用户打开你的邀请链接后到账。', action: '分享工具，解锁奖励', target: 'share', claimable: false }
  return { badge: '邀请持续有奖', title: '每成功邀请 1 位新用户，奖励 30 次', detail: '好友通过邀请链接验证注册并完成首次导出后到账。', action: '继续邀请，赚取额度', target: 'share', claimable: false }
}

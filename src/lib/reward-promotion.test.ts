import assert from 'node:assert/strict'
import test from 'node:test'
import { rewardPromotion } from './reward-promotion'

test('guests get conditional signup wording, not a claimable badge', () => {
  const result = rewardPromotion(null, null)
  assert.equal(result.claimable, false)
  assert.equal(result.target, 'account')
  assert.match(result.title, /验证注册/)
})
test('unverified accounts see the verification reward entry', () => {
  const result = rewardPromotion({ email_verified_at: null }, [])
  assert.equal(result.badge, '免费额度可领取')
  assert.equal(result.target, 'account')
  assert.equal(result.claimable, true)
})
test('unknown reward status cannot be advertised as available', () => {
  const result = rewardPromotion({ email_verified_at: '2026-09-09' }, null)
  assert.equal(result.claimable, false)
  assert.equal(result.action, '查看分享奖励')
})
test('verified users see a conditional first-share reward, and claimed users only see referrals', () => {
  const user = { email_verified_at: '2026-09-09' }
  assert.match(rewardPromotion(user, ['email_verified']).title, /首次有效分享/)
  const claimed = rewardPromotion(user, ['email_verified', 'first_share'])
  assert.equal(claimed.claimable, false)
  assert.doesNotMatch(claimed.title, /20|待领取/)
  assert.match(claimed.title, /30/)
})

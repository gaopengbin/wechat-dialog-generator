import test from 'node:test'
import assert from 'node:assert/strict'
import { copyFollowRewardKeyword, followRewardKeyword } from './follow-reward.ts'

test('copy sends the exact product-specific keyword, without decorative brackets', async () => {
  let copied = ''
  await copyFollowRewardKeyword({writeText: async text => { copied = text }})
  assert.equal(copied, '微信工具箱额度')
  assert.equal(copied, followRewardKeyword)
})
test('clipboard rejection is not reported as a successful copy', async () => {
  await assert.rejects(copyFollowRewardKeyword({writeText: async () => { throw new Error('not allowed') }}), /not allowed/)
})

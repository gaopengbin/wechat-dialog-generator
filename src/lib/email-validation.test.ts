import assert from 'node:assert/strict'
import test from 'node:test'
import { emailValidationMessage } from './email-validation'

test('email validation gives actionable feedback before requesting a code', () => {
  for (const email of ['', '   ']) assert.match(emailValidationMessage(email), /请输入/)
  for (const email of ['123456', 'name@qq', '@qq.com', 'name@@qq.com']) assert.match(emailValidationMessage(email), /完整地址/)
  for (const email of ['name＠qq.com', 'name@qq。com']) assert.match(emailValidationMessage(email), /半角/)
  assert.match(emailValidationMessage('na me@qq.com'), /空格/)
  assert.ok(emailValidationMessage('a'.repeat(154) + '@qq.com'))
  for (const email of ['name@qq.com', ' user+tag@example.com ', 'NAME@QQ.COM']) assert.equal(emailValidationMessage(email), '')
})

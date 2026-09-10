import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentError, paymentIntentKey, reserveCheckoutWindow, safeCheckoutUrl } from './payment-ui'

test('checkout accepts only the official HTTPS gateway endpoints', () => {
  assert.equal(safeCheckoutUrl('https://openapi.alipay.com/gateway.do?a=b'), 'https://openapi.alipay.com/gateway.do?a=b')
  for (const url of ['javascript:alert(1)', 'https://openapi.alipay.com.evil.test/gateway.do', 'http://openapi.alipay.com/gateway.do', 'https://user@openapi.alipay.com/gateway.do', 'https://openapi.alipay.com:444/gateway.do', 'https://openapi.alipay.com/other']) assert.throws(() => safeCheckoutUrl(url))
})
test('payment messages distinguish unavailable service and ambiguous payment', () => {
  assert.match(paymentError({ code: 'not_found' }), /尚未上线/)
  assert.match(paymentError({ code: 'payment_query_unavailable' }), /不要重复付款/)
  assert.notEqual(paymentIntentKey('account-a', 'p'), paymentIntentKey('account-b', 'p'))
  assert.notEqual(paymentIntentKey('a:b', 'c'), paymentIntentKey('a', 'b:c'))
})

test('checkout reserves synchronously, detaches opener and preserves a handed-off payment tab', () => {
  let opened = 0, closed = 0, target = ''
  const popup = { opener: {}, closed: false, document: { title: '', body: { textContent: '', style: { cssText: '' } } }, location: { replace: (url: string) => { target = url } }, close: () => { closed++ } }
  const reserved = reserveCheckoutWindow(() => { opened++; return popup as unknown as Window })
  assert.equal(opened, 1); assert.equal(popup.opener, null)
  assert.equal(reserved.navigate('https://openapi.alipay.com/gateway.do?test=1'), true)
  reserved.close()
  assert.equal(closed, 0); assert.equal(target, 'https://openapi.alipay.com/gateway.do?test=1')
})

test('blocked, closed, failed and unsafe checkout cannot trigger an extra navigation', () => {
  assert.equal(reserveCheckoutWindow(() => null).navigate('https://openapi.alipay.com/gateway.do'), false)
  assert.equal(reserveCheckoutWindow(() => { throw Error('blocked') }).navigate('https://openapi.alipay.com/gateway.do'), false)
  let closed = 0, navigations = 0
  const popup = { opener: {}, closed: false, document: { title: '', body: { textContent: '', style: { cssText: '' } } }, location: { replace: () => { navigations++ } }, close: () => { closed++ } }
  const reserved = reserveCheckoutWindow(() => popup as unknown as Window)
  assert.throws(() => reserved.navigate('https://evil.test/checkout'))
  reserved.close(); assert.equal(closed, 1); assert.equal(navigations, 0)
  popup.closed = true
  assert.equal(reserved.navigate('https://openapi.alipay.com/gateway.do'), false)
})

import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage()
  // Read-only check in a fresh profile: no password, token, registration or email sent.
  await page.goto('http://127.0.0.1:4178/')
  const result = await page.evaluate(async () => {
    const module = await fetch('/src/lib/account-api.ts').then(r => r.text())
    const endpoint = /"VITE_ACCOUNT_API_ENDPOINT"\s*:\s*"([^"]+)"/.exec(module)?.[1]
    if (endpoint !== 'https://laogao.xyz/platform-api/v1') throw new Error('Local account endpoint is not configured')
    const response = await fetch(`${endpoint}/auth/me`)
    const payload = await response.json()
    return { endpoint, status: response.status, code: payload.error?.code }
  })
  assert.equal(result.status, 401)
  console.log(JSON.stringify({ connection: 'reachable', ...result, actualLogin: 'not attempted' }))
} finally { await browser.close() }

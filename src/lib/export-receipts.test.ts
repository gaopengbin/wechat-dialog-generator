import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createReceiptStore, createExportReceiptQueue, type ReceiptIdentity } from './export-receipts'

function disk() {
  const values = new Map<string, string>()
  return { get length() { return values.size }, key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) },
    removeItem: (k: string) => { values.delete(k) }, clear: () => values.clear() } as Storage
}
function fixture(confirm: (id: string, identity: ReceiptIdentity) => Promise<unknown>, storage = disk()) {
  let time = 1000, online = true, identity: ReceiptIdentity | null = { userId: 'A', credential: 'private-token-A' }
  const store = createReceiptStore(() => storage)
  let warnings = 0
  const queue = createExportReceiptQueue({ store, confirm, identity: () => identity, now: () => time,
    online: () => online, schedule: () => 0 as unknown as ReturnType<typeof setTimeout>, cancel: () => {},
    onPending: () => { warnings++ } })
  return { queue, store, storage, advance: (n: number) => { time += n }, online: (v: boolean) => { online = v },
    identity: (v: ReceiptIdentity | null) => { identity = v }, warnings: () => warnings }
}

test('offline receipts survive reload, retry original ID and store no credentials', async () => {
  const calls: string[] = [], id = randomUUID()
  const f = fixture(async action => { calls.push(action) }); f.online(false)
  f.queue.enqueue(id, 'A'); await f.queue.flush(); f.queue.stop()
  assert.equal(calls.length, 0)
  assert.doesNotMatch(f.storage.getItem(f.storage.key(0)!)!, /private-token|credential|Bearer|image|chat/)
  const reopened = fixture(async action => { calls.push(action) }, f.storage)
  await reopened.queue.flush(); reopened.queue.stop()
  assert.deepEqual(calls, [id]); assert.equal(reopened.store.list().length, 0)
})

test('response loss after server commit retries confirmation, never a new debit', async () => {
  const confirmed = new Set<string>(), attempts: string[] = [], id = randomUUID()
  // The server already committed before the first response was lost.
  const f = fixture(async action => {
    confirmed.add(action); attempts.push(action)
    if (attempts.length === 1) throw new TypeError('network')
    return { ok: true }
  })
  f.queue.enqueue(id, 'A'); await f.queue.flush()
  assert.equal(f.store.list()[0].attempts, 1); assert.equal(f.warnings(), 1)
  await f.queue.flush(); assert.equal(attempts.length, 1, 'backoff must be respected')
  f.advance(2000); await f.queue.flush(); f.queue.stop()
  assert.deepEqual(attempts, [id, id]); assert.equal(confirmed.size, 1); assert.equal(f.store.list().length, 0)
})

test('logout/account switch pauses original-user receipts; login with fresh credentials resumes', async () => {
  const id = randomUUID(), calls: ReceiptIdentity[] = []
  const f = fixture(async (_id, identity) => { calls.push(identity) }); f.online(false)
  f.queue.enqueue(id, 'A'); await f.queue.flush()
  f.identity({ userId: 'B', credential: 'private-token-B' }); f.online(true)
  await f.queue.flush(); assert.equal(calls.length, 0)
  f.identity(null); await f.queue.flush(); assert.equal(calls.length, 0)
  f.identity({ userId: 'A', credential: 'new-token-A' }); await f.queue.flush(); f.queue.stop()
  assert.deepEqual(calls, [{ userId: 'A', credential: 'new-token-A' }])
})

test('expired sessions wait for fresh login; network retry after re-login still backs off', async () => {
  let attempts = 0
  const f = fixture(async () => {
    attempts++
    if (attempts === 1) throw { status: 401 }
    if (attempts === 2) throw new TypeError('offline')
    return { ok: true }
  })
  f.queue.enqueue(randomUUID(), 'A'); await f.queue.flush()
  f.advance(999999); await f.queue.flush(); assert.equal(attempts, 1)
  f.identity({ userId: 'A', credential: 'fresh' }); await f.queue.flush()
  await f.queue.flush(); assert.equal(attempts, 2)
  f.advance(4000); await f.queue.flush(); f.queue.stop()
  assert.equal(attempts, 3); assert.equal(f.store.list().length, 0)
})

test('parallel flushes and duplicate callbacks share a single in-flight attempt', async () => {
  let resolve!: () => void, calls = 0
  const f = fixture(async () => { calls++; await new Promise<void>(r => { resolve = r }) })
  const id = randomUUID(); f.queue.enqueue(id, 'A'); f.queue.enqueue(id, 'A')
  const first = f.queue.flush(), second = f.queue.flush()
  assert.equal(calls, 1); assert.equal(first, second)
  resolve(); await first; f.queue.stop(); assert.equal(f.store.list().length, 0)
})

test('429 retries after backoff; invalid action is retained without endless retries', async () => {
  let attempts = 0
  const f = fixture(async () => { attempts++; throw { status: attempts === 1 ? 429 : 400, code: 'invalid_export' } })
  f.queue.enqueue(randomUUID(), 'A'); await f.queue.flush()
  f.advance(2000); await f.queue.flush(); f.advance(999999); await f.queue.flush(); f.queue.stop()
  assert.equal(attempts, 2); assert.equal(f.store.list()[0].blocked, 'invalid')
})

test('blocked storage keeps memory retries; corrupt disk entries are ignored', async () => {
  let calls = 0, warnings = 0
  const store = createReceiptStore(() => { throw Error('storage denied') })
  const queue = createExportReceiptQueue({ store, identity: () => ({ userId: 'A', credential: 'token' }),
    confirm: async () => { calls++ }, schedule: () => 0 as unknown as ReturnType<typeof setTimeout>, cancel: () => {},
    onStorageUnavailable: () => { warnings++ } })
  queue.enqueue(randomUUID(), 'A'); await queue.flush(); queue.stop()
  assert.equal(calls, 1); assert.equal(warnings, 1); assert.equal(store.list().length, 0)
  const storage = disk(); storage.setItem('wechat-toolbox:export-receipt:v1:bad', 'not json')
  assert.equal(createReceiptStore(() => storage).list().length, 0)
})

test('persisting another tab receipt never overwrites the first receipt', async () => {
  const storage = disk(), a = fixture(async () => {}, storage), b = fixture(async () => {}, storage)
  a.online(false); b.online(false)
  a.queue.enqueue(randomUUID(), 'A'); b.queue.enqueue(randomUUID(), 'A')
  await Promise.all([a.queue.flush(), b.queue.flush()]); a.queue.stop(); b.queue.stop()
  assert.equal(createReceiptStore(() => storage).list().length, 2)
})

test('timer automatically retries after backoff and adapter cannot reserve quota', async () => {
  let time = 1000, calls = 0, delay = 0, callback = () => {}
  const store = createReceiptStore(() => disk())
  const queue = createExportReceiptQueue({ store, identity: () => ({ userId: 'A', credential: 'token' }), now: () => time,
    confirm: async () => { if (++calls === 1) throw Error('offline') },
    schedule: (next, ms) => { callback = next; delay = ms; return 0 as unknown as ReturnType<typeof setTimeout> }, cancel: () => {} })
  queue.enqueue(randomUUID(), 'A'); await queue.flush()
  assert.equal(delay, 2000)
  time += delay; callback(); await queue.flush(); queue.stop()
  assert.equal(calls, 2); assert.equal(store.list().length, 0)
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
  assert.match(app, /const result = await completeAccountExport\(id, identity, signal\)/)
  const api = readFileSync(new URL('./account-api.ts', import.meta.url), 'utf8')
  const complete = api.slice(api.indexOf('export const completeAccountExport'), api.indexOf('export function pendingInvite'))
  assert.match(complete, /quota\/complete/); assert.doesNotMatch(complete, /quota\/consume|consumeAccountExport/)
})

test('later ready receipts are not starved behind ten backoff entries', async () => {
  const f = fixture(async () => {}); f.online(false)
  for (let i = 0; i < 10; i++) f.store.put({ actionId: randomUUID(), userId: 'A', createdAt: 1, attempts: 3, nextAttemptAt: 99_999 })
  f.queue.enqueue(randomUUID(), 'A'); await f.queue.flush(); f.online(true)
  await f.queue.flush(); f.queue.stop()
  assert.equal(f.store.list().length, 10)
})

test('release retries survive reload in a separate namespace and cannot become success confirmations', () => {
  const storage = disk(), success = createReceiptStore(() => storage), release = createReceiptStore(() => storage, 'wechat-toolbox:export-release:v1:')
  const item = { userId: 'A', actionId: randomUUID(), createdAt: 1, attempts: 0, nextAttemptAt: 1 }
  release.put(item)
  assert.equal(success.list().length, 0)
  assert.deepEqual(createReceiptStore(() => storage, 'wechat-toolbox:export-release:v1:').list(), [item])
  success.put({ ...item, actionId: randomUUID() })
  assert.equal(release.list().length, 1)
  assert.equal(success.list().length, 1)
})

test('incident regression: a lost first acknowledgement cannot strand five later waived exports or debit twice', { timeout: 2000 }, async()=>{
  const storage=disk(),store=createReceiptStore(()=>storage),first=randomUUID(),five=Array.from({length:5},()=>randomUUID()),charged=new Set<string>(),calls:string[]=[]
  let late!:()=>void,time=1000,warnings=0
  const queue=createExportReceiptQueue({store,identity:()=>({userId:'incident-fixture',credential:'fixture'}),now:()=>time,attemptTimeoutMs:10,schedule:()=>0 as unknown as ReturnType<typeof setTimeout>,cancel:()=>{},onPending:()=>warnings++,confirm:async id=>{
    calls.push(id)
    if(id===first){charged.add(id);if(calls.filter(x=>x===first).length===1)return new Promise(resolve=>{late=()=>resolve({ok:true})})}
    return five.includes(id)?{ok:true,settlement:'waived',charged:false}:{ok:true}
  }})
  queue.enqueue(first,'incident-fixture');for(const id of five)queue.enqueue(id,'incident-fixture')
  await queue.flush();await queue.flush()
  assert.deepEqual(calls,[first,...five]);assert.equal(store.list().length,1);assert.equal(warnings,1);assert.equal(charged.size,1)
  late();await new Promise(resolve=>setTimeout(resolve,5));assert.equal(store.list().length,1,'late completion cannot remove a newer retry state')
  time+=2000;await queue.flush();queue.stop();assert.equal(charged.size,1);assert.equal(store.list().length,0)
})

test('pageshow/focus resume expires stale in-flight work even when browser timers were suspended', { timeout: 2000 }, async()=>{
  const store=createReceiptStore(()=>disk());let time=1000,calls=0
  const queue=createExportReceiptQueue({store,identity:()=>({userId:'A',credential:'fixture'}),now:()=>time,attemptTimeoutMs:1_000_000,schedule:()=>0 as unknown as ReturnType<typeof setTimeout>,cancel:()=>{},confirm:async()=>{if(++calls===1)return new Promise(()=>{});return {ok:true}}})
  queue.enqueue(randomUUID(),'A');for(let i=0;i<5;i++)queue.enqueue(randomUUID(),'A')
  time+=2_000_000;await queue.resume();queue.stop();assert.equal(calls,6);assert.equal(store.list().length,1);assert.equal(store.list()[0].attempts,1)
  const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');assert.match(app,/addEventListener\('pageshow', resume\)/);assert.match(app,/removeEventListener\('pageshow', resume\)/)
})

test('stopping an abort-ignoring attempt preserves the original receipt and does not notify after unmount', {timeout:2000},async()=>{
  const store=createReceiptStore(()=>disk());let calls=0,warnings=0,late!:()=>void
  const queue=createExportReceiptQueue({store,identity:()=>({userId:'A',credential:'fixture'}),schedule:()=>0 as unknown as ReturnType<typeof setTimeout>,cancel:()=>{},onPending:()=>warnings++,confirm:async()=>{if(++calls===1)return new Promise(resolve=>{late=()=>resolve({ok:true})});return {ok:true}}})
  queue.enqueue(randomUUID(),'A');const pending=queue.flush();queue.stop();await pending;assert.equal(store.list().length,1);assert.equal(warnings,0);late();await new Promise(resolve=>setTimeout(resolve,5));assert.equal(store.list().length,1);queue.start();await queue.flush();queue.stop();assert.equal(calls,2);assert.equal(store.list().length,0)
})

// Bounded, tab-local cache. Failed loads are never retained; retry is explicit.
export function createResourceCache(loader: (source: string) => Promise<string>, concurrency = 3, byteLimit = 24 * 1024 * 1024) {
  const pending = new Map<string, Promise<string>>()
  const ready = new Map<string, string>()
  const waiting: (() => void)[] = []
  let active = 0, bytes = 0
  return (source: string): Promise<string> => {
    const cached = ready.get(source)
    if (cached) { ready.delete(source); ready.set(source, cached); return Promise.resolve(cached) }
    const previous = pending.get(source)
    if (previous) return previous
    const result = new Promise<string>((resolve, reject) => {
      const start = () => {
        active++
        const done = () => { pending.delete(source); active--; waiting.shift()?.() }
        Promise.resolve().then(() => loader(source)).then(data => {
          if (data.length <= byteLimit) {
            while (ready.size && (bytes + data.length > byteLimit || ready.size >= 24)) {
              const first = ready.keys().next().value!
              bytes -= ready.get(first)!.length; ready.delete(first)
            }
            ready.set(source, data); bytes += data.length
          }
          done(); resolve(data)
        }, error => { done(); reject(error) })
      }
      if (active < concurrency) start(); else waiting.push(start)
    })
    pending.set(source, result)
    return result
  }
}

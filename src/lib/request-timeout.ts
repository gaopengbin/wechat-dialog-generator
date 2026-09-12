/** Avoid AbortSignal.timeout/any: older browsers do not implement them. */
export async function withRequestTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  milliseconds: number,
  parent?: AbortSignal | null,
): Promise<T> {
  const controller = new AbortController()
  let timedOut = false
  const cancel = () => controller.abort()
  if (parent?.aborted) cancel()
  else parent?.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(() => {
    if (!controller.signal.aborted) {
      timedOut = true
      controller.abort()
    }
  }, milliseconds)
  try {
    if (controller.signal.aborted) throw new DOMException('请求已取消，请重试。', 'AbortError')
    return await operation(controller.signal)
  } catch (error) {
    if (timedOut) throw new DOMException('请求超时，请检查网络后重试。', 'TimeoutError')
    if (controller.signal.aborted) throw new DOMException('请求已取消，请重试。', 'AbortError')
    throw error
  } finally {
    clearTimeout(timer)
    parent?.removeEventListener('abort', cancel)
  }
}

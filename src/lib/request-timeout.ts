/** Avoid AbortSignal.timeout/any: older browsers do not implement them. */
export async function withRequestTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  milliseconds: number,
  parent?: AbortSignal | null,
): Promise<T> {
  const controller = new AbortController()
  let rejectDeadline!: (reason: DOMException) => void
  const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject })
  const cancellationReason = () => parent?.reason?.name === 'TimeoutError'
    ? new DOMException('请求超时，请检查网络后重试。', 'TimeoutError')
    : new DOMException('请求已取消，请重试。', 'AbortError')
  const cancel = () => {
    // Reject first: an adapter may ignore abort or keep response.json pending.
    rejectDeadline(cancellationReason())
    controller.abort()
  }
  if (parent?.aborted) {
    controller.abort()
    throw cancellationReason()
  }
  parent?.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(() => {
    rejectDeadline(new DOMException('请求超时，请检查网络后重试。', 'TimeoutError'))
    controller.abort()
  }, milliseconds)
  try {
    // The losing promise stays observed by race; late rejection cannot become
    // unhandled and a late response cannot change the already-settled result.
    return await Promise.race([operation(controller.signal), deadline])
  } finally {
    clearTimeout(timer)
    parent?.removeEventListener('abort', cancel)
  }
}

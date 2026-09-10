import { useCallback, useEffect, useRef, useState } from 'react'

interface Confirmation { title: string; description: string; confirmText?: string }
export function useConfirm() {
  const [request, setRequest] = useState<Confirmation | null>(null)
  const pending = useRef<((accepted: boolean) => void) | null>(null)
  const confirm = useCallback((next: Confirmation) => new Promise<boolean>(resolve => {
    pending.current?.(false)
    pending.current = resolve
    setRequest(next)
  }), [])
  const resolve = useCallback((accepted: boolean) => {
    pending.current?.(accepted)
    pending.current = null
    setRequest(null)
  }, [])
  useEffect(() => () => { pending.current?.(false) }, [])
  return { request, confirm, resolve }
}

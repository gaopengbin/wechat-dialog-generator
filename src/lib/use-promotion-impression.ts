import { useEffect, useRef } from 'react'
import { trackGrowthEvent } from './growth-analytics'
const seen = new Set<string>()
export function usePromotionImpression<T extends HTMLElement = HTMLElement>(placement: string, offer: string) {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const element = ref.current, key = `${placement}:${offer}`
    if (!element || seen.has(key) || typeof IntersectionObserver === 'undefined') return
    let visible = false, timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      clearTimeout(timer)
      if (visible && document.visibilityState === 'visible' && !seen.has(key)) timer = setTimeout(() => {
        seen.add(key); trackGrowthEvent('promotion_viewed', { placement, offer })
      }, 500)
    }
    const observer = new IntersectionObserver(entries => { visible = entries[0].intersectionRatio >= .5; update() }, { threshold: .5 })
    observer.observe(element); document.addEventListener('visibilitychange', update)
    return () => { clearTimeout(timer); observer.disconnect(); document.removeEventListener('visibilitychange', update) }
  }, [placement, offer])
  return ref
}

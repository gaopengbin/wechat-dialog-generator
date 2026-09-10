import { createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { PhonePreview } from './PhonePreview'
import { captureChatPhone } from '@/lib/capture-chat'
import type { BatchJob } from '@/lib/batch'

export async function renderBatchChat(job: BatchJob) {
  if (!job.snapshot?.messages.length) throw new Error('请先解析本组对话。')
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:375px;pointer-events:none;'
  host.setAttribute('aria-hidden', 'true'); document.body.append(host)
  const root = createRoot(host), ref = createRef<HTMLDivElement>()
  let canvas: HTMLCanvasElement | null = null
  try {
    flushSync(() => root.render(<PhonePreview {...job.snapshot!} phoneRef={ref} />))
    await document.fonts.ready
    await Promise.all(Array.from(host.querySelectorAll('img')).map(async image => {
      await image.decode().catch(() => { throw new Error('头像或消息图片加载失败，请替换为本地上传图片后重试。') })
    }))
    if (!ref.current) throw new Error('聊天预览尚未就绪。')
    const body = ref.current.querySelector('.wc-chat-body')
    if (body) body.scrollTop = 0
    canvas = await captureChatPhone(ref.current, job.mode === 'long')
    if (!canvas) throw new Error('截图失败，请重试。')
    const blob = await new Promise<Blob>((resolve, reject) => canvas!.toBlob(value => value ? resolve(value) : reject(new Error('图片编码失败。')), 'image/png'))
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    if (canvas) { canvas.width = 0; canvas.height = 0 }
    root.unmount(); host.remove()
  }
}

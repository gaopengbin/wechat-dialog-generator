import { withRequestTimeout } from './request-timeout'
import { phoneChrome } from './phone-chrome'

// Only exact application-owned paths may use bundled bytes. Never substitute a
// user's image because it happens to have the same filename on another origin.
export function bundledChrome(source: string, base: string) {
  const url = new URL(source, base)
  for (const [name, bytes] of Object.entries(phoneChrome)) {
    if (url.href === new URL(name, base).href) return bytes
  }
}

export type AssetKind = 'avatar' | 'message' | 'background' | 'chrome' | 'other'
export function assetScheme(source: string, base = 'http://localhost/') {
  try {
    const url = new URL(source, base)
    return url.protocol === 'data:' ? 'data' : url.protocol === 'blob:' ? 'blob' : ['http:','https:'].includes(url.protocol) ? url.origin === new URL(base).origin ? 'same_origin' : 'remote' : 'other'
  } catch { return 'other' }
}
export function captureFailure(code: string, step: string, kind?: AssetKind, scheme?: string, phase?: string) {
  return Object.assign(new Error(step === 'asset_embed' ? (scheme === 'remote' ? '外链图片无法用于导出，可能是网络或跨域限制。请将原图下载后重新上传；本次未扣额度。' : '图片资源无法读取，请重新上传头像、消息图片或聊天背景后重试；本次未扣额度。') : '截图渲染失败，请减少单组消息或缩小图片后重试。'), {
    exportReason: step === 'asset_embed' ? 'resource_load' : 'render_failed', renderStep: step,
    captureInfo: { failure_code: code, ...(kind ? { asset_kind: kind } : {}), ...(scheme ? { asset_scheme: scheme } : {}), ...(phase ? { asset_phase: phase } : {}) },
  })
}
export async function boundedCapture<T>(operation: Promise<T>, failure: Error | (() => Error), milliseconds = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer=setTimeout(()=>reject(typeof failure==='function' ? failure() : failure),milliseconds) })]) }
  finally { if(timer) clearTimeout(timer) }
}
const readBlob = (blob: Blob) => new Promise<string>((resolve,reject)=>{
  const reader=new FileReader(); reader.onload=()=>typeof reader.result==='string' ? resolve(reader.result) : reject(new Error('Image encoding failed'))
  reader.onerror=()=>reject(new Error('Image read failed'));reader.readAsDataURL(blob)
})
export function decodeImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve,reject)=>{
    const image=new Image()
    image.onload=()=>{
      if(!image.naturalWidth || !image.naturalHeight) {reject(new Error('Image has no pixels'));return}
      // Some old engines expose decode() but reject valid already-loaded images.
      // onload + positive dimensions is the compatibility fallback, not a blank image.
      // onload + real pixels is sufficient for canvas drawing. decode() can
      // remain pending on older engines even after a valid load; awaiting it
      // converted usable built-in icons into repeated 15-second timeouts.
      image.onload=null;image.onerror=null
      resolve(image)
    }
    image.onerror=()=>reject(new Error('Image decode failed'))
    image.src=source
  })
}
// Reuse real, already-rendered pixels before requesting the same image again.
// Cross-origin taint is NOT bypassed: toDataURL throws and the CORS fetch path
// remains responsible for checking access. Never substitute a placeholder.
export function loadedImageData(image: HTMLImageElement): string | undefined {
  if (!image.complete || !image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) return
  const canvas = document.createElement('canvas')
  try {
    canvas.width=image.naturalWidth;canvas.height=image.naturalHeight
    const context=canvas.getContext('2d')
    if (!context) return
    context.drawImage(image,0,0)
    const data=canvas.toDataURL('image/png')
    return data.startsWith('data:image/png;') ? data : undefined
  } catch { return undefined }
  finally {canvas.width=0;canvas.height=0}
}
export async function loadCaptureResource(source: string, kind: AssetKind, base: string, deps = { fetcher: (...args: Parameters<typeof fetch>) => fetch(...args), read: readBlob, decode: decodeImage }, deadline=12000) {
  const scheme=assetScheme(source,base)
  let data=bundledChrome(source,base) ?? source
  if(!data.startsWith('data:')) {
    for(let attempt=0;attempt<2;attempt++) {
      let phase='fetch'
      try {
        // The deadline covers headers AND body/encoding, including engines that
        // don't promptly reject a stalled fetch when its signal is aborted.
        data=await boundedCapture(withRequestTimeout(async signal=>{
          const response=await deps.fetcher(new URL(source,base).href,{signal,cache:attempt?'reload':'default',credentials:scheme==='same_origin'?'same-origin':'omit'})
          if(!response.ok) throw captureFailure('asset_http','asset_embed',kind,scheme,'fetch')
          phase='body'
          return await response.blob().then(deps.read)
        },deadline),()=>captureFailure('asset_timeout','asset_embed',kind,scheme,phase),deadline+25)
        break
      } catch(error) {
        const failure=(error as {captureInfo?:{failure_code?:string}})?.captureInfo ? error as Error
          : captureFailure((error as {name?:string})?.name==='TimeoutError'?'asset_timeout':'asset_fetch','asset_embed',kind,scheme,phase)
        const code=(failure as {captureInfo?:{failure_code?:string}}).captureInfo?.failure_code
        if(attempt===1 || !['asset_fetch','asset_timeout'].includes(code || '')) throw failure
      }
    }
  }
  try { await boundedCapture(deps.decode(data),captureFailure('asset_timeout','asset_embed',kind,scheme,'decode')) }
  catch(error) { if((error as {captureInfo?:unknown})?.captureInfo) throw error;throw captureFailure('asset_decode','asset_embed',kind,scheme,'decode') }
  return data
}

// Attempt-local cache: preserve query strings, never cache a failed fetch or an
// empty placeholder. Temporary substitutions are restored even after failure.
export async function prepareCaptureResources(root: HTMLElement) {
  const undo: (()=>void)[]=[]
  const cache=new Map<string,Promise<string>>()
  const load=(source:string,kind:AssetKind,image?:HTMLImageElement)=>{
    let result=cache.get(source)
    if(!result){const pixels=image && loadedImageData(image);result=pixels ? Promise.resolve(pixels) : loadCaptureResource(source,kind,document.baseURI);cache.set(source,result)}
    return result
  }
  const restore=()=>{ for(const reset of undo.reverse()) reset() }
  try {
    for(const image of Array.from(root.querySelectorAll('img'))) {
      const source=image.currentSrc || image.src
      const kind:AssetKind=image.closest('.wc-face')?'avatar':image.closest('.wc-bubble-image')?'message':'chrome'
      const data=await load(source,kind,image)
      const src=image.getAttribute('src'),srcset=image.getAttribute('srcset')
      undo.push(()=>{if(src===null)image.removeAttribute('src');else image.setAttribute('src',src);if(srcset===null)image.removeAttribute('srcset');else image.setAttribute('srcset',srcset)})
      image.removeAttribute('srcset');image.src=data
    }
    for(const node of [root,...Array.from(root.querySelectorAll<HTMLElement>('[style]'))]) {
      const background=node.style.backgroundImage
      if(!background.includes('url(')) continue
      let embedded=background
      for(const match of background.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g)) {
        const source=(match[1]||match[2]||match[3]).trim()
        const data=await load(source,'background')
        embedded=embedded.replace(match[0],`url("${data}")`)
      }
      undo.push(()=>{node.style.backgroundImage=background});node.style.backgroundImage=embedded
    }
    return restore
  } catch(error) { restore();throw error }
}

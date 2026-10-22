import { withRequestTimeout } from './request-timeout'

export type AssetKind = 'avatar' | 'message' | 'background' | 'chrome' | 'other'
export function assetScheme(source: string, base = 'http://localhost/') {
  try {
    const url = new URL(source, base)
    return url.protocol === 'data:' ? 'data' : url.protocol === 'blob:' ? 'blob' : ['http:','https:'].includes(url.protocol) ? url.origin === new URL(base).origin ? 'same_origin' : 'remote' : 'other'
  } catch { return 'other' }
}
export function captureFailure(code: string, step: string, kind?: AssetKind, scheme?: string) {
  return Object.assign(new Error(step === 'asset_embed' ? '图片资源无法读取，请重新上传头像、消息图片或聊天背景后重试。' : '截图渲染失败，请减少单组消息或缩小图片后重试。'), {
    exportReason: step === 'asset_embed' ? 'resource_load' : 'render_failed', renderStep: step,
    captureInfo: { failure_code: code, ...(kind ? { asset_kind: kind } : {}), ...(scheme ? { asset_scheme: scheme } : {}) },
  })
}
export async function boundedCapture<T>(operation: Promise<T>, failure: Error, milliseconds = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer=setTimeout(()=>reject(failure),milliseconds) })]) }
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
      if(typeof image.decode==='function') image.decode().then(()=>resolve(image),()=>resolve(image))
      else resolve(image)
    }
    image.onerror=()=>reject(new Error('Image decode failed'))
    image.src=source
  })
}
export async function loadCaptureResource(source: string, kind: AssetKind, base: string, deps = { fetcher: (...args: Parameters<typeof fetch>) => fetch(...args), read: readBlob, decode: decodeImage }) {
  const scheme=assetScheme(source,base)
  let data=source
  if(scheme!=='data') {
    try {
      const response=await withRequestTimeout(signal=>deps.fetcher(new URL(source,base).href,{signal,cache:'no-cache',credentials:scheme==='same_origin'?'same-origin':'omit'}),12000)
      if(!response.ok) throw captureFailure('asset_http','asset_embed',kind,scheme)
      data=await boundedCapture(response.blob().then(deps.read),captureFailure('asset_timeout','asset_embed',kind,scheme))
    } catch(error) {
      if((error as {captureInfo?:unknown})?.captureInfo) throw error
      throw captureFailure((error as {name?:string})?.name==='TimeoutError'?'asset_timeout':'asset_fetch','asset_embed',kind,scheme)
    }
  }
  try { await boundedCapture(deps.decode(data),captureFailure('asset_timeout','asset_embed',kind,scheme)) }
  catch(error) { if((error as {captureInfo?:unknown})?.captureInfo) throw error;throw captureFailure('asset_decode','asset_embed',kind,scheme) }
  return data
}

// Attempt-local cache: preserve query strings, never cache a failed fetch or an
// empty placeholder. Temporary substitutions are restored even after failure.
export async function prepareCaptureResources(root: HTMLElement) {
  const undo: (()=>void)[]=[]
  const cache=new Map<string,Promise<string>>()
  const load=(source:string,kind:AssetKind)=>{
    let result=cache.get(source)
    if(!result){result=loadCaptureResource(source,kind,document.baseURI);cache.set(source,result)}
    return result
  }
  const restore=()=>{ for(const reset of undo.reverse()) reset() }
  try {
    for(const image of Array.from(root.querySelectorAll('img'))) {
      const source=image.currentSrc || image.src
      const kind:AssetKind=image.closest('.wc-face')?'avatar':image.closest('.wc-bubble-image')?'message':'chrome'
      const data=await load(source,kind)
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

// Public toSvg has no completed-clone hook. Reuse the pinned 1.11.13 pipeline
// and sanitize its detached clone before XML serialization (not user content).
import { cloneNode } from 'html-to-image/es/clone-node'
import { embedWebFonts } from 'html-to-image/es/embed-webfonts'
import { embedImages } from 'html-to-image/es/embed-images'
import { applyStyle } from 'html-to-image/es/apply-style'
import { nodeToDataURL } from 'html-to-image/es/util'
import type { Options } from 'html-to-image/es/types'
import { captureSvgSource, sanitizeCaptureClone } from './capture-svg'

export async function buildCaptureSvg(node: HTMLElement,width: number,height: number,options: Options) {
  const clone=await cloneNode(node,options,true)
  if(!clone)throw new Error('Missing capture clone')
  await embedWebFonts(clone,options)
  await embedImages(clone,options)
  applyStyle(clone,options)
  const cleanup=sanitizeCaptureClone(clone)
  return {source:captureSvgSource(await nodeToDataURL(clone,width,height)),cleanup}
}

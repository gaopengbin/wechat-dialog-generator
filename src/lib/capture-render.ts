import { toSvg } from 'html-to-image'
import { boundedCapture, captureFailure, decodeImage, prepareCaptureResources } from './capture-resources'
import { renderFailure } from './export-diagnostics'
import { captureSvgSource, captureSvgBase64 } from './capture-svg'

export async function renderChatCanvas(phone: HTMLElement,width: number,height: number) {
  const restore=await prepareCaptureResources(phone)
  try {
    let svg: string
    try {
      svg=captureSvgSource(await boundedCapture(toSvg(phone,{
        width,height,pixelRatio:1,backgroundColor:'#ededed',includeQueryParams:true,
        filter: node => !(node instanceof HTMLElement && node.hasAttribute('data-capture-ui')),
        onImageErrorHandler:()=>{throw captureFailure('asset_embed','asset_embed')},
      }),captureFailure('capture_timeout','capture')))
    } catch(error) {
      if((error as {captureInfo?:unknown})?.captureInfo) throw error
      throw Object.assign(renderFailure(error,'capture'),{captureInfo:{failure_code:'svg_build'}})
    }
    let image: HTMLImageElement
    try { image=await boundedCapture(decodeImage(svg),captureFailure('capture_timeout','svg_rasterize')) }
    catch(error) {
      if((error as {captureInfo?:unknown})?.captureInfo) throw error
      // Retry the same already-embedded image, not the export transaction.
      // No account authorization or charge occurs inside the renderer.
      try { image=await boundedCapture(decodeImage(captureSvgBase64(svg)),captureFailure('capture_timeout','svg_rasterize')) }
      catch(error) { if((error as {captureInfo?:unknown})?.captureInfo) throw error;throw captureFailure('svg_decode','svg_rasterize') }
    }
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
    const context=canvas.getContext('2d')
    if(!context) throw captureFailure('canvas_context','capture')
    try {context.fillStyle='#ededed';context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height)}
    catch {canvas.width=0;canvas.height=0;throw captureFailure('canvas_draw','capture')}
    return canvas
  } finally {restore()}
}

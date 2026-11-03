import { boundedCapture, captureFailure, prepareCaptureResources } from './capture-resources'
import { renderFailure } from './export-diagnostics'
import { validateCaptureSvg, type SvgCleanup } from './capture-svg'
import { decodeCaptureSvg } from './capture-svg-decode'
import { buildCaptureSvg } from './capture-svg-build'

export async function renderChatCanvas(phone: HTMLElement,width: number,height: number) {
  const restore=await prepareCaptureResources(phone,{visibleOnly:true})
  try {
    let svg: string
    let cleanup: SvgCleanup='none'
    try {
      const result=await boundedCapture(buildCaptureSvg(phone,width,height,{
        width,height,pixelRatio:1,backgroundColor:'#ededed',includeQueryParams:true,
        filter: node => !(node instanceof HTMLElement && node.hasAttribute('data-capture-ui')),
        onImageErrorHandler:()=>{throw captureFailure('asset_embed','asset_embed')},
      }),captureFailure('capture_timeout','capture'))
      svg=result.source;cleanup=result.cleanup
    } catch(error) {
      if((error as {captureInfo?:unknown})?.captureInfo) throw error
      throw Object.assign(renderFailure(error,'capture'),{captureInfo:{failure_code:'svg_build'}})
    }
    const diagnostics=validateCaptureSvg(svg,cleanup)
    const image=await decodeCaptureSvg(svg,diagnostics)
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
    const context=canvas.getContext('2d')
    if(!context) throw captureFailure('canvas_context','capture')
    try {context.fillStyle='#ededed';context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height)}
    catch {canvas.width=0;canvas.height=0;throw captureFailure('canvas_draw','capture')}
    return canvas
  } finally {restore()}
}

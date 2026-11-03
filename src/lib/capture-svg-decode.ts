import { captureFailure, decodeImage } from './capture-resources'
import { captureSvgBase64 } from './capture-svg'
import { withRequestTimeout } from './request-timeout'

/** Retry only the same immutable image, before quota authorization. Both loads
 * share a 15s budget, and a timed-out Image is actively detached. */
export async function decodeCaptureSvg(source: string, diagnostics: Record<string,string>, deps = {decode:decodeImage,base64:captureSvgBase64,now:()=>performance.now()}, budgetMs=15000) {
  const start=deps.now()
  const base64First=diagnostics.svg_size==='4m_16m'||diagnostics.svg_size==='16m_plus'
  const transports=base64First?['base64','uri'] as const:['uri','base64'] as const
  for(let attempt=0;attempt<transports.length;attempt++){
    const remaining=budgetMs-(deps.now()-start),transport=transports[attempt]
    if(remaining<=0)throw Object.assign(captureFailure('capture_timeout','svg_rasterize'),{captureInfo:{failure_code:'capture_timeout',...diagnostics,svg_transport:attempt?'both':transport}})
    try {
      const encoded=transport==='base64'?deps.base64(source):source
      const left=budgetMs-(deps.now()-start)
      if(left<=0)throw new DOMException('Image budget exhausted','TimeoutError')
      const deadline=Math.max(1,Math.min(left,attempt===0?budgetMs*.55:left))
      return await withRequestTimeout(signal=>deps.decode(encoded,signal),deadline)
    }catch(error){
      if(attempt===0)continue
      throw Object.assign(captureFailure((error as {name?:string})?.name==='TimeoutError'?'capture_timeout':'svg_decode','svg_rasterize'),{captureInfo:{failure_code:(error as {name?:string})?.name==='TimeoutError'?'capture_timeout':'svg_decode',...diagnostics,svg_transport:'both'}})
    }
  }
  throw captureFailure('svg_decode','svg_rasterize')
}

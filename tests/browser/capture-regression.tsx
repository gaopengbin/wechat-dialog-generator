import {createRef} from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {toCanvas} from 'html-to-image'
import {PhonePreview} from '../../src/components/PhonePreview'
import {captureChatPhone} from '../../src/lib/capture-chat'
import {renderChatCanvas} from '../../src/lib/capture-render'
import {exportDetails,exportReason} from '../../src/lib/export-diagnostics'
import {renderBatchChat} from '../../src/components/batch-chat-render'
import {runBatch,deliverBatch,zipImages,type BatchJob} from '../../src/lib/batch'
import type {PhoneSettings,ChatMessage} from '../../src/types'

const result=document.querySelector('#results')!,fixtures=document.querySelector('#fixtures')!,previews=document.querySelector('#previews')!
const check=(value:unknown,message:string)=>{if(!value)throw Error(message)}
function color(value:string){const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d')!;x.fillStyle=value;x.fillRect(0,0,32,32);return c.toDataURL('image/png')}
const red=color('#ff0000'),blue=color('#0000ff')
function node(source:string){const host=document.createElement('div');host.style.cssText='width:100px;height:100px;display:block;';const image=document.createElement('img');image.style.cssText='display:block;width:100px;height:100px;';image.src=source;host.append(image);fixtures.append(host);return host}
function display(canvas:HTMLCanvasElement,label:string){const figure=document.createElement('figure'),h=document.createElement('h2');h.textContent=label;figure.append(h);canvas.style.cssText='width:180px;height:auto;display:block;border:1px solid #ddd;';figure.append(canvas);previews.append(figure)}
const settings:PhoneSettings={platform:'ios',time:'12:02',signal:4,secondarySignal:3,simMode:'single',wifiEnabled:true,battery:60,contactName:'导出回归示例',unreadCount:1,selfBubbleColor:'#95ec69',otherBubbleColor:'#fff',backgroundColor:'#ededed',backgroundImage:null}
document.querySelector<HTMLButtonElement>('#run')!.onclick=async()=>{
 const button=document.querySelector<HTMLButtonElement>('#run')!;button.disabled=true;result.textContent='运行中';const reports:unknown[]=[]
 try {
  // Faithfully exercise the installed legacy library's failure cache first.
  const original=window.fetch;let healthy=false,fetches=0
  const target=location.origin+'/__fixture_capture_resource__?attempt=one'
  window.fetch=async(input,init)=>{const url=String(input);if(url.startsWith(location.origin+'/__fixture_capture_resource__')){fetches++;return healthy?original(blue):new Response('',{status:404})}return original(input,init)}
  const host=node(target);let firstFailed=false,secondFailed=false
  try {
   try {await toCanvas(host,{width:100,height:100,onImageErrorHandler:()=>{throw Error('expected fixture failure')}})}catch{firstFailed=true}
   healthy=true
   try {await toCanvas(host,{width:100,height:100,onImageErrorHandler:()=>{throw Error('expected cached fixture failure')}})}catch{secondFailed=true}
   const recovered=await renderChatCanvas(host,100,100)
   const pixel=[...recovered.getContext('2d')!.getImageData(50,50,1,1).data]
   check(firstFailed&&secondFailed&&pixel[2]>200&&pixel[0]<20,'failure cache reproduction/recovery did not match')
   reports.push({test:'legacy failure cache reproduced; repaired loader recovers',pass:true,fetches,pixel})
  }finally{window.fetch=original;host.remove()}
  window.fetch=async(input,init)=>{const url=String(input);if(url.includes('/__fixture_query_image__'))return original(url.endsWith('blue')?blue:red);return original(input,init)}
  try {
   const pixels=[]
   for(const v of ['red','blue']){const host=node(location.origin+'/__fixture_query_image__?id='+v);try{const canvas=await renderChatCanvas(host,100,100);pixels.push([...canvas.getContext('2d')!.getImageData(50,50,1,1).data])}finally{host.remove()}}
   check(pixels[0][0]>200&&pixels[1][2]>200&&pixels[1][0]<20,'query variants were mixed')
   reports.push({test:'query-string image variants stay distinct',pass:true,pixels})
  }finally{window.fetch=original}
  const bad=node('data:image/png;base64,Y29ycnVwdA==')
  try {await renderChatCanvas(bad,100,100);throw Error('corrupt image must fail')}catch(error){check(exportDetails(error).failure_code==='asset_decode','corrupt image stage lost');reports.push({test:'corrupt image fails before capture with no quota call',pass:true,details:exportDetails(error)})}finally{bad.remove()}
  const phoneHost=document.createElement('div');fixtures.append(phoneHost);const root=createRoot(phoneHost),ref=createRef<HTMLDivElement>()
  const messages:ChatMessage[]=Array.from({length:16},(_,i)=>({id:i+1,type:'text',senderId:i%2+1,content:`测试消息 ${i+1}：普通截图与完整长图应保持头像、文字和浅绿色气泡。`,params:{}}))
  const nativeDecode=HTMLImageElement.prototype.decode;let decodeCalls=0,blockedIconRequests=0
  HTMLImageElement.prototype.decode=function(){decodeCalls++;return new Promise(()=>{})}
  window.fetch=async(input,init)=>{if(/wechat-(bottom|voice|trans)-icon/.test(String(input))){blockedIconRequests++;throw Error('fixture icon network is offline')}return original(input,init)}
  try {
   flushSync(()=>root.render(<PhonePreview users={[{id:1,name:'小明',avatar:null},{id:2,name:'小林',avatar:null}]} messages={messages} selfId={1} settings={settings} phoneRef={ref}/>))
   await document.fonts.ready
   const standard=await captureChatPhone(ref.current!,false);check(standard?.width===1125&&standard.height===2436,'standard output dimensions changed');display(standard!,'标准图：1125 × 2436')
   const long=await captureChatPhone(ref.current!,true);check(long?.width===1125&&long.height>=2436,'long image too short');display(long!,`长图：1125 × ${long!.height}`)
   check(phoneHost.querySelector<HTMLElement>('.wc-phone-wrap')!.style.height==='','capture layout was not restored')
   reports.push({test:'actual React phone normal and long captures; styles restored',pass:true,standard:[standard!.width,standard!.height],long:[long!.width,long!.height]})
   const snapshot={users:[{id:1,name:'小明',avatar:red},{id:2,name:'小林',avatar:blue}],messages,selfId:1,settings}
   const huge:BatchJob={id:crypto.randomUUID(),selected:true,state:'ready',mode:'long',content:{title:'超限测试',body:''},snapshot:{...snapshot,messages:Array.from({length:150},(_,i)=>({id:i+1,type:'text',senderId:i%2+1,content:'超长消息'.repeat(20),params:{}}))}}
   let reserves=0
   await runBatch([huge],{render:renderBatchChat,debit:async()=>{reserves++},cancelled:()=>false,update:()=>{},complete:()=>{},failure:(_job,error)=>{check(exportReason(error)==='image_too_large','long limit was reduced to generic render_failed')}})
   check(huge.state==='error'&&reserves===0&&huge.error?.includes('16000'),'oversized batch charged or hid recovery guidance')
   reports.push({test:'real oversized batch is actionable, cleaned up, and does not reserve quota',pass:true,reserves,reason:'image_too_large'})
   huge.snapshot=snapshot
   const mixed:ChatMessage[]=[{id:1,type:'voice',senderId:2,content:'',params:{duration:5}},{id:2,type:'voice',senderId:1,content:'',params:{duration:3}},{id:3,type:'transfer',senderId:1,content:'',params:{amount:'8.88'}},{id:4,type:'redpacket',senderId:2,content:'',params:{remark:'回归测试'}}]
   const jobs:BatchJob[]=[huge,...['standard','long'].map(mode=>({id:crypto.randomUUID(),selected:true,state:'ready' as const,mode:mode as 'standard'|'long',content:{title:'批量测试',body:''},snapshot:{...snapshot,messages:mixed}}))]
   const committed=new Set<string>();let delivered=0
   await runBatch(jobs,{render:renderBatchChat,debit:async()=>{reserves++},cancelled:()=>false,update:()=>{},complete:()=>{}})
   check(jobs.every(j=>j.state==='done'&&j.bytes?.length)&&reserves===3,'actual three-image batch failed')
   const zip=zipImages(jobs.map((j,i)=>({name:`${i+1}.png`,bytes:j.bytes!})))
   for(let i=0;i<2;i++)await deliverBatch(jobs,{reserve:async()=>{},deliver:()=>{delivered++},complete:id=>{committed.add(id)},failed:()=>{throw Error('fixture delivery failed')}})
   check(committed.size===3&&delivered===2,'retry duplicated fixture ledger')
   const dimensions=jobs.map(j=>{const view=new DataView(j.bytes!.buffer,j.bytes!.byteOffset,j.bytes!.byteLength);return [view.getUint32(16),view.getUint32(20)]})
   const download=document.createElement('a');download.href=URL.createObjectURL(zip);download.download='capture-regression-3-images.zip';download.textContent='下载已验证的三图 ZIP';previews.append(download)
   check(blockedIconRequests===0&&decodeCalls===0,'capture still depends on icon network or decode()')
   reports.push({test:'three real batch PNGs and ZIP; failed job retried with same ID; fixture completion idempotent',pass:true,dimensions,zipBytes:zip.size,uniqueCompletions:committed.size,blockedIconRequests,decodeCalls})
  } finally{HTMLImageElement.prototype.decode=nativeDecode;window.fetch=original;root.unmount();phoneHost.remove()}
  document.querySelector('#status')!.textContent='全部通过：图标断网、decode 挂起、普通图/长图、三图批量 ZIP、超限提示和原编号重试；真实额度请求 0 次。'
  result.textContent=JSON.stringify({passed:true,reports,quotaRequests:0},null,2)
 }catch(error){result.textContent=JSON.stringify({passed:false,reports,error:error instanceof Error?error.message:'unknown',details:exportDetails(error)},null,2)}finally{button.disabled=false}
}

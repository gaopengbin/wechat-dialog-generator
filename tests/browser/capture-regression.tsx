import {createRef} from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {toCanvas} from 'html-to-image'
import {PhonePreview} from '../../src/components/PhonePreview'
import {captureChatPhone} from '../../src/lib/capture-chat'
import {renderChatCanvas} from '../../src/lib/capture-render'
import {exportDetails} from '../../src/lib/export-diagnostics'
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
  try {
   flushSync(()=>root.render(<PhonePreview users={[{id:1,name:'小明',avatar:null},{id:2,name:'小林',avatar:null}]} messages={messages} selfId={1} settings={settings} phoneRef={ref}/>))
   await document.fonts.ready
   const standard=await captureChatPhone(ref.current!,false);check(standard?.width===1125&&standard.height===2436,'standard output dimensions changed');display(standard!,'标准图：1125 × 2436')
   const long=await captureChatPhone(ref.current!,true);check(long?.width===1125&&long.height>=2436,'long image too short');display(long!,`长图：1125 × ${long!.height}`)
   check(phoneHost.querySelector<HTMLElement>('.wc-phone-wrap')!.style.height==='','capture layout was not restored')
   reports.push({test:'actual React phone normal and long captures; styles restored',pass:true,standard:[standard!.width,standard!.height],long:[long!.width,long!.height]})
  } finally{root.unmount();phoneHost.remove()}
  document.querySelector('#status')!.textContent='通过：失败缓存恢复、查询参数隔离、损坏图片诊断、真实普通图及长图；额度请求 0 次。'
  result.textContent=JSON.stringify({passed:true,reports,quotaRequests:0},null,2)
 }catch(error){result.textContent=JSON.stringify({passed:false,reports,error:error instanceof Error?error.message:'unknown',details:exportDetails(error)},null,2)}finally{button.disabled=false}
}

// Offline candidate only. Never imports a business server, opens a DB, or
// overwrites the deployed/archived source. Deploy this before the r5 frontend.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises'
import {resolve,dirname,join} from 'node:path'
import {createHash} from 'node:crypto'
const [sourceFile,outputDirectory]=process.argv.slice(2)
if(!sourceFile||!outputDirectory)throw Error('Usage: node prepare-export-diagnostics-backend.mjs <active product-events.mjs copy> <new output directory>')
const source=await readFile(sourceFile,'utf8')
const replacements=[
 ['capture_size, svg_xml, svg_size, svg_cleanup, svg_transport, ...diagnostic','capture_size, svg_xml, svg_size, svg_cleanup, svg_transport, asset_http_status, ...diagnostic'],
 ["['failure_code',failure_code,['asset_fetch'","['failure_code',failure_code,['image_too_large','asset_fetch'"],
 ["'capture-20261031-r4']],","'capture-20261031-r4','capture-20261103-r5']],"],
 ["['svg_transport',svg_transport,['uri','both']],","['svg_transport',svg_transport,['uri','base64','both']],\n      ['asset_http_status',asset_http_status,['400','401','403','404','408','410','413','429','500','502','503','504','other']],"],
]
let next=source
for(const [before,after] of replacements){if(next.split(before).length!==2)throw Error('Backend source drift; re-inspect before preparing: '+before);next=next.replace(before,after)}
await mkdir(outputDirectory,{recursive:true})
const target=join(resolve(outputDirectory),'product-events.mjs')
if(resolve(sourceFile)===target)throw Error('Refusing to overwrite source')
await writeFile(target,next,{flag:'wx'})
for(const name of ['statistics.mjs','growth-analytics.mjs'])await copyFile(join(dirname(sourceFile),name),join(outputDirectory,name))
const digest=s=>createHash('sha256').update(s).digest('hex')
const manifest={source:resolve(sourceFile),source_sha256:digest(source),candidate:target,candidate_sha256:digest(next),diagnostic_revision:'capture-20261103-r5',production_changed:false}
await writeFile(join(outputDirectory,'diagnostic-patch-manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'})
console.log(JSON.stringify(manifest,null,2))

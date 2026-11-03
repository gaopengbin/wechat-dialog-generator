import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const {validateProductEnvelope}=await import(pathToFileURL(process.argv[2]).href)
const props={diagnostic_id:'11111111-1111-4111-8111-111111111111',action_id:'11111111-1111-4111-8111-111111111111',diagnostic_version:'2',quota_phase:'not_requested',tool:'chat',capture_mode:'standard',stage:'render',reason:'render_failed',browser:'edge-149',capture_revision:'capture-20261103-r5',error_kind:'error',render_step:'svg_rasterize'}
const now=Date.parse('2026-11-03T17:00:00+08:00')
const envelope=p=>({schema_version:1,product:'wechat-dialog-generator',events:[{event_id:'22222222-2222-4222-8222-222222222222',visitor_id:'33333333-3333-4333-8333-333333333333',session_id:'44444444-4444-4444-8444-444444444444',event:'export_failed',occurred_at:new Date(now).toISOString(),properties:{...props,...p}}]})
for(const p of [
 {capture_revision:'capture-20261031-r4',failure_code:'capture_timeout',svg_transport:'uri'},
 {failure_code:'capture_timeout',svg_transport:'base64',svg_xml:'valid',svg_size:'16m_plus'},
 {failure_code:'image_too_large',reason:'image_too_large',capture_size:'over_limit'},
 {failure_code:'asset_http',asset_http_status:'403',render_step:'asset_embed'},
])assert.doesNotThrow(()=>validateProductEnvelope(envelope(p),now))
for(const p of [{asset_http_status:'secret-url'},{raw_url:'https://private.test'},{failure_code:'private text'},{capture_revision:'unregistered-version'},{svg_transport:'blob'}])assert.throws(()=>validateProductEnvelope(envelope(p),now))
console.log(JSON.stringify({passed:true,accepted_safe_variants:4,rejected_private_or_unregistered:5,db_opened:false,production_writes:0}))

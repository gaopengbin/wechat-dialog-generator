import test from 'node:test'
import assert from 'node:assert/strict'
import { copyOrDownload } from './image-delivery'
import { createExportLogger, type ExportLog } from './export-log'

test('clipboard permission denial downloads the exact same PNG with one reservation and one completion', async()=>{
 const png=new Blob(['same generated pixels'],{type:'image/png'})
 const logs:ExportLog[]=[],reports:Record<string,string>[]=[]
 const log=createExportLogger(async row=>{logs.push(row)},()=>{},row=>reports.push(row))({tool:'chat',mode:'clipboard'})
 const calls:string[]=[]
 log.stage('authorize');calls.push('reserve:'+log.id);log.action(log.id);log.stage('clipboard')
 const outcome=await copyOrDownload(png,{
  copy:async blob=>{assert.equal(blob,png);calls.push('copy');throw new DOMException('Permission denied','NotAllowedError')},
  download:blob=>{assert.equal(blob,png);log.stage('download');calls.push('download')},
 })
 await log.finish(outcome);calls.push('complete:'+log.id)
 await log.finish('failed','duplicate');assert.equal(outcome,'download_requested')
 assert.deepEqual(calls,['reserve:'+log.id,'copy','download','complete:'+log.id])
 assert.deepEqual(logs.map(row=>row.outcome),['pending','download_requested']);assert.equal(reports.length,0)
})
test('working clipboard does not download; an unavailable clipboard follows the same fallback', async()=>{
 const blob=new Blob(['png']);let downloads=0
 assert.equal(await copyOrDownload(blob,{copy:async()=>{},download:()=>{downloads++}}),'copied');assert.equal(downloads,0)
 assert.equal(await copyOrDownload(blob,{copy:()=>{throw new TypeError('Unsupported clipboard')},download:()=>{downloads++}}),'download_requested');assert.equal(downloads,1)
})
test('failed clipboard and download cannot complete delivery or conceal the final error', async()=>{
 let completed=0
 await assert.rejects(async()=>{
  await copyOrDownload(new Blob(['png']),{copy:async()=>{throw Error('denied')},download:()=>{throw Error('download failed')}})
  completed++
 },/download failed/)
 assert.equal(completed,0)
})

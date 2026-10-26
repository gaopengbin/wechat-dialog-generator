import type { ExportLog } from './export-log'
const stages=['render','authorize','encode','download','clipboard','zip']
const reasons=['preview_missing','resource_load','render_failed','image_too_large','security','permission','storage_full','timeout','aborted','type_error','unknown']
export interface SupportLocalReport { outcome: ExportLog['outcome']; stage?: string; reason?: string }
export function supportLocalReport(record: Pick<ExportLog,'id'|'actionId'|'outcome'|'note'>): SupportLocalReport {
  const outcome=['pending','generated','download_requested','copied','failed','cancelled'].includes(record.outcome)?record.outcome:'pending'
  const result: SupportLocalReport={outcome}
  const match=String(record.note||'').match(/\[([a-z_]+)\/([a-z_]+); ([a-f0-9-]{36})\]/i)
  if(match&&(match[3]===record.id||match[3]===record.actionId)){
    if(stages.includes(match[1]))result.stage=match[1]
    if(reasons.includes(match[2]))result.reason=match[2]
  }
  return result
}

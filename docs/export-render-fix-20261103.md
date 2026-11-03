# Export rendering correction — 2026-11-03

Local implementation; NOT deployed. Do not deploy the current Android-development branch or its dist directory wholesale.

## Incident and accounting boundary

Today's eight immutable reports comprised four explicit `image_too_large`/`over_limit` rejections, three Edge149 URI SVG decode timeouts with valid XML and >16MiB payloads, and one remote message-image fetch failure. Every report had a distinct valid action ID, `quota_phase=not_requested`, no matching export_actions/completed_exports/reservation row. At the read-only audit there were89 actions and89 receipts, without duplicate action groups. No historical report, exemption, credit, reservation or receipt was modified.

The “unknown4” aggregate was a reader bug: it ignored the existing reason when failure_code was absent. The global product-ops query now falls back only to known reasons; its16 synthetic tests include today's4+3+1 distribution and immutable rows. Backups of the two changed skill scripts are in the task output directory. No private records or daily metrics were added to that skill.

## Changes

- Chat render preflight intersects resources with the phone and clipping ancestors. Offscreen images retain measured placeholder dimensions, so a scrolled conversation cannot collapse. Long captures expand the frame first and retain all in-frame content. Blocked visible images still fail; blocked fully-clipped images need not prevent a standard screenshot.
- Resample only temporary export pixels at the rendered dimensions, never upscale, preserve alpha, prefer an existing data image when conversion would increase its size. Original source/srcset/styles and drafts are restored. Tainted cross-origin pixels still require a CORS-authorized read; there is no proxy or permission bypass.
- Validate corrupt data images instead of treating any data URL as valid. Restore temporary changes on failure as well as success.
- SVG decoding uses one15-second budget. Large payloads prefer compact base64; either initial transport may be retried on error/timeout using the same immutable SVG, before quota authorization. Aborted image loads detach handlers/source. This does not retry an export/payment transaction.
- `image_too_large` gains an explicit safe code; capture timeout guidance is distinct. HTTP failures preserve a closed enum of status codes through preview and capture. No URLs, exception strings, chat content or full user-agent are reported.
- Revision is `capture-20261103-r5`. The server must accept it BEFORE serving this frontend. Existing r4 is still accepted.

The16000px long-image safety limit remains; no content is silently truncated and no automatic pagination is claimed. Network/CORS failures cannot always be distinguished by browser fetch errors; asset_fetch is not a fabricated HTTP status.

## Verification

-189 frontend unit tests; lint, TypeScript/build.
- `scripts/export-render-budget-smoke.mjs`: the same synthetic eight-image example previously produced28,692,978 SVG bytes; now179,886 bytes. Visible180×135 photo pixels have mean absolute error0 against the browser reference. Source/style restore, scrolled-message position, offscreen/visible failure distinction, HTTP403 metadata, actual base64 fallback image, bounded both-hung failure, one action/report, no API writes.
- `scripts/capture-regression-smoke.mjs`: transient-resource retry, offline visible avatar, query variants, corrupt-image rejection, real React1125×2436 standard and1125×5677 long output;16000px rejection before reservation; real three-PNG ZIP and idempotent fixture completion on repeat delivery. No real account/quota API writes.
- `scripts/export-xml-smoke.mjs`: illegal comment/unbound attribute/nested SVG/xlink branches and explicit invalid-XML failure retain metadata and never request quota.
- `scripts/android-money-smoke.mjs`: pending/settled original nine-patch card backgrounds still survive PNG capture.
- This is synthetic/local Edge156 verification, not replay of private user photos or proof of the exact Edge149 runtime outcome.

Artifacts: `C:/Users/Administrator/Documents/test/outputs/export-render-fix-20261103/`.

## Backend candidate and eventual release gate

The maintained dashboard checkout is older than the active backend, so it was NOT used as the patch base and unrelated changes there were untouched. `scripts/prepare-export-diagnostics-backend.mjs` creates a new file from the retained active-release source, refuses overwrite or anchor drift, and records hashes. It adds only r5, image_too_large, base64 and closed HTTP-status diagnostics; no database or quota service changes.

Offline candidate: task outputs `backend-candidate/product-events.mjs`.

- Active-source copy SHA256: `2f429914739d3e836de6913d2354e094b2e3dcd460a8b885dae3868fa4f3713f`.
- Candidate SHA256: `4ea4fa5a7d886494f339ef0d02ee8fbdbea1b907d75c08fd5e7b4c8bd4327de5`.
- `test-export-diagnostics-backend.mjs`:4 valid old/new envelopes accepted,5 private/unregistered variants rejected, no DB opened.

Before any authorized deployment, reverify the active symlink and source hash; preserve a full immutable release/DB backup and rollback. Apply only the diagnostic file to the then-current backend release, validate, deploy backend first. Build the frontend from verified production-base commitb615a629825ff351e35e962628521a2129a208cd plus this isolated correction (not2769d21, which contains Android development history). Keep current data/exemptions untouched and read back live versions and real accounting invariants after release. Do not replay historical completions or compensate/debit today's eight failures.

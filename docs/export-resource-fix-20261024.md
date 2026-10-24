# Capture reliability follow-up — 2026-10-24

## Reviewed cohort and evidence limits

- 2026-10-23 Beijing full day: 41 failure reports (25 resource, 14 render, 2 clipboard permission).
- 2026-10-24 through 17:45 Beijing: 2 resource reports, same WeChat browser session, one chrome timeout and one avatar timeout.
- All 43 have correlation action IDs; none joins an export debit. Repeated attempts are not unique customers.
- Published previous bundle: `index-Blg1rPuV.js`, verified revision `51ef3a9` on 2026-10-23 12:06 Beijing. Historical logs have no capture revision, so stale pages remain a hypothesis, not a proven classification. Do not rewrite old events to assert a cause.
- The 14 generic render reports lack an image height and subcode. The known over-limit defect was previously reproduced, but not every historical render report can be assigned that cause.

## This fix

- Reuse an image's already-loaded, readable pixels before fetching it again. Full natural resolution is retained; there are no blank placeholders or silent remote-image replacements. Canvas taint is respected, falling back to the ordinary CORS fetch path.
- For images that still need fetching: first use browser cache, retry transient fetch/timeout failure once with reload; do not retry definite HTTP errors or corrupt content. Whole fetch/body deadlines handle engines that ignore cancellation. Retry remains entirely before quota authorization and keeps the original export operation ID.
- Add closed-vocabulary `capture_revision`, `asset_phase`, and `capture_size` diagnostics. Never send image URLs, exception strings, names, or chat content.
- External image failures explain network/CORS limits and suggest uploading an authorized local copy. Long-image limit remains 16000 pixels and no content is silently cut off.
- No account, quota, reservation, receipt, payment, or compensation implementation changes.

## Verification and deployment

- Unit tests cover loaded-image validation/taint, one transient retry, non-cooperative fetch and body timeouts, diagnostics privacy, failure-no-debit and idempotent receipt retries.
- Real browser regression covers poisoned legacy cache, retained pixels with network disconnected, temporary failure recovery, query isolation, corrupt images, standard and long PNGs, oversized batch cleanup, three real PNGs in ZIP and same-ID retries. Tests use synthetic content and no real quota API requests.
- Backend metadata whitelist shipped first as `export-capture-diagnostics-20261024-r1`; backward compatibility plus isolated reservation/compensation tests passed. Only `product-events.mjs` changes; no schema migration.
- Backend backup and rollback: `/srv/laogao/backups/export-capture-diagnostics-20261024-r1/platform-api.sqlite` and `/srv/laogao/releases/platform-api/export-diagnostics-20261022-r1`. Before/after restart fingerprints match for accounts and all accounting/audit tables. Never restore this database over later legitimate activity merely to roll back code.
- Frontend rollback is a forward revert of this change atop refreshed main and normal Pages deployment. No force-push or ledger rollback.

## Acceptance boundary

These tests verify the failure mechanisms and safe accounting paths, not the original customer's private image or physical WeChat/Safari device. Network-blocked external content cannot be guaranteed exportable. Old tabs must refresh to load the new bundle; the new revision marker makes subsequent reports distinguishable.

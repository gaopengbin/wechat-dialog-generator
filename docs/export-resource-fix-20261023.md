# Export resource reliability — 2026-10-23

## Observed production cohort

Beijing 00:00–11:56:59: 27 failure reports from three anonymous devices;
19 `asset_timeout / chrome / same_origin`, seven batch long-image failures
with `render_failed / capture` and no subcode, one clipboard permission failure.
All 27 have action IDs and none join a quota debit. The same cutoff contains
59 debits, each with a completion receipt. Counts are reports, not unique jobs.

The historic reports do not identify fetch/body/decode subphase or chat height.
Therefore an initial networking failure, hung decode, or exact cause of all seven
batch reports cannot be retroactively proven from those records alone.

## Fix

- Bundle the seven existing phone UI PNGs byte-for-byte. Preview and capture no
  longer fetch these fixed decorations from Pages. Only exact application asset
  paths can use bundled bytes; external/user/query-string images are not replaced.
- Complete image validation on `onload` plus positive natural dimensions instead
  of awaiting optional `decode()` again. A controlled pending-decode reproduction
  previously times out even though the browser has usable pixels.
- Preserve safe error reasons across wrapper boundaries. A real >16000px batch
  was reproducibly misclassified as generic render failure. It now retains
  `image_too_large`, shows split/standard-mode recovery guidance and cleans up.
  The safety limit is not increased; content is never silently cropped/resized.
- No authorization, reservation, completion, release, payment, or retry ID logic
  was changed. No telemetry schema change or backend restart is required.

## Verification before publish

- 87 unit tests, lint, TypeScript and production build passed.
- Real browser: prior poisoned fetch-cache recovery, query isolation, corrupt
  image failure, actual standard 1125×2436 and long 1125×5530 PNG captures.
- With UI-icon networking blocked and native `decode()` deliberately pending:
  standard/long exports and three actual React batch PNGs still succeed. Zero
  icon fetches and zero optional decode calls occur.
- Real oversized batch fails before reservation, then succeeds on the same ID
  after correcting the fixture. Three PNGs form a 1,238,515-byte ZIP; fixture
  completion is idempotent across two deliveries. No real quota API is called.
- Ten active-backend diagnostic/reservation tests passed against isolated DBs.
- Before release: immutable SQLite backup under
  `/srv/laogao/backups/export-assets-20261023-r1/platform-api.sqlite`, quick_check
  ok, and original rows of debit/receipt/reward/audit ledgers checked unchanged.

## Release and rollback

Previous main: `a4c3b8cfcbd4995d73e39a456f9f8fbd98f8b18b`.
Publish through the unchanged GitHub-hosted Pages workflow after local tests.
Preserve local Git rollback bundle and verify online JS bytes against dist.
Rollback only the fix commit with a new forward commit and redeploy Pages;
never restore an old DB over new user activity. Historical inference rows stay
separate from original events and are not rewritten by this release.

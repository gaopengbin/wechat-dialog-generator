# Export resource recovery — 2026-10-26

Capture revision: `capture-20261026-r2`.

## Scope

- Same four default avatars bundled as original-dimension WebP quality 90: 1,363,280 -> 121,090 bytes (91.1% smaller). Exact legacy application paths resolve offline; foreign origins and query-bearing user URLs are never substituted.
- Imported remote message images preflight in preview, share a bounded three-request loader, and become local data images only after a successful CORS-safe read and decode. Failures expose the message number and original-image replacement; explicit retry is available. Never bypass CORS or silently replace private images with placeholders.
- Preview-only loading/recovery UI is excluded from captures. External random-image demo dependency removed; image slots explicitly request a local upload.
- Clipboard rejection falls back to downloading the same PNG with the same action ID/reservation. A retained download button makes browser-blocked downloads retryable without another render/reservation/completion. Account identity is checked before delivery and repeat download.
- Account backend, database schema, quotas, reservation/commit APIs and receipt queue unchanged. Missing telemetry is not classified as failure.

## Checks

- 103 unit tests; build/type-check; ESLint.
- Actual browser, real App and capture renderer against loopback-only simulated account/quota endpoints (never production users).
- Visible image without CORS: actionable warning, export stops before reservation.
- CORS-readable image: localized to data URI, real render succeeds.
- Clipboard unavailable (controlled fixture): automatic download recovery UI, one reserve/action, receipt 503 then same-ID retry, one simulated commit. Manual repeat download adds no quota request.
- Mixed batch: good image renders and reaches ZIP; bad image remains editable, with no reservation/commit. Cached ZIP download renews the existing ID but does not create a new commit.
- These checks do not prove physical file persistence on every browser or success for the private URLs in historical reports. CORS-blocked sources still require original-image upload.

## Deployment and rollback

- Static frontend only, existing GitHub-hosted Pages workflow; no production-server GitHub download, backend restart, database write or migration.
- Previous main: `e9c03bfbe17122433563d9eb42988f754ca103fe`.
- Previous deployed entry: `assets/index-Bmpy-m2-.js`, SHA-256 `51f7c81cb5eadeced3d1703a86f57ad7e907cdd1f0ba89b247fb12da564c457f`.
- Rollback: revert this release commit on main and publish through the same Pages workflow. Keep this record and prior Git revision; do not alter financial records to roll back a UI change.
- Local audit artifacts: `C:/Users/Administrator/Documents/test/outputs/toolbox-failures-20261026/`. Synthetic QA configuration remains outside the repository and is not shipped.

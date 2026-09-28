# Upload security operations

> **Status (2026-09-28):** format validation, normalization, quotas, private EA storage, deduplication, orphan cleanup, and production fail-closed behavior are implemented. The external malware scanner, alerts, cleanup schedule, storage permissions, and restore procedure still require production verification.

Images are accepted only as PNG, JPEG, or WebP. The server decodes the image
with Sharp, limits it to one frame, 4096 pixels per side and 16,777,216 total
pixels, then re-encodes it without the original metadata. A matching extension
and client MIME type alone are never trusted.

EA uploads accept only compiled `.ex4` and `.ex5` files whose header matches
the requested format. Source `.mq5` and archive `.zip` uploads are disabled.
Header validation is a format gate, not malware detection.

Production uploads fail closed unless `UPLOAD_SCAN_URL` is configured and the
scanner returns HTTP 2xx JSON `{ "clean": true }`. The scanner receives raw
bytes plus `X-Upload-File-Name` and `X-Upload-Sha256`; configure
`UPLOAD_SCAN_TOKEN` when it requires a bearer token. A timeout, invalid reply,
or unavailable scanner returns HTTP 503 and no file or database row is kept.

Files use server-generated random names. EA files remain below
`storage/private/eas`; images are re-encoded into `public/uploads`. Tests may
override these locations with `NEXUS_STORAGE_ROOT` and
`NEXUS_PUBLIC_UPLOAD_ROOT`; production must ensure the public image directory
is served by the deployment and the private directory is not web-accessible.

Each account may retain at most 10 unattached uploads, 50 MiB of unattached
data, and 250 MiB in total. The final quota check and upload row insertion run
in an immediate SQLite transaction. Unattached files expire after 24 hours.
Run `npm run upload:cleanup` on a schedule; upload requests also trigger the
same cleanup. Replaced files and files released by product deletion receive a
new 24-hour expiry.

Monitor audit reasons `MALWARE_DETECTED`, `SCAN_REJECTED`,
`SCANNER_UNAVAILABLE`, `CONTENT_VALIDATION_FAILED`, quota failures, and
`DUPLICATE_CONTENT`. Before public deployment, verify the configured scanner
with its standard benign and test-malware fixtures and confirm alerts in the
external monitoring system.

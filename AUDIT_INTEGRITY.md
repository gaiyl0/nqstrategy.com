# Audit integrity and retention

Nexus Quant stores security events in an append-only HMAC chain. Each live row
contains the previous row hash and a keyed signature. The signed chain head is
stored separately, so changing, inserting, or deleting a row is detected. The
database also blocks ordinary `INSERT`, `UPDATE`, and `DELETE` statements on the
audit tables.

## Required production configuration

- `AUDIT_INTEGRITY_SECRET`: a random secret of at least 32 characters. Keep it
  in the deployment secret manager, never in source control.
- `AUDIT_INTEGRITY_PREVIOUS_SECRETS`: optional comma-separated old secrets used
  only while verifying records signed before a rotation.
- `AUDIT_RETENTION_DAYS`: an integer from 30 through 3650. Production refuses
  to build or start when it is absent or invalid.
- `AUDIT_ARCHIVE_DIR`: a relative directory without `..`; defaults to
  `storage/audit-archives`.

Development creates `storage/secrets/audit-integrity.key` when no explicit
secret is configured. Back up that file if the local database matters. Losing
every key that signed retained records makes those records unverifiable.

## Operations

Run `npm run audit:verify` at startup, after restoration, and from monitoring.
It exits nonzero if a live row, signed chain head, archive manifest, or archive
content file fails verification.

Run `npm run audit:archive` from a scheduled maintenance job. It archives only
the contiguous oldest prefix that is beyond retention, writes JSONL data and a
signed manifest, commits the archive record and deletion in one database
transaction, then verifies the complete chain. Copy completed archive files to
write-once or object-locked storage. Local signatures detect tampering but do
not stop an operator who possesses both the database and signing key from
rewriting history.

Monitor the `/api/audit` response and `X-Audit-Status` response header. A
degraded status or `AUDIT_INTEGRITY_FAILURE` response requires investigation;
do not silently discard it.

## Key rotation

1. Keep the old secret available.
2. Set the new value as `AUDIT_INTEGRITY_SECRET` and add the old value to
   `AUDIT_INTEGRITY_PREVIOUS_SECRETS`.
3. Restart and run `npm run audit:verify`.
4. New rows use the new key. Keep every prior key until all records and archive
   batches signed with it have passed their legal retention period.

## Restore and recovery

Restore `data.db`, all files below the configured archive directory, and the
matching current and previous signing keys as one recovery set. Run
`npm run audit:verify` before accepting traffic. If verification fails, preserve
the database, archives, logs, and keys for investigation. Do not repair or
re-sign the records in place; restore the latest known-good set and reconcile
events from the external immutable copy.

import { archiveExpiredAuditLogs, getAuditHealth, verifyAuditIntegrity } from '../lib/audit-integrity.mjs';

const command = process.argv[2];

try {
  if (command === 'verify') {
    const integrity = verifyAuditIntegrity({ verifyArchiveFiles: true });
    console.log(JSON.stringify({ command, integrity, health: getAuditHealth() }, null, 2));
    if (!integrity.valid) process.exitCode = 1;
  } else if (command === 'archive') {
    const result = archiveExpiredAuditLogs();
    console.log(JSON.stringify({ command, result, health: getAuditHealth() }, null, 2));
  } else {
    console.error('Usage: node scripts/audit-maintenance.mjs <verify|archive>');
    process.exitCode = 2;
  }
} catch (error) {
  console.error(JSON.stringify({
    command,
    error: String(error?.message || error),
    health: getAuditHealth(),
  }, null, 2));
  process.exitCode = 1;
}

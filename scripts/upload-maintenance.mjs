import { cleanupExpiredUploads } from '../lib/upload-security.js';

try {
  const removed = cleanupExpiredUploads();
  console.log(JSON.stringify({ success: true, removed }));
} catch (error) {
  console.error(JSON.stringify({ success: false, error: String(error?.message || error) }));
  process.exitCode = 1;
}

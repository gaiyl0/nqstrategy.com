import { cleanupExpiredPostAttachments, cleanupExpiredUploads } from '../lib/upload-security.js';

try {
  const removedUploads = cleanupExpiredUploads();
  const removedPostAttachments = cleanupExpiredPostAttachments();
  console.log(JSON.stringify({ success: true, removed: removedUploads + removedPostAttachments, removedUploads, removedPostAttachments }));
} catch (error) {
  console.error(JSON.stringify({ success: false, error: String(error?.message || error) }));
  process.exitCode = 1;
}

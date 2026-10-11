import db from '../lib/db.js';
import { runSearchSubmissions, saveSearchConfig } from '../lib/search-submission-store.js';
try {
  if (process.argv.includes('--enable-indexnow')) {
    saveSearchConfig({ bingEnabled: true });
    console.log('indexnow=enabled; public verification key created');
  } else console.log(JSON.stringify({ success: true, results: await runSearchSubmissions() }));
} catch {
  console.error('SEARCH_WORKER_FAILED: inspect service configuration and database migrations');
  process.exitCode = 1;
} finally { db.close(); }

import { searchConfig } from '@/lib/search-submission-store';
import { withApiErrors } from '@/lib/api-errors';
export const dynamic = 'force-dynamic';
async function GETHandler() {
  const key = searchConfig().bingKey;
  if (!key) return new Response('Not found', { status: 404 });
  return new Response(key, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
export const GET = withApiErrors(GETHandler, { route: '/indexnow-key.txt' });

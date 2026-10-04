import { getPublicPost } from '@/lib/public-post';
import { getPublicProductBySlug } from '@/lib/public-product';
import { socialImage } from '@/app/components/SocialImage';
import crypto from 'node:crypto';
import { withApiErrors } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const cache = new Map();
async function GETHandler(request) {
  const query = new URL(request.url).searchParams;
  const type = query.get('type'); const id = query.get('id');
  const data = type==='article' ? getPublicPost(id) : type==='strategy' ? getPublicProductBySlug(id) : null;
  if (!data) return new Response('分享内容不存在或不可公开访问',{status:404,headers:{'Cache-Control':'no-store'}});
  const key = crypto.createHash('sha256').update(JSON.stringify({type,data})).digest('hex');
  const previous = cache.get(key);
  if (previous && previous.expires>Date.now()) return new Response(previous.bytes,{headers:{'Content-Type':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  const response = await socialImage(type,data);
  const bytes = await response.arrayBuffer();
  if(cache.size>=32) cache.delete(cache.keys().next().value);
  cache.set(key,{bytes,expires:Date.now()+300000});
  return new Response(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export const GET = withApiErrors(GETHandler, { route: '/api/share-image' });

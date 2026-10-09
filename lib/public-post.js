import db from './db.js';
import { forumAccess } from './forum-feature.js';
import { editorialArticleCover } from '../app/components/editorialArticleCover.js';

export function getPublicPost(id) {
  if (!forumAccess().readable) return null;
  if (!/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(Number(id))) return null;
  const post = db.prepare("SELECT id,title,content,author,category,created_at FROM posts WHERE id=? AND moderation_status='visible'").get(Number(id));
  if (!post) return null;
  const attachments = db.prepare("SELECT id,kind,original_name,mime_type,size,stored_name FROM post_attachments WHERE post_id=? AND status IN ('clean','content_validated') ORDER BY id").all(post.id);
  const inlineIds = [...post.content.matchAll(/!\[[^\]]*\]\(\/api\/post-attachments\?id=([1-9]\d*)\)/g)].map(match => Number(match[1]));
  const cover = inlineIds.map(id => attachments.find(item => item.id === id && item.kind === 'image')).find(Boolean) || attachments.find(item => item.kind === 'image');
  const fallbackCoverUrl = `/images/editorial/article-${editorialArticleCover(post)}.webp`;
  return { ...post, attachments, cover, fallbackCoverUrl, coverUrl: cover ? `/api/post-attachments?id=${cover.id}` : fallbackCoverUrl };
}

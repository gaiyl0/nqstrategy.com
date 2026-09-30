import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { categorySchema, createPostSchema, forumSortSchema, idSchema, parseJson, pinSchema, validate, validationErrorResponse } from '@/lib/validation';
import { createSecurityContext } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function GETHandler(request) {
  const { searchParams } = new URL(request.url);
  const rawCategory = searchParams.get('category');
  const rawViewId = searchParams.get('viewId');
  const parsedSort=validate(forumSortSchema,searchParams.get('sort')||'latest');
  if(!parsedSort.success)return validationErrorResponse(parsedSort.error);
  const sort=parsedSort.data;
  let category = rawCategory;
  let viewId = null;
  if (rawCategory && rawCategory !== '全部') {
    const parsedCategory = validate(categorySchema, rawCategory);
    if (!parsedCategory.success) return validationErrorResponse(parsedCategory.error);
    category = parsedCategory.data;
  }
  if (rawViewId !== null) {
    const parsedViewId = validate(idSchema, rawViewId);
    if (!parsedViewId.success) return validationErrorResponse(parsedViewId.error);
    viewId = parsedViewId.data;
  }

  try {
    if (viewId) {
      const currentUser = await getSessionUser();
      const context = createSecurityContext(request, currentUser);
      const viewerKey = currentUser ? `user:${currentUser.id}` : `source:${context.sourceHash}`;
      const windowStart = Math.floor(Date.now() / 21600000) * 21600000;
      const inserted = db.prepare('INSERT OR IGNORE INTO post_view_events(post_id,viewer_key,window_start,created_at) SELECT id,?,?,? FROM posts WHERE id=? AND moderation_status=\'visible\'').run(viewerKey, windowStart, Date.now(), viewId);
      if (inserted.changes === 1) db.prepare("UPDATE posts SET views = views + 1 WHERE id = ?").run(viewId);
      const post = db.prepare("SELECT p.*, u.role as author_role, u.avatar_url FROM posts p LEFT JOIN users u ON p.author_user_id = u.id WHERE p.id = ? AND p.moderation_status='visible'").get(viewId);
      if(!post)return NextResponse.json({success:false,message:'帖子不存在或已被隐藏'},{status:404});
      post.attachments = db.prepare(`SELECT id,kind,original_name,mime_type,size FROM post_attachments WHERE post_id=? ORDER BY id`).all(viewId).map(item => ({
        id: item.id, kind: item.kind, name: item.original_name, mimeType: item.mime_type, size: item.size, url: `/api/post-attachments?id=${item.id}`,
      }));
      return NextResponse.json({ success: true, post });
    }
    const order={latest:'p.is_pinned DESC,p.created_at DESC',discussed:'p.is_pinned DESC,comment_count DESC,p.created_at DESC',hot:'p.is_pinned DESC,hot_score DESC,p.created_at DESC'}[sort];
    const sql=`SELECT p.*,u.role author_role,u.avatar_url,COUNT(c.id) comment_count,
      ROUND((p.views+COUNT(c.id)*5+p.is_pinned*100)/(MAX(2,(julianday('now')-julianday(p.created_at))*24+2)),4) hot_score
      FROM posts p LEFT JOIN users u ON p.author_user_id=u.id LEFT JOIN comments c ON c.post_id=p.id AND c.moderation_status='visible'
      WHERE p.moderation_status='visible' ${category&&category!=='全部'?'AND p.category=?':''}
      GROUP BY p.id ORDER BY ${order}`;
    const posts=category&&category!=='全部'?db.prepare(sql).all(category):db.prepare(sql).all();
    return NextResponse.json({ success: true, posts });
  } catch (error) {
    return NextResponse.json({ success: false, message: '服务异常' }, { status: 500 });
  }
}

async function POSTHandler(request) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) return NextResponse.json({ success: false, message: '请先登录' }, { status: 401 });

    const parsed = await parseJson(request, createPostSchema);
    if (!parsed.success) return parsed.response;
    const { title, content, category, attachments } = parsed.data;
    const referencedImages = [...content.matchAll(/!\[[^\]\n]{0,200}\]\(\/api\/post-attachments\?id=([1-9]\d*)\)/g)].map(match => Number(match[1]));
    if (referencedImages.some(id => !attachments.includes(id))) return NextResponse.json({ success: false, message: '正文中的图片必须属于本次提交的附件' }, { status: 400 });
    const ownedAttachments = attachments.length
      ? db.prepare(`SELECT id,kind FROM post_attachments WHERE owner_user_id=? AND post_id IS NULL AND status IN ('clean','content_validated') AND id IN (${attachments.map(() => '?').join(',')})`).all(currentUser.id, ...attachments)
      : [];
    if (ownedAttachments.length !== attachments.length) return NextResponse.json({ success: false, message: '部分附件不存在、已过期或不属于当前账户，请重新上传' }, { status: 409 });
    const imageIds = new Set(ownedAttachments.filter(item => item.kind === 'image').map(item => item.id));
    if (referencedImages.some(id => !imageIds.has(id))) return NextResponse.json({ success: false, message: '正文图片引用无效' }, { status: 400 });
    const create = db.transaction(() => {
      const result = db.prepare('INSERT INTO posts (title, content, author, author_user_id, category) VALUES (?, ?, ?, ?, ?)')
        .run(title, content, currentUser.username, currentUser.id, category);
      const postId = Number(result.lastInsertRowid);
      const attach = db.prepare('UPDATE post_attachments SET post_id=?,expires_at=NULL WHERE id=? AND owner_user_id=? AND post_id IS NULL');
      for (const attachmentId of attachments) {
        if (attach.run(postId, attachmentId, currentUser.id).changes !== 1) throw new Error('POST_ATTACHMENT_CLAIM_FAILED');
      }
      return postId;
    });
    const postId = create.immediate();
    return NextResponse.json({ success: true, id: postId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: '创建帖子失败' }, { status: 500 });
  }
}

async function PATCHHandler(request) {
  try {
    const currentUser = await getSessionUser();
    if (currentUser?.role !== 'admin') {
      return NextResponse.json({ success: false, message: '仅管理员可置顶帖子' }, { status: currentUser ? 403 : 401 });
    }
    const parsed = await parseJson(request, pinSchema);
    if (!parsed.success) return parsed.response;
    const { id, is_pinned } = parsed.data;
    const result = db.prepare('UPDATE posts SET is_pinned = ? WHERE id = ?').run(is_pinned ? 1 : 0, id);
    if (result.changes !== 1) return NextResponse.json({ success: false, message: '帖子不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: '更新帖子失败' }, { status: 500 });
  }
}

async function DELETEHandler(request) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) return NextResponse.json({ success: false, message: '请先登录' }, { status: 401 });
    const parsedId = validate(idSchema, new URL(request.url).searchParams.get('id'));
    if (!parsedId.success) return validationErrorResponse(parsedId.error);
    const id = parsedId.data;

    const post = db.prepare('SELECT author_user_id FROM posts WHERE id = ?').get(id);
    if (!post) return NextResponse.json({ success: false, message: '帖子不存在' }, { status: 404 });
    if (currentUser.role !== 'admin' && post.author_user_id !== currentUser.id) {
      return NextResponse.json({ success: false, message: '无权删除该帖子' }, { status: 403 });
    }
    const attachmentRows = db.prepare('SELECT stored_name FROM post_attachments WHERE post_id = ?').all(id);
    db.transaction(() => {
      // Detach private files before the post's foreign-key cascade; the maintenance job
      // removes expired rows and their files without leaving public access behind.
      db.prepare('UPDATE post_attachments SET post_id = NULL, expires_at = ? WHERE post_id = ?').run(Date.now(), id);
      db.prepare('DELETE FROM comments WHERE post_id = ?').run(id);
      db.prepare('DELETE FROM posts WHERE id = ?').run(id);
    })();
    for (const attachment of attachmentRows) {
      db.prepare('DELETE FROM post_attachments WHERE stored_name = ? AND post_id IS NULL AND expires_at <= ?').run(attachment.stored_name, Date.now());
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: '删除帖子失败' }, { status: 500 });
  }
}

export const GET = withApiErrors(GETHandler, { route: '/api/posts' });
export const POST = withApiErrors(POSTHandler, { route: '/api/posts' });
export const PATCH = withApiErrors(PATCHHandler, { route: '/api/posts' });
export const DELETE = withApiErrors(DELETEHandler, { route: '/api/posts' });

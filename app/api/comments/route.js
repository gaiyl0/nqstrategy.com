import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { createCommentSchema, idSchema, parseJson, pinSchema, validate, validationErrorResponse } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const parsedPostId = validate(idSchema, new URL(request.url).searchParams.get('postId'));
  if (!parsedPostId.success) return validationErrorResponse(parsedPostId.error);
  const postId = parsedPostId.data;
  try {
    const comments = db.prepare('SELECT c.*, u.role as author_role, u.avatar_url FROM comments c LEFT JOIN users u ON c.author_user_id = u.id WHERE c.post_id = ? ORDER BY c.is_pinned DESC, c.created_at ASC').all(postId);
    return NextResponse.json({ success: true, comments });
  } catch (error) {
    console.error('查询评论异常:', error);
    return NextResponse.json({ success: false, message: '服务异常' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) return NextResponse.json({ success: false, message: '请先登录' }, { status: 401 });
    const parsed = await parseJson(request, createCommentSchema);
    if (!parsed.success) return parsed.response;
    const { postId, content } = parsed.data;
    if (!db.prepare('SELECT id FROM posts WHERE id = ?').get(postId)) {
      return NextResponse.json({ success: false, message: '帖子不存在' }, { status: 404 });
    }
    const result = db.prepare('INSERT INTO comments (post_id, author, author_user_id, content) VALUES (?, ?, ?, ?)')
      .run(postId, currentUser.username, currentUser.id, content);
    return NextResponse.json({ success: true, id: Number(result.lastInsertRowid) }, { status: 201 });
  } catch (error) {
    console.error('创建评论异常:', error);
    return NextResponse.json({ success: false, message: '创建评论失败' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const currentUser = await getSessionUser();
    if (currentUser?.role !== 'admin') {
      return NextResponse.json({ success: false, message: '仅管理员可置顶评论' }, { status: currentUser ? 403 : 401 });
    }
    const parsed = await parseJson(request, pinSchema);
    if (!parsed.success) return parsed.response;
    const { id, is_pinned } = parsed.data;
    const result = db.prepare('UPDATE comments SET is_pinned = ? WHERE id = ?').run(is_pinned ? 1 : 0, id);
    if (result.changes !== 1) return NextResponse.json({ success: false, message: '评论不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('置顶评论异常:', error);
    return NextResponse.json({ success: false, message: '更新评论失败' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) return NextResponse.json({ success: false, message: '请先登录' }, { status: 401 });
    const parsedId = validate(idSchema, new URL(request.url).searchParams.get('id'));
    if (!parsedId.success) return validationErrorResponse(parsedId.error);
    const id = parsedId.data;
    const comment = db.prepare('SELECT author_user_id FROM comments WHERE id = ?').get(id);
    if (!comment) return NextResponse.json({ success: false, message: '评论不存在' }, { status: 404 });
    if (currentUser.role !== 'admin' && comment.author_user_id !== currentUser.id) {
      return NextResponse.json({ success: false, message: '无权删除该评论' }, { status: 403 });
    }
    db.prepare('DELETE FROM comments WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除评论异常:', error);
    return NextResponse.json({ success: false, message: '删除评论失败' }, { status: 500 });
  }
}

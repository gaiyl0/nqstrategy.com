import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { categorySchema, createPostSchema, idSchema, parseJson, pinSchema, validate, validationErrorResponse } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawCategory = searchParams.get('category');
  const rawViewId = searchParams.get('viewId');
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
      db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(viewId);
      const post = db.prepare('SELECT p.*, u.role as author_role, u.avatar_url FROM posts p LEFT JOIN users u ON p.author_user_id = u.id WHERE p.id = ?').get(viewId);
      return NextResponse.json({ success: true, post });
    }

    const posts = category && category !== '全部'
      ? db.prepare('SELECT p.*, u.role as author_role, u.avatar_url FROM posts p LEFT JOIN users u ON p.author_user_id = u.id WHERE p.category = ? ORDER BY p.is_pinned DESC, p.created_at DESC').all(category)
      : db.prepare('SELECT p.*, u.role as author_role, u.avatar_url FROM posts p LEFT JOIN users u ON p.author_user_id = u.id ORDER BY p.is_pinned DESC, p.created_at DESC').all();
    return NextResponse.json({ success: true, posts });
  } catch (error) {
    console.error('查询帖子异常:', error);
    return NextResponse.json({ success: false, message: '服务异常' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) return NextResponse.json({ success: false, message: '请先登录' }, { status: 401 });

    const parsed = await parseJson(request, createPostSchema);
    if (!parsed.success) return parsed.response;
    const { title, content, category } = parsed.data;
    const result = db.prepare('INSERT INTO posts (title, content, author, author_user_id, category) VALUES (?, ?, ?, ?, ?)')
      .run(title, content, currentUser.username, currentUser.id, category);
    return NextResponse.json({ success: true, id: Number(result.lastInsertRowid) }, { status: 201 });
  } catch (error) {
    console.error('创建帖子异常:', error);
    return NextResponse.json({ success: false, message: '创建帖子失败' }, { status: 500 });
  }
}

export async function PATCH(request) {
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
    console.error('置顶帖子异常:', error);
    return NextResponse.json({ success: false, message: '更新帖子失败' }, { status: 500 });
  }
}

export async function DELETE(request) {
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
    db.transaction(() => {
      db.prepare('DELETE FROM comments WHERE post_id = ?').run(id);
      db.prepare('DELETE FROM posts WHERE id = ?').run(id);
    })();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除帖子异常:', error);
    return NextResponse.json({ success: false, message: '删除帖子失败' }, { status: 500 });
  }
}

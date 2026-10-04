import db from './db.js';

export function listForumPosts({ category = '全部', sort = 'latest', page = 1, pageSize = 12, q = '' }) {
  const conditions = ["p.moderation_status='visible'"];
  const params = [];
  if (category !== '全部') { conditions.push('p.category=?'); params.push(category); }
  if (q) {
    conditions.push("(p.title LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\' OR p.author LIKE ? ESCAPE '\\')");
    const pattern = `%${q.replace(/[\\%_]/g, value => '\\' + value)}%`;
    params.push(pattern, pattern, pattern);
  }
  const where = conditions.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) total FROM posts p WHERE ${where}`).get(...params).total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const order = { latest: 'p.is_pinned DESC,p.created_at DESC,p.id DESC', discussed: 'p.is_pinned DESC,comment_count DESC,p.created_at DESC,p.id DESC', hot: 'p.is_pinned DESC,hot_score DESC,p.created_at DESC,p.id DESC' }[sort];
  const posts = db.prepare(`SELECT p.*,u.role author_role,u.avatar_url,COUNT(c.id) comment_count,
    ROUND((p.views+COUNT(c.id)*5+p.is_pinned*100)/(MAX(2,(julianday('now')-julianday(p.created_at))*24+2)),4) hot_score
    FROM posts p LEFT JOIN users u ON p.author_user_id=u.id LEFT JOIN comments c ON c.post_id=p.id AND c.moderation_status='visible'
    WHERE ${where} GROUP BY p.id ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params, pageSize, (currentPage - 1) * pageSize);
  return { posts, pagination: { page: currentPage, pageSize, total, totalPages } };
}

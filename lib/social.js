import db from './db.js';
import { awardDailyAction } from './points.js';

export function productSocialSummary(productId, viewerUserId = null) {
  const aggregate = db.prepare('SELECT COUNT(*) rating_count, ROUND(AVG(rating),2) rating_average FROM product_ratings WHERE product_id=?').get(productId);
  const favoriteCount = db.prepare('SELECT COUNT(*) count FROM product_favorites WHERE product_id=?').get(productId).count;
  const product = db.prepare('SELECT author_user_id FROM products WHERE id=?').get(productId);
  const followerCount = product?.author_user_id ? db.prepare('SELECT COUNT(*) count FROM developer_follows WHERE developer_user_id=?').get(product.author_user_id).count : 0;
  const viewer = viewerUserId ? {
    favorite: Boolean(db.prepare('SELECT 1 FROM product_favorites WHERE user_id=? AND product_id=?').get(viewerUserId,productId)),
    followingAuthor: Boolean(product?.author_user_id && db.prepare('SELECT 1 FROM developer_follows WHERE follower_user_id=? AND developer_user_id=?').get(viewerUserId,product.author_user_id)),
    rating: db.prepare('SELECT rating,review_text reviewText,updated_at updatedAt FROM product_ratings WHERE user_id=? AND product_id=?').get(viewerUserId,productId) || null,
  } : null;
  return { ratingAverage:aggregate.rating_average ?? null,ratingCount:aggregate.rating_count,favoriteCount,followerCount,viewer };
}

export function listSocialState(userId) {
  const favorites=db.prepare(`SELECT p.id,p.title,p.author,p.logo_url,p.price,p.status,pf.created_at createdAt FROM product_favorites pf JOIN products p ON p.id=pf.product_id WHERE pf.user_id=? AND p.deleted_at IS NULL AND p.status='active' ORDER BY pf.created_at DESC`).all(userId);
  const follows=db.prepare(`SELECT u.id developerUserId,u.username,df.created_at createdAt,(SELECT COUNT(*) FROM products p WHERE p.author_user_id=u.id AND p.status='active') activeProducts FROM developer_follows df JOIN users u ON u.id=df.developer_user_id WHERE df.follower_user_id=? AND u.deleted_at IS NULL ORDER BY df.created_at DESC`).all(userId);
  const ratings=db.prepare(`SELECT pr.product_id productId,p.title,pr.rating,pr.review_text reviewText,pr.updated_at updatedAt FROM product_ratings pr JOIN products p ON p.id=pr.product_id WHERE pr.user_id=? ORDER BY pr.updated_at DESC`).all(userId);
  return {favorites,follows,ratings};
}

function activeProduct(productId){const product=db.prepare("SELECT id,author_user_id FROM products WHERE id=? AND status='active'").get(productId);if(!product)throw new Error('PRODUCT_UNAVAILABLE');return product;}
export function setFavorite(userId,productId,enabled){activeProduct(productId);const now=Date.now();if(enabled)db.prepare('INSERT INTO product_favorites(user_id,product_id,created_at) VALUES(?,?,?) ON CONFLICT(user_id,product_id) DO NOTHING').run(userId,productId,now);else db.prepare('DELETE FROM product_favorites WHERE user_id=? AND product_id=?').run(userId,productId);return {enabled:Boolean(enabled),replayed:false};}
export function setFollow(userId,developerUserId,enabled){if(userId===developerUserId)throw new Error('SELF_FOLLOW');const developer=db.prepare("SELECT id FROM users WHERE id=? AND deleted_at IS NULL AND role IN ('developer','admin')").get(developerUserId);if(!developer)throw new Error('DEVELOPER_UNAVAILABLE');const now=Date.now();if(enabled)db.prepare('INSERT INTO developer_follows(follower_user_id,developer_user_id,created_at) VALUES(?,?,?) ON CONFLICT(follower_user_id,developer_user_id) DO NOTHING').run(userId,developerUserId,now);else db.prepare('DELETE FROM developer_follows WHERE follower_user_id=? AND developer_user_id=?').run(userId,developerUserId);return {enabled:Boolean(enabled)};}
export function setRating(userId,productId,rating,reviewText=''){const product=activeProduct(productId);if(product.author_user_id===userId)throw new Error('SELF_RATING');const eligible=db.prepare("SELECT 1 FROM product_licenses WHERE user_id=? AND product_id=? AND license_type IN ('purchase','free') AND status='active' AND expires_at IS NULL").get(userId,productId);if(!eligible)throw new Error('PERMANENT_LICENSE_REQUIRED');const now=Date.now();return db.transaction(()=>{db.prepare(`INSERT INTO product_ratings(user_id,product_id,rating,review_text,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET rating=excluded.rating,review_text=excluded.review_text,updated_at=excluded.updated_at`).run(userId,productId,rating,reviewText,now,now);awardDailyAction(userId,'daily_rating',productId,now);return {rating,reviewText,updatedAt:now};}).immediate();}

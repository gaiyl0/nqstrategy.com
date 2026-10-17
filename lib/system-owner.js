import db from './db.js';

export function isSystemOwner(user) {
  return Boolean(user?.role==='admin' && db.prepare("SELECT 1 FROM system_owners o JOIN users u ON u.id=o.user_id WHERE o.user_id=? AND u.role='admin' AND u.deleted_at IS NULL").get(user.id));
}

export function requireSystemOwner(user) {
  if(!isSystemOwner(user))throw Error('SYSTEM_OWNER_REQUIRED');
}

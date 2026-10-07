import db from './db.js';

export function notifyUser(userId,kind,title,body='',targetPath='',now=Date.now()) {
  if (!/^\/(?:\?|[a-z0-9/?=&-]*)$/i.test(targetPath) && targetPath !== '') throw new Error('NOTIFICATION_TARGET_INVALID');
  return Number(db.prepare('INSERT INTO user_notifications(user_id,kind,title,body,target_path,created_at) VALUES(?,?,?,?,?,?)')
    .run(userId,kind,title,body,targetPath,now).lastInsertRowid);
}

export function notificationState(userId,beforeId=null,limit=30) {
  const unread=db.prepare('SELECT COUNT(*) count FROM user_notifications WHERE user_id=? AND read_at IS NULL').get(userId).count;
  const items=db.prepare(`SELECT id,kind,title,body,target_path targetPath,read_at readAt,created_at createdAt
    FROM user_notifications WHERE user_id=? AND (? IS NULL OR id<?) ORDER BY id DESC LIMIT ?`).all(userId,beforeId,beforeId,limit);
  return {unread,items,nextCursor:items.length===limit?items.at(-1).id:null};
}

export function readNotification(userId,id,now=Date.now()) {
  const result=db.prepare('UPDATE user_notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?').run(now,id,userId);
  if(!result.changes)throw new Error('NOTIFICATION_NOT_FOUND');
}

export function messageThreads(userId) {
  return db.prepare(`WITH ranked AS (
    SELECT id,body,created_at,CASE WHEN sender_user_id=? THEN recipient_user_id ELSE sender_user_id END peer_id,
      ROW_NUMBER() OVER (PARTITION BY CASE WHEN sender_user_id=? THEN recipient_user_id ELSE sender_user_id END ORDER BY id DESC) position
    FROM direct_messages WHERE sender_user_id=? OR recipient_user_id=?
  ) SELECT ranked.peer_id peerId,u.username,ranked.body lastMessage,ranked.created_at lastAt,
    (SELECT COUNT(*) FROM direct_messages unread WHERE unread.sender_user_id=ranked.peer_id AND unread.recipient_user_id=? AND unread.read_at IS NULL) unread
    FROM ranked JOIN users u ON u.id=ranked.peer_id WHERE ranked.position=1 AND u.deleted_at IS NULL
    ORDER BY ranked.id DESC LIMIT 100`).all(userId,userId,userId,userId,userId);
}

export function messageConversation(userId,peerId,beforeId=null,limit=30) {
  const peer=db.prepare("SELECT id,username FROM users WHERE id=? AND deleted_at IS NULL AND role<>'banned'").get(peerId);
  if(!peer)throw new Error('RECIPIENT_UNAVAILABLE');
  const items=db.prepare(`SELECT id,sender_user_id senderId,recipient_user_id recipientId,body,read_at readAt,created_at createdAt
    FROM direct_messages WHERE ((sender_user_id=? AND recipient_user_id=?) OR (sender_user_id=? AND recipient_user_id=?))
    AND (? IS NULL OR id<?) ORDER BY id DESC LIMIT ?`).all(userId,peerId,peerId,userId,beforeId,beforeId,limit);
  return {peer,items:items.reverse(),nextCursor:items.length===limit?items[0].id:null,
    blocked:Boolean(db.prepare('SELECT 1 FROM message_blocks WHERE blocker_user_id=? AND blocked_user_id=?').get(userId,peerId))};
}

export function sendMessage(senderId,recipientUsername,body,now=Date.now()) {
  return db.transaction(()=>{
    const recipient=db.prepare("SELECT id,username FROM users WHERE username=? COLLATE NOCASE AND deleted_at IS NULL AND role<>'banned'").get(recipientUsername);
    if(!recipient)throw new Error('RECIPIENT_UNAVAILABLE');
    if(recipient.id===senderId)throw new Error('SELF_MESSAGE');
    if(db.prepare('SELECT 1 FROM message_blocks WHERE (blocker_user_id=? AND blocked_user_id=?) OR (blocker_user_id=? AND blocked_user_id=?)').get(senderId,recipient.id,recipient.id,senderId))throw new Error('MESSAGE_BLOCKED');
    const id=Number(db.prepare('INSERT INTO direct_messages(sender_user_id,recipient_user_id,body,created_at) VALUES(?,?,?,?)').run(senderId,recipient.id,body,now).lastInsertRowid);
    const sender=db.prepare('SELECT username FROM users WHERE id=?').get(senderId);
    notifyUser(recipient.id,'message',`来自 ${sender.username} 的私信`,'你收到一条新私信。','/?route=inbox',now);
    return {id,recipientId:recipient.id};
  }).immediate();
}

export function readConversation(userId,peerId,now=Date.now()) {
  db.prepare('UPDATE direct_messages SET read_at=? WHERE recipient_user_id=? AND sender_user_id=? AND read_at IS NULL').run(now,userId,peerId);
}

export function setMessageBlock(userId,peerId,blocked,now=Date.now()) {
  if(userId===peerId)throw new Error('SELF_MESSAGE');
  const peer=db.prepare('SELECT id FROM users WHERE id=? AND deleted_at IS NULL').get(peerId);
  if(!peer)throw new Error('RECIPIENT_UNAVAILABLE');
  if(blocked)db.prepare('INSERT OR IGNORE INTO message_blocks(blocker_user_id,blocked_user_id,created_at) VALUES(?,?,?)').run(userId,peerId,now);
  else db.prepare('DELETE FROM message_blocks WHERE blocker_user_id=? AND blocked_user_id=?').run(userId,peerId);
}

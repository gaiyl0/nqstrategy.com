export const version = 11;
export const name = 'notifications-and-messages';
export const checksum = '915d8b5dc340fbeffc641dfb21984b7b92adf210645240fa6c5238b0024fc349';

export function up(db) {
  db.exec(`
    CREATE TABLE user_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      kind TEXT NOT NULL CHECK (length(kind) BETWEEN 2 AND 40),
      title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
      body TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 500),
      target_path TEXT NOT NULL DEFAULT '' CHECK (length(target_path) <= 200),
      read_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_user_notifications_user_time ON user_notifications(user_id,id DESC);
    CREATE INDEX idx_user_notifications_unread ON user_notifications(user_id,read_at,id DESC);

    CREATE TABLE direct_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
      read_at INTEGER,
      created_at INTEGER NOT NULL,
      CHECK (sender_user_id <> recipient_user_id)
    );
    CREATE INDEX idx_direct_messages_sender_time ON direct_messages(sender_user_id,id DESC);
    CREATE INDEX idx_direct_messages_recipient_time ON direct_messages(recipient_user_id,id DESC);
    CREATE INDEX idx_direct_messages_conversation ON direct_messages(sender_user_id,recipient_user_id,id DESC);

    CREATE TABLE message_blocks (
      blocker_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      blocked_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(blocker_user_id,blocked_user_id),
      CHECK (blocker_user_id <> blocked_user_id)
    );
  `);
}

export const version = 9;
export const name = 'second-ad-button';
export const checksum = '5d83cedafe3dd8cf9062c35af6d6e02278f5e5e09cae8023a115fbf8b5284fd6';

export function up(db) {
  db.exec(`
    CREATE TABLE ad_click_events_next (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot TEXT NOT NULL CHECK (slot IN ('exchange_home','exchange_home_2')),
      visitor_hash TEXT NOT NULL CHECK (length(visitor_hash) = 64),
      destination_host TEXT NOT NULL CHECK (length(destination_host) BETWEEN 1 AND 253),
      referrer_host TEXT CHECK (referrer_host IS NULL OR length(referrer_host) <= 253),
      user_agent TEXT CHECK (user_agent IS NULL OR length(user_agent) <= 300),
      is_bot INTEGER NOT NULL DEFAULT 0 CHECK (is_bot IN (0, 1)),
      bot_name TEXT CHECK (bot_name IS NULL OR length(bot_name) <= 80),
      occurred_at INTEGER NOT NULL,
      traffic_kind TEXT NOT NULL DEFAULT 'legacy' CHECK (traffic_kind IN ('legacy','browser','spider','unknown')),
      classification_reason TEXT
    );
    INSERT INTO ad_click_events_next
      (id,slot,visitor_hash,destination_host,referrer_host,user_agent,is_bot,bot_name,occurred_at,traffic_kind,classification_reason)
    SELECT id,slot,visitor_hash,destination_host,referrer_host,user_agent,is_bot,bot_name,occurred_at,traffic_kind,classification_reason
      FROM ad_click_events;
    DROP TABLE ad_click_events;
    ALTER TABLE ad_click_events_next RENAME TO ad_click_events;
    CREATE INDEX idx_ad_click_events_slot_time ON ad_click_events(slot, occurred_at DESC);
    CREATE INDEX idx_ad_click_events_bot_time ON ad_click_events(is_bot, occurred_at DESC);
    CREATE INDEX idx_ad_click_events_kind_time ON ad_click_events(traffic_kind, occurred_at DESC);
  `);
}

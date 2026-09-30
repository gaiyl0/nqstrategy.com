export const version = 5;
export const name = 'site-analytics';
export const checksum = 'de3c35d09329ddfd2173c2f6510f7aa54a53d0ca6248d0a2c762535ff0cfe87c';

export function up(db) {
  db.exec(`
    CREATE TABLE site_visit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_hash TEXT NOT NULL CHECK (length(visitor_hash) = 64),
      path TEXT NOT NULL CHECK (length(path) BETWEEN 1 AND 300),
      referrer_host TEXT CHECK (referrer_host IS NULL OR length(referrer_host) <= 253),
      user_agent TEXT CHECK (user_agent IS NULL OR length(user_agent) <= 300),
      is_bot INTEGER NOT NULL DEFAULT 0 CHECK (is_bot IN (0, 1)),
      bot_name TEXT CHECK (bot_name IS NULL OR length(bot_name) <= 80),
      occurred_at INTEGER NOT NULL
    );
    CREATE INDEX idx_site_visit_events_time ON site_visit_events(occurred_at DESC);
    CREATE INDEX idx_site_visit_events_bot_time ON site_visit_events(is_bot, occurred_at DESC);
    CREATE INDEX idx_site_visit_events_path_time ON site_visit_events(path, occurred_at DESC);

    CREATE TABLE ad_click_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot TEXT NOT NULL CHECK (slot IN ('exchange_home')),
      visitor_hash TEXT NOT NULL CHECK (length(visitor_hash) = 64),
      destination_host TEXT NOT NULL CHECK (length(destination_host) BETWEEN 1 AND 253),
      referrer_host TEXT CHECK (referrer_host IS NULL OR length(referrer_host) <= 253),
      user_agent TEXT CHECK (user_agent IS NULL OR length(user_agent) <= 300),
      is_bot INTEGER NOT NULL DEFAULT 0 CHECK (is_bot IN (0, 1)),
      bot_name TEXT CHECK (bot_name IS NULL OR length(bot_name) <= 80),
      occurred_at INTEGER NOT NULL
    );
    CREATE INDEX idx_ad_click_events_slot_time ON ad_click_events(slot, occurred_at DESC);
    CREATE INDEX idx_ad_click_events_bot_time ON ad_click_events(is_bot, occurred_at DESC);
  `);
}

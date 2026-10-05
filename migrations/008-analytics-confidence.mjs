export const version = 8;
export const name = 'analytics-confidence';
export const checksum = 'b787f73a9a5e462c7f9fb1dc1732d6590a44590c9e815d8c46cfb5dc44e55b8c';

export function up(db) {
  for (const table of ['site_visit_events', 'ad_click_events']) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN traffic_kind TEXT NOT NULL DEFAULT 'legacy' CHECK(traffic_kind IN ('legacy','browser','spider','unknown'));
      ALTER TABLE ${table} ADD COLUMN classification_reason TEXT;
      CREATE INDEX idx_${table}_kind_time ON ${table}(traffic_kind,occurred_at DESC);`);
  }
  db.exec(`ALTER TABLE site_visit_events ADD COLUMN proof_id TEXT;
    CREATE UNIQUE INDEX idx_site_visit_proof ON site_visit_events(proof_id) WHERE proof_id IS NOT NULL;
    CREATE INDEX idx_site_visit_dedup ON site_visit_events(visitor_hash,path,occurred_at DESC);`);
}

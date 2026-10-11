export const version = 16;
export const name = 'search-submissions';
export const checksum = '5bcf1c6be3e47f07b2bf77696b7511bd5b7f9eb6b4d37d1e526db40f0a119d2d';
export function up(db) {
  db.exec(`CREATE TABLE search_submissions (
    engine TEXT NOT NULL, url TEXT NOT NULL, fingerprint TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
    next_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0,
    lease_token TEXT, last_error TEXT, submitted_at TEXT, updated_at TEXT NOT NULL,
    PRIMARY KEY(engine,url)
  ); CREATE INDEX search_submissions_due ON search_submissions(engine,state,next_at);`);
}

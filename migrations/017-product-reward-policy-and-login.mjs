export const version = 17;
export const name = 'product-reward-policy-and-login';
export const checksum = '1fd772adf09c53c92f56554428a75bd8d9677404957c7ae22d32cc2205354ff5';
export function up(db) {
  db.exec(`ALTER TABLE users ADD COLUMN last_login_at INTEGER;
    ALTER TABLE products ADD COLUMN allow_bonus_points INTEGER NOT NULL DEFAULT 1 CHECK(allow_bonus_points IN (0,1));`);
}

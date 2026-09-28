export const version = 3;
export const name = 'users-schema-convergence';
export const checksum = '54709951ac4f6cfa93a7d53e796a074ee56f0dd1b122aeacc077becbe3b40d1c';
export const requiresForeignKeysOff = true;

const preflightChecks = [
  ['USERS_USERNAME_REQUIRED', "username IS NULL OR trim(username)=''"],
  ['USERS_EMAIL_REQUIRED', "email IS NULL OR trim(email)=''"],
  ['USERS_PASSWORD_REQUIRED', "password IS NULL OR trim(password)=''"],
  ['USERS_ROLE_INVALID', "role IS NULL OR role NOT IN ('user','developer','admin','banned')"],
  ['USERS_EMAIL_VERIFIED_INVALID', 'email_verified IS NULL OR email_verified NOT IN (0,1)'],
  ['USERS_JOIN_DATE_REQUIRED', 'join_date IS NULL'],
  ['USERS_BALANCE_INVALID', 'balance IS NULL OR balance<0 OR abs(balance*100-round(balance*100))>0.0000001'],
  ['USERS_SESSION_VERSION_INVALID', 'session_version IS NULL OR session_version<1'],
  ['USERS_PASSWORD_RESET_INVALID', 'password_reset_required IS NULL OR password_reset_required NOT IN (0,1)'],
];

export function up(db) {
  for (const [code, predicate] of preflightChecks) {
    const count=db.prepare(`SELECT COUNT(*) count FROM users WHERE ${predicate}`).get().count;
    if(count)throw new Error(`${code}:${count}`);
  }
  const duplicateUsername=db.prepare("SELECT COUNT(*) count FROM (SELECT lower(username) key FROM users GROUP BY key HAVING COUNT(*)>1)").get().count;
  if(duplicateUsername)throw new Error(`USERS_USERNAME_DUPLICATE_CASE_INSENSITIVE:${duplicateUsername}`);
  const duplicateEmail=db.prepare("SELECT COUNT(*) count FROM (SELECT lower(email) key FROM users GROUP BY key HAVING COUNT(*)>1)").get().count;
  if(duplicateEmail)throw new Error(`USERS_EMAIL_DUPLICATE_CASE_INSENSITIVE:${duplicateEmail}`);

  db.exec(`
    CREATE TABLE users_v3 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT COLLATE NOCASE NOT NULL UNIQUE CHECK (trim(username)<>''),
      email TEXT COLLATE NOCASE NOT NULL UNIQUE CHECK (trim(email)<>''),
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','developer','admin','banned')),
      email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0,1)),
      join_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      password TEXT NOT NULL CHECK (trim(password)<>''),
      avatar_url TEXT,
      balance REAL NOT NULL DEFAULT 0 CHECK (balance>=0 AND abs(balance*100-round(balance*100))<=0.0000001),
      session_version INTEGER NOT NULL DEFAULT 1 CHECK (session_version>=1),
      deleted_at DATETIME,
      password_reset_required INTEGER NOT NULL DEFAULT 0 CHECK (password_reset_required IN (0,1))
    );
    INSERT INTO users_v3
      (id,username,email,role,email_verified,join_date,password,avatar_url,balance,session_version,deleted_at,password_reset_required)
    SELECT id,username,email,role,email_verified,join_date,password,avatar_url,balance,session_version,deleted_at,password_reset_required
      FROM users;
    DROP TABLE users;
    ALTER TABLE users_v3 RENAME TO users;

    CREATE TRIGGER users_balance_block_nonzero_insert
    BEFORE INSERT ON users
    WHEN NEW.balance != 0 AND wallet_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'user balance requires wallet ledger'); END;
    CREATE TRIGGER users_balance_block_update
    BEFORE UPDATE OF balance ON users
    WHEN NEW.balance != OLD.balance AND wallet_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'user balance requires wallet ledger'); END;
  `);
}

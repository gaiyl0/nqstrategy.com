import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import db from './db';

const TOKEN_COOKIE_NAME = 'nexus_token';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// A real, fixed scrypt hash makes an unknown-account login pay the same
// password-verification cost as a known scrypt account. It is not a credential.
const DUMMY_PASSWORD_HASH = 'scrypt$0123456789abcdef0123456789abcdef$9ebd8b8085111a10cc20c4df63a78046db17d28cca33c17c266e69571a929a80987fdb5bf549c0051063366c9153071ecfcd7ef589b4cb25cfe764f32df195d3';

function getSessionSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured with at least 32 characters in production');
  }

  if (!globalThis.__nexusDevSessionSecret) {
    globalThis.__nexusDevSessionSecret = crypto.randomBytes(48).toString('base64url');
    console.warn('JWT_SECRET is not configured; using an ephemeral development-only session secret.');
  }
  return globalThis.__nexusDevSessionSecret;
}

if (process.env.NODE_ENV === 'production') {
  getSessionSecret();
}

function verifyScrypt(plainPassword, salt, keyHex) {
  return new Promise((resolve) => {
    crypto.scrypt(plainPassword, salt, 64, (err, derivedKey) => {
      if (err) return resolve(false);
      try {
        const storedKeyBuffer = Buffer.from(keyHex, 'hex');
        if (storedKeyBuffer.length !== derivedKey.length) return resolve(false);
        resolve(crypto.timingSafeEqual(storedKeyBuffer, derivedKey));
      } catch {
        resolve(false);
      }
    });
  });
}

// 1. 使用原生 scrypt 算法生成安全哈希
export async function hashPassword(plainPassword) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(String(plainPassword).trim(), salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

// 2. 仅接受明确的密码哈希格式；绝不回退到明文比较
export async function verifyPassword(plainPassword, storedPassword) {
  if (storedPassword === null || storedPassword === undefined) return false;

  const sPlain = String(plainPassword).trim();
  const sStored = String(storedPassword).trim();

  if (sStored.startsWith('scrypt$')) {
    const parts = sStored.split('$');
    if (parts.length !== 3) return false;
    return verifyScrypt(sPlain, parts[1], parts[2]);
  }

  // 兼容已经存在的 salt:keyHex scrypt 记录，登录成功后升级为带版本前缀的格式。
  if (/^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(sStored)) {
    const [salt, keyHex] = sStored.split(':');
    return verifyScrypt(sPlain, salt, keyHex);
  }

  // 兼容旧 bcrypt 记录，登录成功后升级为 scrypt。
  if (/^\$2[aby]\$/.test(sStored)) {
    try {
      return await bcrypt.compare(sPlain, sStored);
    } catch {
      return false;
    }
  }

  return false;
}

export function verifyPasswordOrDummy(plainPassword, storedPassword) {
  return verifyPassword(plainPassword, storedPassword || DUMMY_PASSWORD_HASH);
}

export function needsPasswordRehash(storedPassword) {
  return !String(storedPassword || '').startsWith('scrypt$');
}

// 3. 签发 HttpOnly Session
export async function createSession(user) {
  const payload = {
    id: user.id,
    sv: Number(user.session_version) || 1,
    exp: Date.now() + SESSION_TTL_MS,
  };

  const dataStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(dataStr).digest('base64url');
  const token = `${dataStr}.${signature}`;

  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
    priority: 'high',
  });

  return token;
}

// 4. 注销 Session
export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE_NAME);
}

// 5. 获取真实登录者
export async function getSessionUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(TOKEN_COOKIE_NAME)?.value;
    if (!token || !token.includes('.')) return null;

    const [dataStr, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(dataStr).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(dataStr, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) return null;

    const currentUser = db.prepare(
      `SELECT id, username, email, role, balance, avatar_url, email_verified, join_date, session_version
       FROM users
       WHERE id = ? AND deleted_at IS NULL AND password_reset_required = 0`
    ).get(payload.id);

    const tokenSessionVersion = Number(payload.sv);
    const currentSessionVersion = Number(currentUser?.session_version);
    if (!currentUser || !Number.isInteger(tokenSessionVersion) || tokenSessionVersion !== currentSessionVersion) {
      return null;
    }

    return currentUser;
  } catch (error) {
    return null;
  }
}

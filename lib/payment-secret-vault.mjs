import crypto from 'node:crypto';

function encryptionKey(env) {
  const secret = env.PAYMENT_SECRET_ENCRYPTION_KEY || env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('PAYMENT_SECRET_ENCRYPTION_UNAVAILABLE');
  return crypto.createHash('sha256').update(`nexus-payment-vault:v1:${secret}`).digest();
}

export function encryptPaymentSecret(value, name, env = process.env) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(env), iv);
  cipher.setAAD(Buffer.from(name));
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptPaymentSecret(value, name, env = process.env) {
  const [version, iv, tag, data, extra] = String(value).split('.');
  if (version !== 'v1' || !iv || !tag || !data || extra) throw new Error('PAYMENT_SECRET_INVALID');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(env), Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from(name));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

export function normalizeAlipayKey(value, privateKey = false) {
  let pem = String(value).trim().replaceAll('\\n', '\n');
  if (!pem.includes('-----BEGIN')) {
    const type = privateKey ? 'PRIVATE KEY' : 'PUBLIC KEY';
    pem = `-----BEGIN ${type}-----\n${pem.replace(/\s/g, '').match(/.{1,64}/g)?.join('\n') || ''}\n-----END ${type}-----`;
  }
  try {
    let key;
    try { key = privateKey ? crypto.createPrivateKey(pem) : crypto.createPublicKey(pem); }
    catch (error) {
      if (!privateKey || String(value).includes('-----BEGIN')) throw error;
      key = crypto.createPrivateKey(pem.replaceAll('PRIVATE KEY', 'RSA PRIVATE KEY'));
    }
    if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 2048) throw new Error();
    return key.export({ type: privateKey ? 'pkcs8' : 'spki', format: 'pem' }).toString();
  } catch { throw new Error(privateKey ? '应用私钥格式无效，请使用 RSA2 的 2048 位或以上私钥' : '公钥格式无效，请使用 RSA2 公钥'); }
}

import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { parseJson } from '@/lib/validation';
import { withApiErrors } from '@/lib/api-errors';
import { createSecurityContext, writeAudit } from '@/lib/security';
import { normalizeAlipayKey } from '@/lib/payment-secret-vault.mjs';
import { readPaymentSecret, savePaymentSecrets, paymentSecretConfigured } from '@/lib/payment-secret-store';

const schema = z.object({
  privateKey: z.string().trim().max(16000).optional(),
  publicKey: z.string().trim().max(16000).optional(),
  appPublicKey: z.string().trim().max(16000).optional(),
}).strict().refine(value => Boolean(value.privateKey || value.publicKey || value.appPublicKey), '请至少填写一项密钥');

async function POSTHandler(request) {
  const user = await getSessionUser();
  if (user?.role !== 'admin') return NextResponse.json({ message: '仅管理员可以配置支付密钥' }, { status: 403 });
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return parsed.response;
  try {
    const values = {};
    if (parsed.data.privateKey) values.ALIPAY_APP_PRIVATE_KEY = normalizeAlipayKey(parsed.data.privateKey, true);
    if (parsed.data.publicKey) values.ALIPAY_PUBLIC_KEY = normalizeAlipayKey(parsed.data.publicKey);
    if (parsed.data.appPublicKey) values.ALIPAY_APP_PUBLIC_KEY = normalizeAlipayKey(parsed.data.appPublicKey);
    const appPublic = values.ALIPAY_APP_PUBLIC_KEY || readPaymentSecret('ALIPAY_APP_PUBLIC_KEY');
    const appPrivate = values.ALIPAY_APP_PRIVATE_KEY || readPaymentSecret('ALIPAY_APP_PRIVATE_KEY');
    if (appPublic && appPrivate) {
      const derived = crypto.createPublicKey(appPrivate).export({ type: 'spki', format: 'pem' });
      if (derived.trim() !== normalizeAlipayKey(appPublic).trim()) return NextResponse.json({ message: '应用公钥与应用私钥不匹配，请填写同一组密钥' }, { status: 400 });
    }
    savePaymentSecrets(values);
    writeAudit(createSecurityContext(request), { eventType: 'payment.keys.updated', outcome: 'success',
      reasonCode: 'ADMIN_ALIPAY_KEYS_SAVED', userId: user.id, actorRole: user.role,
      targetType: 'payment_channel', targetId: 'alipay', metadata: { updatedFields: Object.keys(values) } });
    return NextResponse.json({ success: true,
      alipayAppPrivateKeyConfigured: paymentSecretConfigured('ALIPAY_APP_PRIVATE_KEY'),
      alipayPublicKeyConfigured: paymentSecretConfigured('ALIPAY_PUBLIC_KEY'),
      alipayAppPublicKeyConfigured: paymentSecretConfigured('ALIPAY_APP_PUBLIC_KEY'),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = ['应用私钥格式无效，请使用 RSA2 的 2048 位或以上私钥', '公钥格式无效，请使用 RSA2 公钥'].includes(error.message)
      ? error.message : '密钥保存失败，请检查服务器加密配置';
    return NextResponse.json({ message }, { status: 400 });
  }
}
export const POST = withApiErrors(POSTHandler, { route: '/api/settings/alipay-keys' });

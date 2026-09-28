import db from './db.js';

export const VERIFICATION_LEVELS = ['unverified','screenshot_reviewed','report_verified','reproducible_backtest','platform_rerun','live_verified'];
const rank = Object.fromEntries(VERIFICATION_LEVELS.map((level,index)=>[level,index]));

function parse(value) { try { return JSON.parse(value || '{}'); } catch { return {}; } }

export function verificationDto(row, { includePrivate = false } = {}) {
  if (!row) return { level:'unverified',status:'active',expired:false,verifiedAt:null,lastCheckedAt:null,expiresAt:null,evidence:{} };
  const evidence = parse(row.evidence_json);
  const expired = Boolean(row.expires_at && row.expires_at <= Date.now());
  const publicEvidence = {
    source: evidence.source || null, parserVersion: evidence.parserVersion || null,
    reportSha256Prefix: evidence.reportSha256 ? `${evidence.reportSha256.slice(0,16)}…` : null,
    observedDays: evidence.observedDays || null, provider: evidence.provider || null,
    accountMasked: evidence.accountMasked || null, accessMode: evidence.accessMode || null,
    lastCheckedDate: evidence.lastCheckedDate || null, maxDrawdownPercent: evidence.maxDrawdownPercent ?? null,
    terminalBuild: evidence.terminalBuild || null, dataset: evidence.dataset || null,
  };
  return {
    level: row.status === 'revoked' || expired ? 'unverified' : row.level,
    status: row.status,
    expired,
    verifiedAt:row.verified_at,
    lastCheckedAt:row.last_checked_at,
    expiresAt:row.expires_at,
    evidence:includePrivate ? evidence : publicEvidence,
    ...(includePrivate ? { recordedLevel:row.level,revocationReason:row.revocation_reason } : {}),
  };
}

export function getVerification(productId, options) {
  return verificationDto(db.prepare('SELECT * FROM strategy_verifications WHERE product_id=?').get(productId), options);
}

export function getVerificationHistory(productId) {
  return db.prepare('SELECT * FROM strategy_verification_history WHERE product_id=? ORDER BY id DESC LIMIT 100').all(productId).map(row=>({ id:row.id,previousLevel:row.previous_level,newLevel:row.new_level,action:row.action,evidence:parse(row.evidence_json),reason:row.reason,actorUserId:row.actor_user_id,createdAt:row.created_at }));
}

function writeVerification(productId, newLevel, evidence, actorUserId, action, { expiresAt = null, reason = null } = {}) {
  const current = db.prepare('SELECT * FROM strategy_verifications WHERE product_id=?').get(productId);
  const previousLevel = current?.level || 'unverified'; const now = Date.now();
  db.prepare(`INSERT INTO strategy_verifications(product_id,level,status,evidence_json,verified_at,verified_by_user_id,expires_at,last_checked_at,revoked_at,revocation_reason)
    VALUES(?,?,'active',?,?,?,?,?,NULL,NULL)
    ON CONFLICT(product_id) DO UPDATE SET level=excluded.level,status='active',evidence_json=excluded.evidence_json,verified_at=excluded.verified_at,verified_by_user_id=excluded.verified_by_user_id,expires_at=excluded.expires_at,last_checked_at=excluded.last_checked_at,revoked_at=NULL,revocation_reason=NULL`)
    .run(productId,newLevel,JSON.stringify(evidence),now,actorUserId,expiresAt,now);
  db.prepare('INSERT INTO strategy_verification_history(product_id,previous_level,new_level,action,evidence_json,reason,actor_user_id,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(productId,previousLevel,newLevel,action,JSON.stringify(evidence),reason,actorUserId,now);
}

export function syncAutomaticVerification(productId, actorUserId) {
  const report = db.prepare('SELECT content_sha256,parser_version FROM strategy_reports WHERE product_id=?').get(productId);
  const approved = db.prepare("SELECT evidence_type FROM strategy_evidence WHERE product_id=? AND review_status='approved'").all(productId).map(row=>row.evidence_type);
  const hasScreenshots = ['settings','statistics','chart'].every(type=>approved.includes(type));
  const baseline = report && hasScreenshots ? 'report_verified' : hasScreenshots ? 'screenshot_reviewed' : 'unverified';
  const current = db.prepare('SELECT * FROM strategy_verifications WHERE product_id=?').get(productId);
  const currentExpired = Boolean(current?.expires_at && current.expires_at <= Date.now());
  if (current?.status === 'active' && !currentExpired && rank[current.level] > rank.report_verified) return getVerification(productId);
  if (!current || current.level !== baseline || current.status !== 'active') writeVerification(productId,baseline,{ source:baseline,reportSha256:report?.content_sha256 || null,parserVersion:report?.parser_version || null,approvedEvidenceTypes:approved },actorUserId,'automatic');
  return getVerification(productId);
}

export function approveVerification(productId, level, evidence, adminId) {
  if (!['reproducible_backtest','platform_rerun','live_verified'].includes(level)) throw new Error('MANUAL_LEVEL_INVALID');
  const baseline = syncAutomaticVerification(productId, adminId);
  if (rank[baseline.level] < rank.report_verified) throw new Error('REPORT_VERIFICATION_REQUIRED');
  const expiresAt = level === 'live_verified' ? Date.now() + 30*24*60*60*1000 : null;
  writeVerification(productId,level,evidence,adminId,'approved',{expiresAt}); return getVerification(productId,{includePrivate:true});
}

export function revokeVerification(productId, reason, adminId) {
  const current = db.prepare('SELECT * FROM strategy_verifications WHERE product_id=?').get(productId); if (!current) throw new Error('VERIFICATION_NOT_FOUND');
  const now=Date.now(); db.prepare("UPDATE strategy_verifications SET status='revoked',revoked_at=?,revocation_reason=? WHERE product_id=?").run(now,reason,productId);
  db.prepare('INSERT INTO strategy_verification_history(product_id,previous_level,new_level,action,evidence_json,reason,actor_user_id,created_at) VALUES(?,?,?,?,?,?,?,?)').run(productId,current.level,'unverified','revoked',current.evidence_json,reason,adminId,now);
  return getVerification(productId,{includePrivate:true});
}

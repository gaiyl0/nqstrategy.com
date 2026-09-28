import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser, hashPassword, createSession, verifyPassword } from '@/lib/auth';
import crypto from 'crypto';
import { idempotencyKeySchema, idSchema, parseJson, userPatchSchema, validate, validationErrorResponse } from '@/lib/validation';
import { setWalletBalance } from '@/lib/wallet-ledger.mjs';
import { createSecurityContext, enforceRateLimits, RATE_LIMITS, withAudit } from '@/lib/security';

export const dynamic = 'force-dynamic';

// 1. 获取全平台用户列表（必须超管）
async function GETHandler() {
  try {
    const currentUser = await getSessionUser();
    if (currentUser?.role !== 'admin') {
      return NextResponse.json({ success: false, message: '权限不足，拒绝访问' }, { status: 403 });
    }

    // 联表统计发帖数、策略数；密码等核心哈希字段坚决不返回
    const users = db.prepare(`
      SELECT 
        u.id, u.username, u.email, u.role, u.balance, u.avatar_url, u.join_date,
        (SELECT COUNT(*) FROM posts WHERE author_user_id = u.id) AS post_count,
        (SELECT COUNT(*) FROM products WHERE author_user_id = u.id) AS ea_count
      FROM users u
      WHERE u.deleted_at IS NULL
      ORDER BY u.id ASC
    `).all();

    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json({ success: false, message: '服务异常' }, { status: 500 });
  }
}

// 2. 核心拦截：权限变动 / 个人资料修改 / 角色升级
async function PATCHHandler(request) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, message: '未登录或登录已失效' }, { status: 401 });
    }

    const parsed = await parseJson(request, userPatchSchema);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;

    // -------------------------------------------------------------
    // 行为 A (超管权限)：调整其他用户的系统权限 (newRole)
    // -------------------------------------------------------------
    if ('newRole' in body) {
      if (currentUser.role !== 'admin') {
        return NextResponse.json({ success: false, message: '越权拦截：仅限超管可修改用户角色' }, { status: 403 });
      }
      // 保护机制：系统初始超管 (ID 1) 不允许被降权
      if (body.id === 1 && body.newRole !== 'admin') {
        return NextResponse.json({ success: false, message: '保护系统：禁止降级初始超级管理员' }, { status: 400 });
      }
      const result = db.prepare('UPDATE users SET role = ? WHERE id = ? AND deleted_at IS NULL').run(body.newRole, body.id);
      if (result.changes !== 1) return NextResponse.json({ success: false, message: '用户不存在或已注销' }, { status: 404 });
      return NextResponse.json({ success: true, message: '权限更新成功' });
    }

    // -------------------------------------------------------------
    // 行为 B (超管权限)：直接调控用户余额 (manualBalance)
    // -------------------------------------------------------------
    if ('manualBalance' in body) {
      if (currentUser.role !== 'admin') {
        return NextResponse.json({ success: false, message: '越权拦截：仅限超管可调控账户余额' }, { status: 403 });
      }
      const newBalance = body.manualBalance;
      const parsedKey = validate(idempotencyKeySchema, request.headers.get('idempotency-key'));
      if (!parsedKey.success) return validationErrorResponse(parsedKey.error);
      try {
        const result = setWalletBalance({
          userId: body.id, balance: newBalance,
          businessKey: `admin-adjustment:${parsedKey.data}`,
          idempotencyKey: parsedKey.data, actorUserId: currentUser.id,
          metadata: { source: 'admin_balance_override' },
        });
        return NextResponse.json({ success: true, replayed: result.replayed, balance: result.balanceAfterMinor / 100, message: result.replayed ? '余额调整已处理，本次为安全重放' : '余额调整成功并已记录账本' });
      } catch (error) {
        if (error.message === 'LEDGER_USER_NOT_FOUND') return NextResponse.json({ success: false, message: '用户不存在或已注销' }, { status: 404 });
        if (error.message === 'LEDGER_NO_CHANGE') return NextResponse.json({ success: false, message: '目标余额与当前余额相同' }, { status: 409 });
        if (error.message === 'LEDGER_IDEMPOTENCY_CONFLICT' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') return NextResponse.json({ success: false, message: '该幂等键已用于其他余额操作' }, { status: 409 });
        throw error;
      }
    }

    // -------------------------------------------------------------
    // 行为 C (超管权限)：强制重置他人密码 (newPassword)
    // -------------------------------------------------------------
    if ('newPassword' in body) {
      if (currentUser.role !== 'admin') {
        return NextResponse.json({ success: false, message: '越权拦截：仅限超管可强制重置他人密码' }, { status: 403 });
      }
      const newPassword = body.newPassword;
      const hashed = await hashPassword(newPassword);
      const result = db.prepare(`
        UPDATE users
        SET password = ?, password_reset_required = 0, session_version = session_version + 1
        WHERE id = ? AND deleted_at IS NULL
      `).run(hashed, body.id);
      if (result.changes !== 1) return NextResponse.json({ success: false, message: '用户不存在或已注销' }, { status: 404 });
      return NextResponse.json({ success: true, message: '密码强制重置成功' });
    }

    // -------------------------------------------------------------
    // 行为 D：开发者身份必须由管理员审核授予
    // -------------------------------------------------------------
    if ('upgradeRole' in body) {
      return NextResponse.json({ success: false, message: '开发者身份需由管理员审核授予' }, { status: 403 });
    }

    // -------------------------------------------------------------
    // 行为 E (普通用户)：修改自身资料 (用户名、头像、修改自身密码)
    // 核心加固：强制使用 currentUser.id，防止越权覆盖他人的资料
    // -------------------------------------------------------------
    if ('newUsername' in body) {
      const newUname = body.newUsername;

      // 检查新用户名是否被其他人占用
      const conflict = db.prepare('SELECT id FROM users WHERE deleted_at IS NULL AND LOWER(username) = LOWER(?) AND id != ?')
        .get(newUname, currentUser.id);
      if (conflict) {
        return NextResponse.json({ success: false, message: '该用户名已被其他交易员占用' }, { status: 400 });
      }

      const newAvatar = body.avatar_url ?? currentUser.avatar_url;
      if (newAvatar !== currentUser.avatar_url) {
        const ownedAvatar = db.prepare(`
          SELECT id FROM uploads
          WHERE url = ? AND owner_user_id = ? AND kind = 'image'
        `).get(String(newAvatar), currentUser.id);
        if (!ownedAvatar) {
          return NextResponse.json({ success: false, message: '头像文件无效或不属于当前账户' }, { status: 400 });
        }
      }

      const changePassword = Boolean(body.password);
      let hashed = null;
      let credential = null;
      let passwordContext = null;
      if (changePassword) {
        passwordContext = createSecurityContext(request,currentUser);
        const limited=enforceRateLimits(passwordContext,'auth.profile_password_change',[
          {policy:RATE_LIMITS.profilePasswordIp},
          {policy:RATE_LIMITS.profilePasswordUser,identifier:String(currentUser.id)},
        ]);
        if(limited)return limited;
        credential=db.prepare('SELECT password,session_version FROM users WHERE id=? AND deleted_at IS NULL').get(currentUser.id);
        if(!credential||!await verifyPassword(body.currentPassword,credential.password)){
          return withAudit(passwordContext,NextResponse.json({success:false,message:'当前密码验证失败'},{status:401}),{
            eventType:'auth.profile_password_change',outcome:'failure',reasonCode:'CURRENT_PASSWORD_INVALID',
            userId:currentUser.id,targetType:'user',targetId:currentUser.id,
          });
        }
        hashed = await hashPassword(body.password);
      }

      try{db.transaction(() => {
        if (changePassword) {
          const updated=db.prepare(`
            UPDATE users
            SET username = ?, avatar_url = ?, password = ?, password_reset_required = 0,
                session_version = session_version + 1
            WHERE id = ? AND password = ? AND session_version = ? AND deleted_at IS NULL
          `)
            .run(newUname, newAvatar, hashed, currentUser.id,credential.password,credential.session_version);
          if(updated.changes!==1)throw new Error('PROFILE_PASSWORD_STATE_CONFLICT');
        } else {
          db.prepare('UPDATE users SET username = ?, avatar_url = ? WHERE id = ?')
            .run(newUname, newAvatar, currentUser.id);
        }

        db.prepare('UPDATE products SET author = ? WHERE author_user_id = ?').run(newUname, currentUser.id);
        db.prepare('UPDATE orders SET username = ? WHERE buyer_user_id = ?').run(newUname, currentUser.id);
        db.prepare('UPDATE posts SET author = ? WHERE author_user_id = ?').run(newUname, currentUser.id);
        db.prepare('UPDATE comments SET author = ? WHERE author_user_id = ?').run(newUname, currentUser.id);
        db.prepare('UPDATE withdrawals SET username = ? WHERE user_id = ?').run(newUname, currentUser.id);
      })();}catch(error){
        if(error.message==='PROFILE_PASSWORD_STATE_CONFLICT'){
          return withAudit(passwordContext,NextResponse.json({success:false,message:'账户状态已变化，请重新登录后再试'},{status:409}),{
            eventType:'auth.profile_password_change',outcome:'failure',reasonCode:'ACCOUNT_STATE_CONFLICT',
            userId:currentUser.id,targetType:'user',targetId:currentUser.id,
          });
        }
        throw error;
      }

      const refreshedUser = db.prepare(
        'SELECT id, username, email, role, balance, avatar_url, email_verified, join_date, session_version FROM users WHERE id = ? AND deleted_at IS NULL'
      ).get(currentUser.id);
      await createSession(refreshedUser);
      const response=NextResponse.json({ success: true, user: refreshedUser });
      return changePassword?withAudit(passwordContext,response,{
        eventType:'auth.profile_password_change',outcome:'success',reasonCode:'PASSWORD_CHANGED',
        userId:currentUser.id,targetType:'user',targetId:currentUser.id,
      }):response;
    }

    return NextResponse.json({ success: false, message: '未知操作指令' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, message: '操作失败，请重试' }, { status: 500 });
  }
}

// 3. 删除用户（必须超管）
async function DELETEHandler(request) {
  try {
    const currentUser = await getSessionUser();
    if (currentUser?.role !== 'admin') {
      return NextResponse.json({ success: false, message: '越权拦截：无权删除用户' }, { status: 403 });
    }

    const parsedId = validate(idSchema, new URL(request.url).searchParams.get('id'));
    if (!parsedId.success) return validationErrorResponse(parsedId.error);
    const id = parsedId.data;
    if (id === 1) {
      return NextResponse.json({ success: false, message: '安全限制：无法注销初始超级管理员' }, { status: 400 });
    }
    if (id === currentUser.id) {
      return NextResponse.json({ success: false, message: '管理员不能在当前会话中注销自己' }, { status: 400 });
    }

    const disabledPassword = await hashPassword(crypto.randomBytes(48).toString('base64url'));
    const anonymizeUser = db.transaction(() => {
      const target = db.prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL').get(id);
      if (!target) throw new Error('USER_NOT_FOUND');

      const deletedLabel = `Deleted User #${id}`;
      const anonymizationNonce = crypto.randomBytes(8).toString('hex');
      const deletedUsername = `deleted-user-${id}-${anonymizationNonce}`;
      const deletedEmail = `deleted-${id}-${anonymizationNonce}@deleted.invalid`;
      db.prepare(`
        UPDATE users
        SET username = ?, email = ?, role = 'banned', password = ?, avatar_url = NULL,
            email_verified = 0, password_reset_required = 1,
            session_version = session_version + 1, deleted_at = CURRENT_TIMESTAMP
        WHERE id = ? AND deleted_at IS NULL
      `).run(deletedUsername, deletedEmail, disabledPassword, id);

      db.prepare('UPDATE products SET author = ? WHERE author_user_id = ?').run(deletedLabel, id);
      db.prepare('UPDATE orders SET username = ? WHERE buyer_user_id = ?').run(deletedLabel, id);
      db.prepare('UPDATE posts SET author = ? WHERE author_user_id = ?').run(deletedLabel, id);
      db.prepare('UPDATE comments SET author = ? WHERE author_user_id = ?').run(deletedLabel, id);
      db.prepare('UPDATE withdrawals SET username = ? WHERE user_id = ?').run(deletedLabel, id);
    });

    try {
      anonymizeUser.immediate();
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return NextResponse.json({ success: false, message: '用户不存在或已注销' }, { status: 404 });
      }
      throw error;
    }
    return NextResponse.json({ success: true, message: '账户已匿名化注销，历史资产与原用户 ID 保持绑定' });
  } catch (error) {
    return NextResponse.json({ success: false, message: '删除失败' }, { status: 500 });
  }
}

export const GET = withApiErrors(GETHandler, { route: '/api/users' });
export const PATCH = withApiErrors(PATCHHandler, { route: '/api/users' });
export const DELETE = withApiErrors(DELETEHandler, { route: '/api/users' });

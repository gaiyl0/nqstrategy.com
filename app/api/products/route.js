import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import {
  createProductSchema,
  adminScopeSchema,
  idSchema,
  parseJson,
  productPatchSchema,
  validate,
  validationErrorResponse,
  marketQuerySchema,
} from '@/lib/validation';
import {
  clearStrategyMetricsReview,
  getStrategyMetrics,
  reviewStrategyMetrics,
  upsertStrategyMetrics,
} from '@/lib/strategy-metrics';
import { claimEvidence, listEvidence, removeEvidenceFiles, verifyEvidenceForApproval } from '@/lib/strategy-evidence';
import { claimReport, reportPath, verifyMetricsAgainstReport } from '@/lib/mt5-report';
import fs from 'node:fs';
import { getVerification, syncAutomaticVerification } from '@/lib/strategy-verification';
import { createInitialVersion, getCurrentVersion, listVersions, publishInitialVersion } from '@/lib/product-versions';
import { productSocialSummary } from '@/lib/social';
import { queryMarketCatalog } from '@/lib/market-catalog.mjs';
import { productSlug } from '@/lib/product-slug.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function findOwnedUpload(url, userId, kind) {
  if (!url) return null;
  return db.prepare(`
    SELECT id,url,content_sha256 FROM uploads
    WHERE url = ? AND owner_user_id = ? AND kind = ? AND attached_product_id IS NULL
      AND deleted_at IS NULL AND status IN ('clean', 'content_validated')
  `).get(String(url), userId, kind);
}

function publicProductDto(product,currentUser=null) {
  const ownsPending = product.status !== 'active' && product.author_user_id === currentUser?.id;
  const report = db.prepare('SELECT id,content_sha256,parser_version FROM strategy_reports WHERE product_id=?').get(product.id);
  return { ...product, metrics: getStrategyMetrics(product.id, { includeUnreviewed: ownsPending }), evidence: listEvidence(product.id, { admin: ownsPending }), report: report ? { id: report.id, sha256: report.content_sha256, parserVersion: report.parser_version } : null, verification:getVerification(product.id,{includePrivate:ownsPending}),currentVersion:getCurrentVersion(product.id),versions:listVersions(product.id,{includePrivate:ownsPending}),social:productSocialSummary(product.id,currentUser?.id) };
}

function publicProducts(currentUser = null) {
  const includeOwned = currentUser && ['developer', 'admin'].includes(currentUser.role);
  const products = db.prepare(`
    SELECT id, slug, title, author, author_user_id, description, logo_url, price, win_rate, drawdown,
           pairs, ea_type, trial_enabled, trial_days, status, created_at
    FROM products
    WHERE moderation_status='visible' AND (status = 'active' ${includeOwned ? 'OR author_user_id = ?' : ''})
    ORDER BY created_at DESC
  `).all(...(includeOwned ? [currentUser.id] : []));
  return products.map(product=>publicProductDto(product,currentUser));
}

function marketProducts(currentUser,query){
  const now=Date.now();
  const candidates=db.prepare(`SELECT p.id,p.slug,p.title,p.author,p.author_user_id,p.description,p.logo_url,p.price,p.win_rate,p.drawdown,p.pairs,p.ea_type,p.trial_enabled,p.trial_days,p.status,p.created_at,
    m.max_drawdown_percent metric_drawdown,m.reviewed_at metric_reviewed,
    CASE WHEN v.status='active' AND (v.expires_at IS NULL OR v.expires_at>?) THEN v.level ELSE 'unverified' END verification_level
    FROM products p LEFT JOIN strategy_metrics m ON m.product_id=p.id LEFT JOIN strategy_verifications v ON v.product_id=p.id
    WHERE p.status='active' AND p.moderation_status='visible' ORDER BY p.created_at DESC`).all(now).map(product=>({...product,metrics:product.metric_reviewed?{maxDrawdownPercent:product.metric_drawdown,reviewedAt:product.metric_reviewed}:null,verification:{level:product.verification_level}}));
  const result=queryMarketCatalog(candidates,query);
  return {products:result.items.map(candidate=>{const product={...candidate};for(const key of ['metric_drawdown','metric_reviewed','verification_level','metrics','verification'])delete product[key];return publicProductDto(product,currentUser);}),pagination:result.pagination};
}

export async function GET(request) {
  try {
    const searchParams=new URL(request.url).searchParams;
    const roleParam = searchParams.get('role');
    let wantsAdmin = false;
    if (roleParam !== null) {
      const parsedRole = validate(adminScopeSchema, roleParam);
      if (!parsedRole.success) return validationErrorResponse(parsedRole.error);
      wantsAdmin = true;
    }
    if (wantsAdmin) {
      const currentUser = await getSessionUser();
      if (currentUser?.role !== 'admin') {
        return NextResponse.json({ success: false, message: '无权查看全部策略' }, { status: 403 });
      }
      const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all()
        .map((product) => { const report = db.prepare('SELECT id,content_sha256,parser_version FROM strategy_reports WHERE product_id=?').get(product.id); return { ...product, metrics: getStrategyMetrics(product.id, { includeUnreviewed: true }), evidence: listEvidence(product.id, { admin: true }), report: report ? { id: report.id, sha256: report.content_sha256, parserVersion: report.parser_version } : null, verification:getVerification(product.id,{includePrivate:true}),currentVersion:getCurrentVersion(product.id,{includePrivate:true}),versions:listVersions(product.id,{includePrivate:true}),social:productSocialSummary(product.id,currentUser.id) }; });
      return NextResponse.json({ success: true, products });
    }

    const currentUser=await getSessionUser();
    if(searchParams.get('market')==='1'){
      const input=Object.fromEntries([...searchParams.entries()].filter(([key])=>['market','q','pair','type','verification','maxDrawdown','maxPrice','page','pageSize'].includes(key)));
      const parsed=validate(marketQuerySchema,input);if(!parsed.success)return validationErrorResponse(parsed.error);
      const result=marketProducts(currentUser,parsed.data);
      return NextResponse.json({success:true,...result});
    }
    return NextResponse.json({ success: true, products:publicProducts(currentUser) });
  } catch (error) {
    console.error('查询策略异常:', error);
    return NextResponse.json({ success: false, message: '服务异常' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, message: '请先登录' }, { status: 401 });
    }
    if (!['developer', 'admin'].includes(currentUser.role)) {
      return NextResponse.json({ success: false, message: '仅认证开发者可发布策略' }, { status: 403 });
    }

    const parsed = await parseJson(request, createProductSchema);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    verifyMetricsAgainstReport(body.reportId, currentUser.id, body.metrics);

    const eaUpload = findOwnedUpload(body.file_url, currentUser.id, 'ea');
    const logoUpload = body.logo_url ? findOwnedUpload(body.logo_url, currentUser.id, 'image') : null;
    if (!eaUpload) {
      return NextResponse.json({ success: false, message: '请先上传属于当前账户的 EA 文件' }, { status: 400 });
    }
    if (body.logo_url && !logoUpload) {
      return NextResponse.json({ success: false, message: '策略图片无效或不属于当前账户' }, { status: 400 });
    }

    const createProduct = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO products
          (title, author, author_user_id, description, price, win_rate, drawdown, pairs, ea_type, logo_url, file_url, trial_enabled, trial_days, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(
        body.title, currentUser.username, currentUser.id, body.description, body.price,
        `${body.metrics.winRatePercent}%`, `${body.metrics.maxDrawdownPercent}%`, body.pairs, body.eaTypes.join(','),
        body.logo_url || null, body.file_url,body.trialEnabled?1:0,body.trialDays||7,
      );
      const productId = Number(result.lastInsertRowid);
      db.prepare('UPDATE products SET slug=? WHERE id=?').run(productSlug(body.title,productId),productId);
      upsertStrategyMetrics(productId, body.metrics);
      claimEvidence(productId, currentUser.id, body.evidenceIds);
      claimReport(productId, currentUser.id, body.reportId);
      const eaClaim = db.prepare(`
        UPDATE uploads SET attached_product_id = ?, expires_at = NULL, status = 'attached'
        WHERE id = ? AND owner_user_id = ? AND kind = 'ea' AND attached_product_id IS NULL
          AND deleted_at IS NULL AND status IN ('clean', 'content_validated')
      `).run(productId, eaUpload.id, currentUser.id);
      if (eaClaim.changes !== 1) throw new Error('EA 文件已被使用');
      createInitialVersion(productId,currentUser.id,eaUpload,{version:body.version,releaseNotes:body.releaseNotes,upgradePolicy:body.upgradePolicy});
      if (logoUpload) {
        const logoClaim = db.prepare(`
          UPDATE uploads SET attached_product_id = ?, expires_at = NULL, status = 'attached'
          WHERE id = ? AND owner_user_id = ? AND kind = 'image' AND attached_product_id IS NULL
            AND deleted_at IS NULL AND status IN ('clean', 'content_validated')
        `).run(productId, logoUpload.id, currentUser.id);
        if (logoClaim.changes !== 1) throw new Error('策略图片已被使用');
      }
      return productId;
    });

    return NextResponse.json({ success: true, id: createProduct() }, { status: 201 });
  } catch (error) {
    if (['EVIDENCE_OWNERSHIP_INVALID', 'EVIDENCE_SET_INCOMPLETE', 'EVIDENCE_ALREADY_USED','REPORT_OWNERSHIP_INVALID','REPORT_ALREADY_USED'].includes(error.message)) {
      return NextResponse.json({ success: false, message: '回测证据不完整、所有权无效或已被其他策略使用' }, { status: 409 });
    }
    if (['REPORT_METRICS_MODIFIED','REPORT_CURVES_MODIFIED'].includes(error.message)) return NextResponse.json({ success: false, message: '提交的回测数据已偏离 MT5 原始报告，请重新上传并使用自动提取结果' }, { status: 409 });
    console.error('创建策略异常:', error);
    return NextResponse.json({ success: false, message: '创建策略失败' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, message: '请先登录' }, { status: 401 });
    }

    const parsed = await parseJson(request, productPatchSchema);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const id = body.id;

    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) return NextResponse.json({ success: false, message: '策略不存在' }, { status: 404 });

    if ('status' in body) {
      if (currentUser.role !== 'admin') {
        return NextResponse.json({ success: false, message: '仅管理员可审核策略' }, { status: 403 });
      }
      const reviewProduct = db.transaction(() => {
        if (body.status === 'active') {
          const metrics = getStrategyMetrics(id, { includeUnreviewed: true });
          if (!metrics) throw new Error('STRATEGY_METRICS_REQUIRED');
          const report = db.prepare('SELECT id,owner_user_id FROM strategy_reports WHERE product_id=?').get(id);
          if (!report) throw new Error('STRATEGY_REPORT_REQUIRED');
          verifyMetricsAgainstReport(report.id, report.owner_user_id, metrics);
          verifyEvidenceForApproval(id, metrics);
          reviewStrategyMetrics(id, currentUser.id);
          publishInitialVersion(id,currentUser.id);
        } else {
          clearStrategyMetricsReview(id);
        }
        db.prepare('UPDATE products SET status = ? WHERE id = ?').run(body.status, id);
        if(body.status==='active') syncAutomaticVerification(id,currentUser.id);
      });
      try {
        reviewProduct.immediate();
      } catch (error) {
        if (error.message === 'STRATEGY_METRICS_REQUIRED') {
          return NextResponse.json({ success: false, message: '该策略缺少完整结构化回测指标，不能批准上架' }, { status: 409 });
        }
        if (error.message === 'STRATEGY_REPORT_REQUIRED') return NextResponse.json({ success: false, message: '该策略缺少可解析的 MT5 HTML 原始报告，不能批准上架' }, { status: 409 });
        if (error.message === 'PRODUCT_VERSION_REQUIRED') return NextResponse.json({ success:false,message:'该策略缺少待审核的程序版本，不能批准上架' },{status:409});
        if (['REPORT_METRICS_MODIFIED','REPORT_CURVES_MODIFIED'].includes(error.message)) return NextResponse.json({ success: false, message: '策略指标或曲线与 MT5 HTML 原始报告不一致' }, { status: 409 });
        if (error.message === 'EVIDENCE_APPROVAL_REQUIRED') return NextResponse.json({ success: false, message: '设置、统计和净值曲线证据必须全部审核通过' }, { status: 409 });
        if (error.message === 'STATISTICS_EXTRACTION_REQUIRED') return NextResponse.json({ success: false, message: '统计证据缺少可核对的提取数据' }, { status: 409 });
        if (error.message === 'EVIDENCE_METRICS_MISMATCH') return NextResponse.json({ success: false, message: `结构化指标与统计证据不一致：${(error.fields || []).join(', ')}` }, { status: 409 });
        throw error;
      }
      return NextResponse.json({ success: true });
    }

    const isOwner = existing.author_user_id === currentUser.id;
    if (currentUser.role !== 'admin' && (!isOwner || currentUser.role !== 'developer')) {
      return NextResponse.json({ success: false, message: '无权编辑该策略' }, { status: 403 });
    }

    if (body.file_url) return NextResponse.json({ success:false,message:'程序更新必须通过版本管理提交，不能覆盖现有版本文件' },{status:409});
    const logoUpload = body.logo_url ? findOwnedUpload(body.logo_url, currentUser.id, 'image') : null;
    if (body.logo_url && !logoUpload) {
      return NextResponse.json({ success: false, message: '策略图片无效或不属于当前账户' }, { status: 400 });
    }
    verifyMetricsAgainstReport(body.reportId, existing.author_user_id, body.metrics);

    const updateProduct = db.transaction(() => {
      const replacementExpiry = Date.now() + 24 * 60 * 60 * 1000;
      let query = `
        UPDATE products SET title = ?, description = ?, price = ?, win_rate = ?,
          drawdown = ?, pairs = ?, ea_type = ?, trial_enabled=?,trial_days=?,status = 'pending'
      `;
      const params = [body.title, body.description, body.price, `${body.metrics.winRatePercent}%`,
        `${body.metrics.maxDrawdownPercent}%`, body.pairs, body.eaTypes.join(','),body.trialEnabled?1:0,body.trialDays||7];
      if (body.logo_url) { query += ', logo_url = ?'; params.push(body.logo_url); }
      query += ' WHERE id = ?';
      params.push(id);
      db.prepare(query).run(...params);
      upsertStrategyMetrics(id, body.metrics);
      claimEvidence(id, existing.author_user_id, body.evidenceIds);
      claimReport(id, existing.author_user_id, body.reportId);

      if (body.logo_url && body.logo_url !== existing.logo_url) {
        db.prepare(`UPDATE uploads SET attached_product_id = NULL, expires_at = ?
          WHERE attached_product_id = ? AND kind = 'image' AND url = ? AND deleted_at IS NULL`
        ).run(replacementExpiry, id, existing.logo_url);
      }

      for (const upload of [logoUpload].filter(Boolean)) {
        const claim = db.prepare(`
          UPDATE uploads SET attached_product_id = ?, expires_at = NULL, status = 'attached'
          WHERE id = ? AND owner_user_id = ? AND attached_product_id IS NULL
            AND deleted_at IS NULL AND status IN ('clean', 'content_validated')
        `).run(id, upload.id, currentUser.id);
        if (claim.changes !== 1) throw new Error('上传文件已被使用');
      }
    });
    updateProduct();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (['EVIDENCE_OWNERSHIP_INVALID', 'EVIDENCE_SET_INCOMPLETE', 'EVIDENCE_ALREADY_USED','REPORT_OWNERSHIP_INVALID','REPORT_ALREADY_USED'].includes(error.message)) {
      return NextResponse.json({ success: false, message: '回测证据不完整、所有权无效或已被其他策略使用' }, { status: 409 });
    }
    if (['REPORT_METRICS_MODIFIED','REPORT_CURVES_MODIFIED'].includes(error.message)) return NextResponse.json({ success: false, message: '提交的回测数据已偏离 MT5 原始报告，请重新上传并使用自动提取结果' }, { status: 409 });
    console.error('更新策略异常:', error);
    return NextResponse.json({ success: false, message: '更新策略失败' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, message: '请先登录' }, { status: 401 });
    }
    const parsedId = validate(idSchema, new URL(request.url).searchParams.get('id'));
    if (!parsedId.success) return validationErrorResponse(parsedId.error);
    const id = parsedId.data;

    const product = db.prepare('SELECT id, author_user_id FROM products WHERE id = ?').get(id);
    if (!product) return NextResponse.json({ success: false, message: '策略不存在' }, { status: 404 });
    if (currentUser.role !== 'admin' && product.author_user_id !== currentUser.id) {
      return NextResponse.json({ success: false, message: '无权删除该策略' }, { status: 403 });
    }
    const owned = db.prepare("SELECT id FROM orders WHERE product_id = ? AND status = 'completed' LIMIT 1").get(id);
    if (owned) {
      return NextResponse.json({ success: false, message: '该策略已有购买记录，只能下架，不能删除' }, { status: 409 });
    }
    const publishedVersion=db.prepare("SELECT id FROM product_versions WHERE product_id=? AND status='published' LIMIT 1").get(id);
    if(publishedVersion)return NextResponse.json({success:false,message:'该策略已有发布版本，为保留版本与下载审计只能下架，不能删除'},{status:409});
    const evidenceFiles = db.prepare('SELECT original_stored_name, preview_stored_name FROM strategy_evidence WHERE product_id = ?').all(id);
    const reportFile = db.prepare('SELECT stored_name FROM strategy_reports WHERE product_id=?').get(id);

    db.transaction(() => {
      db.prepare(`UPDATE uploads SET attached_product_id = NULL, expires_at = ?
        WHERE attached_product_id = ? AND deleted_at IS NULL`
      ).run(Date.now() + 24 * 60 * 60 * 1000, id);
      db.prepare("DELETE FROM product_versions WHERE product_id=? AND status<>'published'").run(id);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
    }).immediate();
    for (const evidence of evidenceFiles) removeEvidenceFiles(evidence);
    if (reportFile) try { fs.rmSync(reportPath(reportFile.stored_name), { force: true }); } catch {}
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除策略异常:', error);
    return NextResponse.json({ success: false, message: '删除策略失败' }, { status: 500 });
  }
}

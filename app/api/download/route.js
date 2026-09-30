import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import fs from 'fs';
import { idSchema, validate, validationErrorResponse } from '@/lib/validation';
import { recordVersionDownload,resolveDownloadVersion } from '@/lib/product-versions';
import { storedPath } from '@/lib/upload-security';
import { findDownloadLicense } from '@/lib/licensing';

export const dynamic = 'force-dynamic';

async function GETHandler(request) {
  try {
    // 1. 服务端强制鉴权：必须登录
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return new NextResponse('越权访问：请先登录量化平台后下载', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsedProductId = validate(idSchema, searchParams.get('productId'));
    if (!parsedProductId.success) return validationErrorResponse(parsedProductId.error);
    const productId = parsedProductId.data;
    const rawVersionId=searchParams.get('versionId');
    const parsedVersionId=rawVersionId===null?null:validate(idSchema,rawVersionId);
    if(parsedVersionId&&!parsedVersionId.success)return validationErrorResponse(parsedVersionId.error);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product || product.deleted_at) {
      return new NextResponse('未找到该策略对应的主程序文件', { status: 404 });
    }
    const version=resolveDownloadVersion(productId,parsedVersionId?.data||null);
    if(!version)return new NextResponse('未找到可下载的已发布版本',{status:404});

    // 2. 权限校验：已支付买家 / 策略原作者 / 超管
    let hasAccess = false; let order=null;let license=null;

    if (currentUser.role === 'admin' || product.author_user_id === currentUser.id) {
      hasAccess = true;
    } else {
      const access=findDownloadLicense(currentUser.id,version);order=access?.order||null;license=access?.license||null;
      if (access) hasAccess = true;
    }

    if (!hasAccess) {
      return new NextResponse('防盗版保护：您尚未购买该策略，或您的付款凭据正在等待链上审核', { status: 403 });
    }

    const fileUrl = version.file_url;
    if (!/^\/private\/eas\/[A-Za-z0-9._-]+$/.test(fileUrl)) {
      return new NextResponse('策略文件尚未迁移到安全存储，请联系客服', { status: 410 });
    }
    const upload = db.prepare(`
      SELECT id,stored_name,content_sha256 FROM uploads
      WHERE id=? AND url = ? AND kind = 'ea' AND attached_product_id = ? AND deleted_at IS NULL
    `).get(version.upload_id,fileUrl, product.id);
    if (!upload||upload.content_sha256!==version.content_sha256) {
      return new NextResponse('策略文件记录无效，请联系客服', { status: 404 });
    }
    const targetFilePath=storedPath('ea',upload.stored_name);
    if (!fs.existsSync(targetFilePath)) {
      return new NextResponse('策略主程序在服务器存储中未找到，请联系客服', { status: 404 });
    }

    // 4. 流式安全下发二进制流
    const fileBuffer = fs.readFileSync(targetFilePath);
    const ext = fileUrl.toLowerCase().endsWith('.ex4')?'.ex4':'.ex5';
    const safeTitle = encodeURIComponent(product.title.replace(/\s+/g, '_'));
    recordVersionDownload(version,currentUser.id,order?.id||null);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeTitle}_v${version.version}_NexusQuant${ext}"; filename*=UTF-8''${safeTitle}_v${encodeURIComponent(version.version)}_NexusQuant${ext}`,
        'X-Nexus-Version-Id':String(version.id),
        ...(license?{'X-Nexus-License-Id':String(license.id)}:{}),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    return new NextResponse('下载服务异常', { status: 500 });
  }
}

export const GET = withApiErrors(GETHandler, { route: '/api/download' });

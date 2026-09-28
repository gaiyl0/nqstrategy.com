import db from './db.js';

function dto(row, { includePrivate=false }={}) {
  if (!row) return null;
  return {
    id:row.id,productId:row.product_id,version:row.version,releaseNotes:row.release_notes,
    sha256:row.content_sha256,upgradePolicy:row.upgrade_policy,status:row.status,
    isCurrent:Boolean(row.is_current),createdAt:row.created_at,releasedAt:row.released_at,
    ...(includePrivate?{uploadId:row.upload_id,fileUrl:row.file_url,entitlementCutoff:row.entitlement_cutoff,
      submittedByUserId:row.submitted_by_user_id,reviewedByUserId:row.reviewed_by_user_id,
      reviewedAt:row.reviewed_at,rejectionReason:row.rejection_reason}:{}),
  };
}

export function listVersions(productId,{includePrivate=false}={}) {
  const where=includePrivate?'':'AND status=\'published\'';
  return db.prepare(`SELECT * FROM product_versions WHERE product_id=? ${where} ORDER BY id DESC`).all(productId).map(row=>dto(row,{includePrivate}));
}

export function getCurrentVersion(productId,options) {
  return dto(db.prepare("SELECT * FROM product_versions WHERE product_id=? AND status='published' AND is_current=1").get(productId),options);
}

export function createInitialVersion(productId,userId,upload,{version,releaseNotes,upgradePolicy}) {
  const now=Date.now();
  const result=db.prepare(`INSERT INTO product_versions
    (product_id,version,release_notes,upload_id,file_url,content_sha256,upgrade_policy,entitlement_cutoff,status,is_current,submitted_by_user_id,created_at)
    VALUES(?,?,?,?,?,?,?,NULL,'pending',0,?,?)`)
    .run(productId,version,releaseNotes,upload.id,upload.url,upload.content_sha256,upgradePolicy,userId,now);
  return Number(result.lastInsertRowid);
}

export function submitVersion(productId,userId,upload,{version,releaseNotes,upgradePolicy}) {
  const now=Date.now();
  return db.transaction(()=>{
    const product=db.prepare('SELECT id,author_user_id,status FROM products WHERE id=?').get(productId);
    if(!product) throw new Error('PRODUCT_NOT_FOUND');
    if(product.author_user_id!==userId) throw new Error('FORBIDDEN');
    if(product.status!=='active') throw new Error('PRODUCT_NOT_ACTIVE');
    const claimed=db.prepare(`UPDATE uploads SET attached_product_id=?,expires_at=NULL,status='attached'
      WHERE id=? AND owner_user_id=? AND kind='ea' AND attached_product_id IS NULL AND deleted_at IS NULL
        AND status IN ('clean','content_validated')`).run(productId,upload.id,userId);
    if(claimed.changes!==1) throw new Error('UPLOAD_ALREADY_USED');
    const result=db.prepare(`INSERT INTO product_versions
      (product_id,version,release_notes,upload_id,file_url,content_sha256,upgrade_policy,entitlement_cutoff,status,is_current,submitted_by_user_id,created_at)
      VALUES(?,?,?,?,?,?,?,NULL,'pending',0,?,?)`)
      .run(productId,version,releaseNotes,upload.id,upload.url,upload.content_sha256,upgradePolicy,userId,now);
    return dto(db.prepare('SELECT * FROM product_versions WHERE id=?').get(result.lastInsertRowid),{includePrivate:true});
  }).immediate();
}

export function reviewVersion(versionId,decision,reason,adminId) {
  return db.transaction(()=>{
    const current=db.prepare('SELECT * FROM product_versions WHERE id=?').get(versionId);
    if(!current) throw new Error('VERSION_NOT_FOUND');
    if(decision==='retire'){
      if(current.status==='retired')return {...dto(current,{includePrivate:true}),replayed:true};
      if(current.status!=='published')throw new Error('VERSION_NOT_PUBLISHED');
      const now=Date.now();
      const changed=db.prepare("UPDATE product_versions SET status='retired',is_current=0,rejection_reason=?,reviewed_by_user_id=?,reviewed_at=? WHERE id=? AND status='published'").run(reason,adminId,now,versionId);
      if(changed.changes!==1)throw new Error('VERSION_RACE_LOST');
      if(current.is_current){const fallback=db.prepare("SELECT * FROM product_versions WHERE product_id=? AND status='published' AND id<>? ORDER BY released_at DESC,id DESC LIMIT 1").get(current.product_id,versionId);if(fallback){db.prepare('UPDATE product_versions SET is_current=1 WHERE id=? AND is_current=0').run(fallback.id);db.prepare('UPDATE products SET file_url=? WHERE id=?').run(fallback.file_url,current.product_id);}else db.prepare('UPDATE products SET file_url=NULL WHERE id=?').run(current.product_id);}
      return dto(db.prepare('SELECT * FROM product_versions WHERE id=?').get(versionId),{includePrivate:true});
    }
    if(current.status!=='pending') {
      if((decision==='approve'&&current.status==='published')||(decision==='reject'&&current.status==='rejected')) return {...dto(current,{includePrivate:true}),replayed:true};
      throw new Error('VERSION_ALREADY_REVIEWED');
    }
    const now=Date.now();
    if(decision==='reject') {
      const changed=db.prepare("UPDATE product_versions SET status='rejected',rejection_reason=?,reviewed_by_user_id=?,reviewed_at=? WHERE id=? AND status='pending'").run(reason,adminId,now,versionId);
      if(changed.changes!==1) throw new Error('VERSION_RACE_LOST');
    } else {
      db.prepare('UPDATE product_versions SET is_current=0 WHERE product_id=? AND is_current=1').run(current.product_id);
      const cutoff=current.upgrade_policy==='new_purchases_only'?now:null;
      const changed=db.prepare(`UPDATE product_versions SET status='published',is_current=1,entitlement_cutoff=?,reviewed_by_user_id=?,reviewed_at=?,released_at=?
        WHERE id=? AND status='pending'`).run(cutoff,adminId,now,now,versionId);
      if(changed.changes!==1) throw new Error('VERSION_RACE_LOST');
      db.prepare('UPDATE products SET file_url=? WHERE id=?').run(current.file_url,current.product_id);
    }
    return dto(db.prepare('SELECT * FROM product_versions WHERE id=?').get(versionId),{includePrivate:true});
  }).immediate();
}

export function publishInitialVersion(productId,adminId) {
  const published=getCurrentVersion(productId,{includePrivate:true});
  if(published) return published;
  const pending=db.prepare("SELECT id FROM product_versions WHERE product_id=? AND status='pending' ORDER BY id LIMIT 1").get(productId);
  if(!pending) {
    throw new Error('PRODUCT_VERSION_REQUIRED');
  }
  return reviewVersion(pending.id,'approve','',adminId);
}

export function resolveDownloadVersion(productId,versionId=null) {
  if(versionId) return db.prepare("SELECT * FROM product_versions WHERE id=? AND product_id=? AND status='published'").get(versionId,productId);
  return db.prepare("SELECT * FROM product_versions WHERE product_id=? AND status='published' AND is_current=1").get(productId);
}

export function findEligibleOrder(userId,version) {
  const cutoff=version.upgrade_policy==='new_purchases_only'?version.entitlement_cutoff:null;
  return db.prepare(`SELECT id,created_at FROM orders WHERE buyer_user_id=? AND product_id=? AND status='completed'
    AND (price=0 OR payment_verified=1) ${cutoff?'AND CAST(strftime(\'%s\',created_at) AS INTEGER)*1000 >= ?':''}
    ORDER BY id LIMIT 1`).get(...(cutoff?[userId,version.product_id,cutoff]:[userId,version.product_id]));
}

export function listEligibleVersions(productId,purchaseDate){
  const purchaseMs=new Date(purchaseDate).getTime();
  return db.prepare("SELECT * FROM product_versions WHERE product_id=? AND status='published' ORDER BY id DESC").all(productId)
    .filter(row=>row.upgrade_policy==='all_existing'||(Number.isFinite(purchaseMs)&&purchaseMs>=row.entitlement_cutoff))
    .map(row=>dto(row));
}

export function recordVersionDownload(version,userId,orderId=null) {
  db.prepare('INSERT INTO product_version_downloads(version_id,product_id,user_id,order_id,downloaded_at) VALUES(?,?,?,?,?)')
    .run(version.id,version.product_id,userId,orderId,Date.now());
}

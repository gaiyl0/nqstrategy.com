import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultSiteBrand, navigationHref, siteBrandSchema } from '../lib/site-brand.mjs';
import { newPageBlock, pageTemplate } from '../lib/page-content.mjs';
import { applySitePreset, defaultHomeConfig, homeDisplaySettings } from '../lib/home-config.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-brand-test-'));
process.env.NEXUS_DB_PATH = path.join(root,'test.db');
process.env.NEXUS_AUTO_MIGRATE = '1';
const { default: db } = await import('../lib/db.js');
const { readBrandWorkspace, updateBrandWorkspace } = await import('../lib/site-brand-store.js');
try {
  const legacyHome=['hero','topics','featured','advertisement','articles','verification'];
  assert.ok(defaultHomeConfig({homeModules:JSON.stringify(legacyHome)}).modules.includes('discussions'),'legacy default homepage gains the requested discussions module');
  assert.deepEqual(defaultHomeConfig({homeModules:['hero','featured']}).modules,['hero','featured'],'custom legacy module selections remain unchanged');
  assert.deepEqual(homeDisplaySettings({homeModules:legacyHome,siteBrand:{home:{modules:legacyHome}}}).homeModules,legacyHome,'explicit published brand selections remain authoritative');
  const initial = defaultSiteBrand({ siteName: 'Existing brand' });
  assert.equal(siteBrandSchema.safeParse(initial).success,true);
  for (const config of [
    { ...initial, logoUrl:'javascript:alert(1)' },
    { ...initial, logoUrl:'/uploads/../private/icon.svg' },
    { ...initial, faviconUrl:'javascript:alert(1)' },
    { ...initial, faviconUrl:'/uploads/../private/favicon.ico' },
    { ...initial, catalogEnabled:'false' },
    { ...initial, tasksEnabled:'true' },
    { ...initial, navigation:[{label:'bad',labelEn:'',visible:true,kind:'external',target:'https://user:password@example.com'}] },
    { ...initial, navigation:[{label:'bad',labelEn:'',visible:true,kind:'external',target:'javascript:alert(1)'}] },
    { ...initial, navigation:[{label:'bad',labelEn:'',visible:true,kind:'route',target:'tianwei'}] },
    { ...initial, navigation:[{label:'missing',labelEn:'',visible:true,kind:'page',target:'missing'}] },
    { ...initial, pages:[{slug:'../admin',title:'Bad',description:'',body:'',enabled:true}] },
    { ...initial, arbitraryScript:'alert(1)' },
  ]) assert.equal(siteBrandSchema.safeParse(config).success,false);
  const page={slug:'about',title:'About',description:'About this brand',body:'<script>alert(1)</script>\nLiteral text',enabled:true};
  assert.deepEqual(siteBrandSchema.parse({...initial,pages:[page]}).pages[0].blocks,[],'old text pages remain valid');
  const richPage={...page,heroImageUrl:'/images/editorial/article-gold.webp',blocks:pageTemplate('brand','brand-test')};
  assert.equal(siteBrandSchema.safeParse({...initial,pages:[richPage]}).success,true);
  for (const blocks of [
    [{...newPageBlock('image','image-test'),imageUrl:'javascript:alert(1)'}],
    [{...newPageBlock('image','image-test'),imageUrl:'/uploads/../secret.png'}],
    [{...newPageBlock('image','image-test'),imageUrl:'data:image/svg+xml,<svg/>'}],
    [{...newPageBlock('action','action-test'),href:'javascript:alert(1)'}],
    [{...newPageBlock('action','action-test'),href:'https://user:password@example.com'}],
    [{...newPageBlock('action','action-test'),href:'/api/download?productId=1'}],
    [{...newPageBlock('action','action-test'),href:'/pages/missing'}],
    [newPageBlock('text','duplicate'),newPageBlock('text','duplicate')],
    Array.from({length:17},(_,i)=>newPageBlock('text',`block-${i}`)),
    [{...newPageBlock('text','html'),html:'<script>alert(1)</script>'}],
  ]) assert.equal(siteBrandSchema.safeParse({...initial,pages:[{...page,blocks}]}).success,false);
  assert.equal(siteBrandSchema.safeParse({...initial,pages:[{...page,blocks:[{...newPageBlock('action','self'),href:'/pages/about'}]}]}).success,true);
  const config={...initial,pages:[page],navigation:[...initial.navigation,{label:'About',labelEn:'About',kind:'page',target:'about',visible:true}]};
  assert.equal(siteBrandSchema.safeParse(config).success,true);
  assert.equal(siteBrandSchema.safeParse({...config,pages:[page,page]}).success,false);
  assert.equal(siteBrandSchema.safeParse({...config,pages:[{...page,enabled:false}]}).success,false);
  assert.equal(navigationHref(config.navigation.at(-1)),'/pages/about');
  assert.equal(navigationHref(initial.navigation[1]),'/?route=market');
  db.prepare("INSERT INTO settings(key,value) VALUES('siteName','Legacy name')").run();
  let workspace=readBrandWorkspace();
  assert.equal(workspace.published.name,'Legacy name');
  workspace=updateBrandWorkspace({action:'draft',revision:0,config});
  assert.equal(workspace.published.name,'Legacy name','saving draft does not change public configuration');
  assert.deepEqual(workspace.published.pages,[],'draft pages remain private');
  assert.throws(()=>updateBrandWorkspace({action:'publish',revision:0}),/BRAND_REVISION_CONFLICT/);
  assert.throws(()=>updateBrandWorkspace({action:'publish',revision:1},()=>false),/BRAND_AUDIT_FAILED/);
  assert.equal(readBrandWorkspace().revision,1,'audit failure rolls back the update');
  workspace=updateBrandWorkspace({action:'publish',revision:1});
  assert.equal(workspace.published.pages[0].slug,'about');
  assert.equal(workspace.history[0].config.name,'Legacy name');
  workspace=updateBrandWorkspace({action:'draft',revision:2,config:{...config,name:'Next brand'}});
  assert.equal(workspace.published.name,'Existing brand');
  workspace=updateBrandWorkspace({action:'restore',revision:3});
  assert.equal(workspace.published.name,'Legacy name');
  assert.deepEqual(workspace.published.pages,[]);
  assert.equal(workspace.draft.name,'Legacy name');
  assert.equal(db.prepare("SELECT value FROM settings WHERE key='siteName'").get().value,'Legacy name','no legacy settings changed');
  const { pointState, awardDailyAction } = await import('../lib/points.js');
  const { getPublicPost } = await import('../lib/public-post.js');
  const userId=Number(db.prepare("INSERT INTO users(username,email,password) VALUES('forum-test','forum-test@example.invalid','hash')").run().lastInsertRowid);
  const postId=Number(db.prepare("INSERT INTO posts(title,content,author,category) VALUES('Historical article','Keep this content','author','General')").run().lastInsertRowid);
  db.prepare("UPDATE point_tasks SET reward_points=3,enabled=1 WHERE code IN ('daily_post','daily_comment')").run();
  const publishMode=mode=>{let current=readBrandWorkspace();current=updateBrandWorkspace({action:'draft',revision:current.revision,config:{...current.draft,forumMode:mode}});return updateBrandWorkspace({action:'publish',revision:current.revision});};
  assert.equal(awardDailyAction(userId,'daily_post',postId).awarded,3);
  publishMode('archived');
  assert.equal(getPublicPost(postId).title,'Historical article');
  assert.equal(awardDailyAction(userId,'daily_comment',99).awarded,0);
  assert.ok(!pointState(userId).tasks.some(task=>['daily_post','daily_comment'].includes(task.code)));
  const pointsBefore=pointState(userId).balance;
  publishMode('disabled');
  assert.equal(getPublicPost(postId),null);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM posts').get().count,1,'disabling preserves posts');
  assert.equal(pointState(userId).balance,pointsBefore,'disabling does not remove earned points');
  publishMode('enabled');
  assert.equal(getPublicPost(postId).title,'Historical article');
  assert.ok(pointState(userId).tasks.some(task=>task.code==='daily_comment'));
  assert.equal(awardDailyAction(userId,'daily_comment',99).awarded,3,'reenabling restores rewards');
  const {submitPointClaim,reviewPointClaim,redeemWithPoints,createCustomPointTask}=await import('../lib/points.js');
  const manualTask=db.prepare("SELECT id FROM point_tasks WHERE code='tmgm_deposit'").get();
  const claimId=submitPointClaim(userId,manualTask.id,{contactEmail:'customer@example.invalid',customerId:'customer-test'});
  const customTaskId=createCustomPointTask({title:'Historical brand task',description:'Test-only task',rewardPoints:1,targetUrl:'',proofLabel:'Proof',enabled:true});
  const customClaimId=submitPointClaim(userId,customTaskId,{proofText:'Test-only submission'});
  const featureSnapshot=readBrandWorkspace().published;
  const publishFeatures=patch=>{let current=readBrandWorkspace();current=updateBrandWorkspace({action:'draft',revision:current.revision,config:{...current.draft,...patch}});return updateBrandWorkspace({action:'publish',revision:current.revision});};
  const retained=pointState(userId);
  publishFeatures({catalogEnabled:false,tasksEnabled:false});
  assert.deepEqual(pointState(userId).tasks,[],'disabled tasks are not offered');
  assert.equal(pointState(userId).balance,retained.balance,'task shutdown does not remove points');
  assert.equal(pointState(userId).claims.length,retained.claims.length,'pending task history remains available');
  assert.equal(pointState(userId).claims.find(claim=>claim.id===claimId).taskTitle,db.prepare('SELECT title FROM point_tasks WHERE id=?').get(manualTask.id).title,'historical task names remain available even when no tasks are offered');
  assert.equal(pointState(userId).claims.find(claim=>claim.id===customClaimId).taskTitle,'Historical brand task','custom submissions keep their actual task name after tasks are closed');
  assert.equal(awardDailyAction(userId,'daily_checkin').awarded,0,'automatic rewards are disabled at the ledger boundary');
  assert.throws(()=>submitPointClaim(userId,manualTask.id,{contactEmail:'customer@example.invalid',customerId:'customer-test'}),/POINT_TASKS_DISABLED/);
  assert.throws(()=>redeemWithPoints({id:userId},999,200),/CATALOG_DISABLED/,'catalog shutdown blocks new redemption');
  const disabledHome=homeDisplaySettings({siteBrand:readBrandWorkspace().published});
  assert.equal(disabledHome.home.showLead,false);assert.equal(disabledHome.home.showJourney,false);assert.ok(!disabledHome.homeModules.includes('featured'));
  const retainedReview=reviewPointClaim(userId,claimId,true);
  assert.equal(retainedReview.status,'approved','already-submitted work can still be reviewed after shutdown');
  publishFeatures(featureSnapshot);
  assert.equal(pointState(userId).tasksEnabled,true,'enabling restores task access');
  assert.equal(siteBrandSchema.safeParse({...initial,forumMode:'unknown'}).success,false);
  const source={...config,forumMode:'archived',name:'Keep brand',description:'Our story',logoUrl:'https://example.com/logo.png'};
  for(const key of ['ea','store','brand']){
    const preset=applySitePreset(source,key);
    assert.ok(siteBrandSchema.safeParse(preset).success);
    assert.deepEqual(preset.pages,source.pages,'presets retain custom pages');
    assert.equal(preset.forumMode,'archived','forum access is configured independently');
    assert.equal(preset.name,'Keep brand');assert.equal(preset.description,'Our story');assert.equal(preset.logoUrl,source.logoUrl);
    assert.ok(preset.navigation.some(item=>item.kind==='page'&&item.target==='about'),'custom navigation retained');
  }
  assert.equal(applySitePreset(source,'brand').home.showLead,false);
  assert.equal(applySitePreset(source,'brand').home.heroAction,'none');
  assert.throws(()=>applySitePreset(source,'unknown'),/UNKNOWN_SITE_PRESET/);
  assert.equal(siteBrandSchema.safeParse({...source,home:{...source.home,modules:['hero','hero']}}).success,false);
  assert.equal(siteBrandSchema.safeParse({...source,home:{...source.home,rotationSeconds:2}}).success,false);
  const legacy=defaultHomeConfig({homeModules:'["featured","hero"]',homeHeroTitle:'Legacy title',featuredAutoRotate:'false'});
  assert.deepEqual(legacy.modules,['featured','hero']);assert.equal(legacy.heroTitle,'Legacy title');assert.equal(legacy.autoRotate,false);
  const custom={...source,home:{...source.home,modules:[],heroTitle:'New title'}};
  let current=readBrandWorkspace();current=updateBrandWorkspace({action:'draft',revision:current.revision,config:custom});
  assert.notEqual(readBrandWorkspace().published.home.heroTitle,'New title','home draft remains private');
  updateBrandWorkspace({action:'publish',revision:current.revision});
  const display=homeDisplaySettings({homeHeroTitle:'Stale legacy title',siteBrand:readBrandWorkspace().published});
  assert.equal(display.homeHeroTitle,'New title');assert.deepEqual(display.homeModules,[],'disabled modules stay empty');
  assert.equal(db.prepare('SELECT COUNT(*) count FROM posts').get().count,1);
  assert.equal(pointState(userId).balance,pointsBefore+3+retainedReview.awarded,'presets and home publishing preserve points including approved historical work');
  process.env.NEXUS_PUBLIC_UPLOAD_ROOT=path.join(root,'uploads');
  const {cleanupExpiredUploads,enforceUploadQuota,storedPath,sha256}=await import('../lib/upload-security.js');
  const previousRaw=db.prepare("SELECT value FROM settings WHERE key='siteBrandWorkspace'").get().value;
  const uploadNames=['draft-cover.png','published-block.png','historical-logo.png','favicon.png'];
  fs.mkdirSync(process.env.NEXUS_PUBLIC_UPLOAD_ROOT,{recursive:true});
  for(const name of uploadNames){
    fs.writeFileSync(storedPath('image',name),'test-image');
    db.prepare("INSERT INTO uploads(owner_user_id,url,kind,original_name,size,stored_name,content_sha256,mime_type,status,expires_at) VALUES(?,?,'image',?,10,?,?,'image/png','clean',?)").run(userId,`/uploads/${name}`,name,name,sha256(Buffer.from(name)),Date.now()-1);
  }
  const referenceWorkspace={draft:{faviconUrl:'/uploads/favicon.png',pages:[{heroImageUrl:'/uploads/draft-cover.png'}]},published:{pages:[{blocks:[{type:'image',imageUrl:'/uploads/published-block.png'}]}]},history:[{config:{logoUrl:'/uploads/historical-logo.png'}}]};
  db.prepare("UPDATE settings SET value=? WHERE key='siteBrandWorkspace'").run(JSON.stringify(referenceWorkspace));
  for(let i=0;i<7;i++)db.prepare("INSERT INTO uploads(owner_user_id,url,kind,original_name,size,stored_name,content_sha256,mime_type,status,expires_at) VALUES(?,?,'image',?,10,?,?,'image/png','clean',?)").run(userId,`/uploads/quota-${i}.png`,`quota-${i}.png`,`quota-${i}.png`,sha256(Buffer.from(`quota-${i}`)),Date.now()+60000);
  assert.doesNotThrow(()=>enforceUploadQuota(userId,100),'saved brand images do not consume pending upload slots');
  assert.equal(cleanupExpiredUploads(),0,'draft, published and history images survive expiry');
  for(const name of uploadNames)assert.equal(fs.existsSync(storedPath('image',name)),true);
  db.prepare("UPDATE settings SET value=? WHERE key='siteBrandWorkspace'").run(previousRaw);
  assert.equal(cleanupExpiredUploads(),4,'unreferenced expired images can be cleaned');
  for(const name of uploadNames)assert.equal(fs.existsSync(storedPath('image',name)),false);
  console.log('Brand configuration: validation, private draft, conflict handling, atomic audit rollback, publish and restore passed.');
} finally { db.close(); fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100}); }

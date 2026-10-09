import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { defaultSiteBrand } from '../lib/site-brand.mjs';
import { pageTemplate } from '../lib/page-content.mjs';
import { applySitePreset } from '../lib/home-config.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-brand-http-'));
const port=3217, origin='https://nexus.test';
const jwtSecret='brand-http-jwt-placeholder-0123456789abcdef', proxySecret='brand-http-proxy-placeholder-0123456789abcdef';
const env={...process.env,NODE_ENV:'production',NEXUS_DB_PATH:path.join(root,'test.db'),NEXUS_AUTO_MIGRATE:'1',JWT_SECRET:jwtSecret,
  AUDIT_INTEGRITY_SECRET:'brand-http-audit-placeholder-0123456789abcdef',LEDGER_INTEGRITY_SECRET:'brand-http-ledger-placeholder-0123456789abcdef',
  LICENSE_SIGNING_SECRET:'brand-http-signing-placeholder-0123456789abcdef',LICENSE_BINDING_SECRET:'brand-http-binding-placeholder-0123456789abcdef',
  TRUSTED_PROXY_MODE:'nginx',TRUSTED_PROXY_SHARED_SECRET:proxySecret,RATE_LIMIT_BACKEND:'sqlite',DEPLOYMENT_TOPOLOGY:'single-instance',AUDIT_RETENTION_DAYS:'180',APP_ORIGINS:origin};
function cookie(id){const data=Buffer.from(JSON.stringify({id,sv:1,exp:Date.now()+300000})).toString('base64url');return `nexus_token=${data}.${crypto.createHmac('sha256',jwtSecret).update(data).digest('base64url')}`;}
async function request(url,{id,body,headers={}}={}){return fetch(`http://127.0.0.1:${port}${url}`,{method:body?'POST':'GET',headers:{Origin:origin,'X-Nexus-Proxy-Secret':proxySecret,'X-Real-IP':'198.51.100.19',...(id?{Cookie:cookie(id)}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});}
let server, output='';
try{
  const seed=spawnSync(process.execPath,['--input-type=module','-e',"import db from './lib/db.js'; db.prepare(\"INSERT INTO users(username,email,password,role) VALUES('brand-admin','brand-admin@example.invalid','hash','admin'),('brand-user','brand-user@example.invalid','hash','user')\").run(); db.close();"],{env,encoding:'utf8',windowsHide:true});
  assert.equal(seed.status,0,seed.stderr);
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port)],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>output+=data);
  let ready=false;
  for(let count=0;count<80;count++){await new Promise(resolve=>setTimeout(resolve,500));try{if((await request('/api/settings')).ok){ready=true;break;}}catch{}}
  assert.equal(ready,true,output);
  assert.equal((await request('/')).status,200,'anonymous homepage must render before user summaries load');
  assert.equal((await request('/api/site-brand')).status,403);
  assert.equal((await request('/api/site-brand',{id:2})).status,403);
  assert.equal((await request('/api/site-brand',{id:2,body:{action:'publish',revision:0}})).status,403);
  const brand={...defaultSiteBrand(),name:'Test independent brand',seoTitle:'Independent brand test',pages:[{slug:'about',title:'About our brand',description:'Unique page description',body:'Private draft marker\n<script>alert(1)</script>',enabled:true,heroImageUrl:'/images/editorial/article-gold.webp',blocks:pageTemplate('brand','http-brand')}]};
  brand.faviconUrl='/images/editorial/article-ai.webp';
  brand.navigation.push({label:'About',labelEn:'About',kind:'page',target:'about',visible:true});
  const saved=await request('/api/site-brand',{id:1,body:{action:'draft',revision:0,config:brand}});assert.equal(saved.status,200,await saved.clone().text());
  const settings=await(await request('/api/settings')).json();assert.equal(settings.siteName,'Nexus Quant');assert.deepEqual(settings.siteBrand.pages,[]);
  assert.equal((await request('/pages/about')).status,404);
  assert.equal((await request('/pages/about?preview=draft')).status,404);
  assert.equal((await request('/pages/about?preview=draft',{id:2})).status,404);
  const preview=await request('/pages/about?preview=draft',{id:1,headers:{'User-Agent':'Googlebot'}});assert.equal(preview.status,200);
  const previewText=await preview.text();assert.ok(previewText.includes('Private draft marker'));assert.ok(previewText.includes('noindex'));
  assert.equal((await request('/api/site-brand',{id:1,body:{action:'publish',revision:0}})).status,409);
  assert.equal((await request('/api/site-brand',{id:1,body:{action:'publish',revision:1}})).status,200);
  const publicSettings=await(await request('/api/settings')).json();assert.equal(publicSettings.siteName,brand.name);assert.equal(publicSettings.siteBrand.pages[0].slug,'about');assert.equal(publicSettings.siteBrand.history,undefined);
  const page=await request('/pages/about',{headers:{'User-Agent':'Googlebot'}});assert.equal(page.status,200);const html=await page.text();
  assert.ok(html.includes('custom-page-image'));assert.ok(html.includes('/images/editorial/article-gold.webp'));assert.ok(html.includes('关于我们的品牌'));assert.ok(html.includes('href="/?route=market"'));assert.ok(html.includes('About our brand')); assert.ok(html.includes('Unique page description'));assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html,/rel="icon"[^>]*href="\/images\/editorial\/article-ai.webp"/,'published favicon is rendered in metadata');
  assert.ok((await(await request('/sitemap.xml')).text()).includes('/pages/about'));
  assert.equal((await request('/api/site-brand',{id:1,body:{action:'restore',revision:2}})).status,200);
  assert.equal((await request('/pages/about')).status,404);
  assert.ok(!(await(await request('/sitemap.xml')).text()).includes('/pages/about'));
  assert.equal((await(await request('/api/settings')).json()).siteName,'Nexus Quant');
  const publishMode=async forumMode=>{
    let workspace=(await(await request('/api/site-brand',{id:1})).json()).workspace;
    const saved=await request('/api/site-brand',{id:1,body:{action:'draft',revision:workspace.revision,config:{...workspace.draft,forumMode}}});assert.equal(saved.status,200);
    workspace=(await saved.json()).workspace;
    assert.equal((await request('/api/site-brand',{id:1,body:{action:'publish',revision:workspace.revision}})).status,200);
  };
  const created=await request('/api/posts',{id:2,body:{title:'Historical forum article',content:'This article must remain after disabling the forum.',category:'XAUUSD 策略',attachments:[]}});
  assert.equal(created.status,201,await created.clone().text());const postId=(await created.json()).id;
  await publishMode('archived');
  assert.equal((await request('/api/posts')).status,403);
  assert.equal((await request(`/api/posts?viewId=${postId}`)).status,200);
  assert.equal((await request(`/forum/${postId}`)).status,200);
  assert.equal((await request('/api/posts',{id:2,body:{title:'blocked',content:'Blocked forum write',category:'XAUUSD 策略',attachments:[]}})).status,403);
  assert.equal((await request('/api/comments',{id:2,body:{postId,content:'Blocked reply'}})).status,403);
  const upload = await fetch(`http://127.0.0.1:${port}/api/post-attachments`,{method:'POST',headers:{Origin:origin,'X-Nexus-Proxy-Secret':proxySecret,'X-Real-IP':'198.51.100.19',Cookie:cookie(2)},body:new FormData()});
  assert.equal(upload.status,403);
  assert.ok((await(await request('/sitemap.xml')).text()).includes(`/forum/${postId}`));
  await publishMode('disabled');
  assert.equal((await request(`/forum/${postId}`)).status,404);
  assert.equal((await request(`/api/posts?viewId=${postId}`)).status,403);
  assert.equal((await request(`/api/comments?postId=${postId}`)).status,403);
  assert.equal((await request(`/api/share-image?type=article&id=${postId}`)).status,404);
  assert.ok(!(await(await request('/sitemap.xml')).text()).includes(`/forum/${postId}`));
  assert.equal((await request('/api/posts',{id:1})).status,200,'administrators retain moderation access');
  await publishMode('enabled');
  assert.equal((await request('/api/posts')).status,200);
  assert.equal((await request(`/forum/${postId}`)).status,200,'reenabling restores historical article');
  assert.equal((await request('/api/comments',{id:2,body:{postId,content:'Replies work again'}})).status,201);
  assert.equal((await request('/cryptomus_5aac3283.html')).status,404,'retired verification file is removed');
  let workspace=(await(await request('/api/site-brand',{id:1})).json()).workspace;
  const preset=applySitePreset({...workspace.draft,description:'A real brand description'},'brand');
  preset.home.modules=['brandIntro','hero'];preset.home.heroTitle='Published home title';
  assert.equal((await request('/api/site-brand',{id:1,body:{action:'draft',revision:workspace.revision,config:preset}})).status,200);
  const beforePublish=(await(await request('/api/settings')).json()).siteBrand;
  assert.notEqual(beforePublish.home.heroTitle,'Published home title');
  workspace=(await(await request('/api/site-brand',{id:1})).json()).workspace;
  assert.equal((await request('/api/site-brand',{id:1,body:{action:'publish',revision:workspace.revision}})).status,200);
  const published=(await(await request('/api/settings')).json()).siteBrand;
  assert.equal(published.home.heroTitle,'Published home title');assert.deepEqual(published.home.modules,['brandIntro','hero']);
  assert.equal(published.forumMode,'enabled','presentation preset does not disable forum');
  assert.equal((await request(`/forum/${postId}`)).status,200,'presentation preset retains old articles');
  workspace=(await(await request('/api/site-brand',{id:1})).json()).workspace;
  assert.equal((await request('/api/site-brand',{id:1,body:{action:'restore',revision:workspace.revision}})).status,200);
  assert.equal((await(await request('/api/settings')).json()).siteBrand.preset,'custom');
  assert.equal((await request('/api/points?view=summary')).status,401);
  const summaryResponse=await request('/api/points?view=summary',{id:2});assert.equal(summaryResponse.status,200);
  const pointSummary=await summaryResponse.json();
  assert.deepEqual(Object.keys(pointSummary).sort(),['balance','brokerClaimStatus','success']);
  assert.ok(summaryResponse.headers.get('cache-control').includes('no-store'));
  const adminSummary=await(await request('/api/points?view=summary',{id:1})).json();
  assert.equal(adminSummary.balance,0,'administrator cannot receive another user balance in summary');
  const publicReward=(await(await request('/api/settings')).json()).brokerReward;
  assert.deepEqual(Object.keys(publicReward).sort(),['enabled','rewardPoints']);
  const featureBefore=(await(await request('/api/site-brand',{id:1})).json()).workspace;
  const featureDraft=await request('/api/site-brand',{id:1,body:{action:'draft',revision:featureBefore.revision,config:{...featureBefore.draft,catalogEnabled:false,tasksEnabled:false}}});
  assert.equal(featureDraft.status,200);const featureWorkspace=(await featureDraft.json()).workspace;
  assert.equal((await request('/api/products?market=1')).status,200,'unsaved public state does not follow draft switches');
  assert.equal((await request('/api/site-brand',{id:1,body:{action:'publish',revision:featureWorkspace.revision}})).status,200);
  assert.equal((await request('/api/products?market=1')).status,403,'published catalog switch gates server catalog');
  assert.deepEqual((await(await request('/api/products')).json()).products,[],'public products are hidden');
  assert.equal((await request('/api/products?role=admin',{id:1})).status,200,'administrator retains catalog management');
  assert.equal((await request('/api/orders',{id:2})).status,200,'own historical orders remain available');
  assert.equal((await request('/api/orders',{id:2,body:{productId:1}})).status,403,'new free orders are blocked');
  assert.equal((await request('/api/points',{id:2,body:{action:'redeem',productId:1,expectedPointsPrice:200}})).status,403,'new paid redemption is blocked');
  assert.equal((await request('/api/points',{id:2,body:{action:'checkin'}})).status,403,'checkin is blocked');
  assert.equal((await request('/api/points',{id:2,body:{action:'submit_claim',taskId:1}})).status,403,'new task claims are blocked');
  const preserved=await(await request('/api/points',{id:2})).json();assert.deepEqual(preserved.tasks,[]);assert.equal(preserved.tasksEnabled,false);assert.ok(Array.isArray(preserved.transactions));
  const rewardOff=(await(await request('/api/settings')).json()).brokerReward;assert.equal(rewardOff.enabled,false);
  const restoreWorkspace=(await(await request('/api/site-brand',{id:1})).json()).workspace;
  assert.equal((await request('/api/site-brand',{id:1,body:{action:'restore',revision:restoreWorkspace.revision}})).status,200);
  assert.equal((await request('/api/products?market=1')).status,200,'restoring reopens the catalog');
  console.log('Brand HTTP passed: RBAC, private drafts, noindex previews, stale revisions, public metadata, safe text rendering, sitemap and restoration.');
}finally{
  if(server&&server.exitCode===null){server.kill();await Promise.race([new Promise(resolve=>server.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);}
  assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}

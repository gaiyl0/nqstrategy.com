import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import sharp from 'sharp';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-post-image-http-'));
const port = 3233, origin = 'https://nexus.test';
const jwtSecret = 'post-image-http-jwt-test-only-0123456789abcdef';
const proxySecret = 'post-image-http-proxy-test-only-0123456789abcdef';
const env = { ...process.env, NODE_ENV:'production', NEXUS_DB_PATH:path.join(root,'test.db'), NEXUS_AUTO_MIGRATE:'1', JWT_SECRET:jwtSecret,
  AUDIT_INTEGRITY_SECRET:'post-image-audit-test-only-0123456789abcdef', LEDGER_INTEGRITY_SECRET:'post-image-ledger-test-only-0123456789abcdef',
  LICENSE_SIGNING_SECRET:'post-image-signing-test-only-0123456789abcdef', LICENSE_BINDING_SECRET:'post-image-binding-test-only-0123456789abcdef',
  TRUSTED_PROXY_MODE:'nginx', TRUSTED_PROXY_SHARED_SECRET:proxySecret, RATE_LIMIT_BACKEND:'sqlite', DEPLOYMENT_TOPOLOGY:'single-instance',
  AUDIT_RETENTION_DAYS:'180', AUDIT_ARCHIVE_DIR:'storage/audit-archives', APP_ORIGINS:origin, NEXT_PUBLIC_SITE_URL:origin,
  NEXUS_STORAGE_ROOT:path.join(root,'storage','private','eas'), UPLOAD_SCAN_TOKEN:'isolated-scan-test' };
const cookie = id => { const value=Buffer.from(JSON.stringify({id,sv:1,exp:Date.now()+300000})).toString('base64url');return `nexus_token=${value}.${crypto.createHmac('sha256',jwtSecret).update(value).digest('base64url')}`; };
let server, output='', scanner;
async function request(url,{id,method='GET',json,body}={}) {
  return fetch(`http://127.0.0.1:${port}${url}`,{method,headers:{Origin:origin,'X-Nexus-Proxy-Secret':proxySecret,'X-Real-IP':'198.51.100.33',...(id?{Cookie:cookie(id)}:{}),...(json?{'Content-Type':'application/json'}:{})},body:json?JSON.stringify(json):body});
}
try {
  // A test-only scanner verifies real image bytes without weakening production scanning.
  scanner=http.createServer(async(req,res)=>{let size=0;for await(const bytes of req)size+=bytes.length;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({clean:size>0 && req.headers.authorization==='Bearer isolated-scan-test'}));});
  await new Promise(resolve=>scanner.listen(0,'127.0.0.1',resolve));
  env.UPLOAD_SCAN_URL=`http://127.0.0.1:${scanner.address().port}`;
  const seed=spawnSync(process.execPath,['--input-type=module','-e',"import db from './lib/db.js'; db.prepare(\"INSERT INTO users(username,email,password,role) VALUES('image-author','image-author@test.invalid','hash','user'),('image-other','image-other@test.invalid','hash','user')\").run(); db.close();"],{env,encoding:'utf8',windowsHide:true});
  assert.equal(seed.status,0,seed.stderr);
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',bytes=>output+=bytes);server.stderr.on('data',bytes=>output+=bytes);
  let ready=false;
  for(let i=0;i<100;i++){await new Promise(resolve=>setTimeout(resolve,500));try{if((await request('/api/settings')).ok){ready=true;break;}}catch{}}
  assert.ok(ready,output);
  const image=await sharp({create:{width:80,height:48,channels:3,background:'#087b73'}}).png().toBuffer();
  const upload=async(id,bytes=image)=>{const form=new FormData();form.append('file',new Blob([bytes],{type:'image/png'}),'pasted-image.png');return request('/api/post-attachments',{id,method:'POST',body:form});};
  assert.equal((await upload(undefined)).status,401);
  assert.equal((await upload(1,Buffer.from('<script>fake image</script>'))).status,400);
  const created=await upload(1);assert.equal(created.status,201,await created.clone().text());
  const attachment=(await created.json()).attachment;
  assert.equal(attachment.kind,'image');assert.equal(attachment.url,`/api/post-attachments?id=${attachment.id}`);
  for(const id of [undefined,2])assert.equal((await request(attachment.url,{id})).status,404,'unpublished image is private');
  const draft=await request(attachment.url,{id:1});assert.equal(draft.status,200);assert.equal(draft.headers.get('content-type'),'image/png');
  assert.equal((await sharp(Buffer.from(await draft.arrayBuffer())).metadata()).width,80);
  const content=`正文前缀![截图](${attachment.url})正文后缀\r\n## 参数说明`;
  assert.equal((await request('/api/posts',{id:1,method:'POST',json:{title:'Image ownership test',category:'MQL5',content,attachments:[]}})).status,400);
  assert.equal((await request('/api/posts',{id:2,method:'POST',json:{title:'Image ownership test',category:'MQL5',content,attachments:[attachment.id]}})).status,409);
  const posted=await request('/api/posts',{id:1,method:'POST',json:{title:'Image display test',category:'MQL5',content,attachments:[attachment.id]}});
  assert.equal(posted.status,201,await posted.clone().text());const postId=(await posted.json()).id;
  const publicImage=await request(attachment.url);assert.equal(publicImage.status,200);assert.match(publicImage.headers.get('content-disposition'),/^inline;/);
  const article=await request(`/forum/${postId}`);assert.equal(article.status,200);const html=await article.text();
  const body=html.match(/<section id="article-body"[^>]*>([\s\S]*?)<\/section>/)?.[1]||'';
  assert.match(body,/<img[^>]+src="\/api\/post-attachments\?id=/,'published body renders an actual image, including legacy inline markers');
  assert.ok(body.includes('正文前缀')&&body.includes('正文后缀'));
  assert.ok(!body.includes('![截图]('),'raw image marker is not shown in the article');
  assert.match(body,/id="article-section-1"/,'heading anchors retain original line numbers');
  console.log('Post image HTTP tests passed: clipboard-shaped PNG upload, scanner, draft privacy, ownership, public image bytes and article HTML rendering');
} finally {
  if(server && server.exitCode===null){const exited=new Promise(resolve=>server.once('exit',resolve));server.kill();await exited;}
  if(scanner)await new Promise(resolve=>scanner.close(resolve));
  const cleanupRoot=path.resolve(root);
  assert.ok(cleanupRoot.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`) && path.basename(cleanupRoot).startsWith('nexus-post-image-http-'));
  fs.rmSync(cleanupRoot,{recursive:true,force:true});
}

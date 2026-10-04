import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {articleSummary,articleHeadings,shareLinks,shareMetadata} from '../lib/share-content.mjs';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-share-test-'));
process.env.NEXUS_DB_PATH=path.join(directory,'test.db');
const {default:db}=await import('../lib/db.js');
const {getPublicPost}=await import('../lib/public-post.js');
let count=0;const eq=(a,b)=>{assert.deepEqual(a,b);count++};
try {
  eq(articleSummary('## 黄金\n\n**回撤** ![图片](/api/post-attachments?id=1)\n[资料](https://example.com)'),'黄金 回撤 资料');
  eq(articleSummary('a'.repeat(200)).length,160);
  eq(articleSummary('研究摘要\n<script>alert(1)</script>'),'研究摘要');
  eq(articleSummary('正文\n```js\nexample()\n```'),'正文');
  eq(articleHeadings('# A\ntext\n## B'),[{id:'article-section-0',title:'A'},{id:'article-section-2',title:'B'}]);
  const url='https://nqstrategy.com/forum/1',title='黄金 & EA #回撤';
  const links=shareLinks(url,title);for(const link of Object.values(links)){const parsed=new URL(link);eq(parsed.searchParams.get('url'),url);eq(parsed.searchParams.get('text'),title)}
  const meta=shareMetadata({title,description:'摘要',path:'/forum/1',image:'/api/share-image?type=article&id=1',article:true,author:'作者',date:'2026-10-04T00:00:00Z'});
  eq(meta.openGraph.type,'article');eq(meta.twitter.card,'summary_large_image');eq(meta.openGraph.images[0].width,1200);eq(meta.alternates.canonical,'/forum/1');
  const add=db.prepare("INSERT INTO posts(title,content,author,category,moderation_status) VALUES(?,?,?,'XAUUSD 策略',?)");
  const id=Number(add.run('可分享文章','## 研究\n![封面](/api/post-attachments?id=987654)','作者','visible').lastInsertRowid);
  const hidden=Number(add.run('绝不能公开','隐藏秘密','作者','hidden').lastInsertRowid);
  const post=getPublicPost(id);eq(post.title,'可分享文章');eq(post.coverUrl,'/images/editorial/article-gold.webp');eq(post.attachments,[]);
  for(const invalid of [hidden,0,-1,'01','1 OR 1=1','../../1',Number.MAX_SAFE_INTEGER+1])eq(getPublicPost(invalid),null);
  const user={id:Number(db.prepare("INSERT INTO users(username,email,password) VALUES('测试作者','share-test@example.invalid','not-a-login-password')").run().lastInsertRowid)};
  const attachment=db.prepare("INSERT INTO post_attachments(owner_user_id,post_id,kind,original_name,stored_name,content_sha256,mime_type,size,status,created_at) VALUES(?,?,'image','cover.png',?,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','image/png',10,?,?)");
  attachment.run(user.id,hidden,'1791080000_abcd.png','clean',Date.now());
  eq(getPublicPost(id).coverUrl,'/images/editorial/article-gold.webp');
  const imageId=Number(attachment.run(user.id,id,'1791080001_bcde.png','clean',Date.now()).lastInsertRowid);
  eq(getPublicPost(id).coverUrl,`/api/post-attachments?id=${imageId}`);
  db.prepare("UPDATE posts SET moderation_status='hidden' WHERE id=?").run(id);eq(getPublicPost(id),null);
  db.prepare('DELETE FROM posts WHERE id=?').run(id);eq(getPublicPost(id),null);
  console.log(`Share pages passed ${count} assertions: metadata, URL encoding, headings, visible-content and attachment boundaries`);
} finally {db.close();assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(directory,{recursive:true,force:true})}




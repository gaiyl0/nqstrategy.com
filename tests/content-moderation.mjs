import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dbPath=path.resolve('.tmp-content-moderation-test.db');
for(const suffix of ['', '-wal', '-shm']){try{fs.rmSync(`${dbPath}${suffix}`);}catch{}}
process.env.NEXUS_DB_PATH=dbPath;
const {default:db}=await import('../lib/db.js');
const {createContentReport,listContentReports,resolveContentReport}=await import('../lib/content-moderation.js');
let assertions=0;
const equal=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);assertions+=1;};
const throws=(callback,pattern)=>{assert.throws(callback,pattern);assertions+=1;};

const insertUser=db.prepare("INSERT INTO users(username,email,role,password) VALUES(?,?,?,'hash')");
const owner=Number(insertUser.run('moderation-owner','owner@example.com','developer').lastInsertRowid);
const reporter=Number(insertUser.run('moderation-reporter','reporter@example.com','user').lastInsertRowid);
const admin=Number(insertUser.run('moderation-admin','admin@example.com','admin').lastInsertRowid);
const product=Number(db.prepare("INSERT INTO products(title,author,author_user_id,price,status) VALUES('Reported EA','moderation-owner',?,0,'active')").run(owner).lastInsertRowid);
const post=Number(db.prepare("INSERT INTO posts(title,content,author,author_user_id,category) VALUES('Reported post','body','moderation-owner',?,'官方公告')").run(owner).lastInsertRowid);
const comment=Number(db.prepare("INSERT INTO comments(post_id,content,author,author_user_id) VALUES(?,'Reported comment','moderation-owner',?)").run(post,owner).lastInsertRowid);

throws(()=>createContentReport(owner,{targetType:'product',targetId:product,reason:'other',details:''}),/SELF_REPORT/);
const first=createContentReport(reporter,{targetType:'product',targetId:product,reason:'fraud',details:'suspicious claims'});
const replay=createContentReport(reporter,{targetType:'product',targetId:product,reason:'fraud',details:'duplicate'});
equal(replay.replayed,true,'duplicate pending report replays');
equal(first.id,replay.id,'duplicate pending report keeps the original identity');
equal(db.prepare("SELECT COUNT(*) count FROM content_reports WHERE status='pending'").get().count,1,'pending unique constraint prevents duplicate rows');
const dismissed=resolveContentReport(first.id,'dismiss','证据不足，驳回举报',admin);
equal(dismissed.status,'dismissed','admin can dismiss a report');
equal(db.prepare('SELECT moderation_status FROM products WHERE id=?').get(product).moderation_status,'visible','dismissal keeps content visible');
equal(resolveContentReport(first.id,'confirm','重复处理不会生效',admin).replayed,true,'resolved report is idempotent');

const postReport=createContentReport(reporter,{targetType:'post',targetId:post,reason:'abuse',details:''});
equal(resolveContentReport(postReport.id,'confirm','确认存在违规内容',admin).status,'confirmed','admin can confirm violation');
equal(db.prepare('SELECT moderation_status FROM posts WHERE id=?').get(post).moderation_status,'hidden','confirmed report hides target exactly once');
throws(()=>createContentReport(reporter,{targetType:'post',targetId:post,reason:'other',details:''}),/TARGET_NOT_FOUND/);

const commentReport=createContentReport(reporter,{targetType:'comment',targetId:comment,reason:'spam',details:''});
resolveContentReport(commentReport.id,'confirm','确认评论属于垃圾内容',admin);
equal(db.prepare('SELECT moderation_status FROM comments WHERE id=?').get(comment).moderation_status,'hidden','comment moderation uses the same controlled flow');
equal(listContentReports('confirmed').length,2,'admin list returns confirmed reports');

const windowStart=Date.now()-Date.now()%21600000;
const addView=db.prepare('INSERT OR IGNORE INTO post_view_events(post_id,viewer_key,window_start,created_at) VALUES(?,?,?,?)');
equal(addView.run(post,'source:test',windowStart,Date.now()).changes,1,'first view in a six-hour window is counted');
equal(addView.run(post,'source:test',windowStart,Date.now()).changes,0,'repeated view in same window is deduplicated');

db.close();
for(const suffix of ['', '-wal', '-shm']){try{fs.rmSync(`${dbPath}${suffix}`);}catch{}}
console.log(`Content moderation tests passed: ${assertions} assertions`);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dbPath=path.resolve('.tmp-social-test.db');
for(const suffix of ['', '-wal', '-shm']){try{fs.rmSync(`${dbPath}${suffix}`);}catch{}}
process.env.NEXUS_DB_PATH=dbPath;
const {default:db}=await import('../lib/db.js');
const {listSocialState,productSocialSummary,setFavorite,setFollow,setRating}=await import('../lib/social.js');
let assertions=0;const check=(value,message)=>{assert.ok(value,message);assertions+=1;};const equal=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);assertions+=1;};
const insertUser=db.prepare("INSERT INTO users(username,email,role,password) VALUES(?,?,?,'hash')");
const developer=Number(insertUser.run('dev-social','dev-social@example.com','developer').lastInsertRowid);
const buyer=Number(insertUser.run('buyer-social','buyer-social@example.com','user').lastInsertRowid);
const trialUser=Number(insertUser.run('trial-social','trial-social@example.com','user').lastInsertRowid);
const product=Number(db.prepare("INSERT INTO products(title,author,author_user_id,price,status) VALUES('Social EA','dev-social',?,0,'active')").run(developer).lastInsertRowid);
const order=Number(db.prepare("INSERT INTO orders(username,buyer_user_id,product_id,price,status,payment_verified) VALUES('buyer-social',?,?,0,'completed',0)").run(buyer,product).lastInsertRowid);
db.prepare("INSERT INTO product_licenses(user_id,product_id,source_order_id,license_type,status,starts_at,created_at) VALUES(?,?,?,'free','active',?,?)").run(buyer,product,order,Date.now(),Date.now());
db.prepare("INSERT INTO uploads(id,owner_user_id,url,kind,size,stored_name,content_sha256,status,created_at) VALUES(999,?,'private://test-upload','ea',10,'test.ex5','abc','attached',?)").run(developer,Date.now());
db.prepare("INSERT INTO product_versions(product_id,version,release_notes,upload_id,file_url,content_sha256,upgrade_policy,status,is_current,submitted_by_user_id,created_at) VALUES(?,?,?,999,'private://test','abc','all_existing','published',1,?,?)").run(product,'1.0.0','test',developer,Date.now());
db.prepare("INSERT INTO product_licenses(user_id,product_id,version_id,license_type,status,starts_at,expires_at,created_at) VALUES(?,?,1,'trial','active',?,?,?)").run(trialUser,product,Date.now(),Date.now()+100000,Date.now());

setFavorite(buyer,product,true);setFavorite(buyer,product,true);
equal(db.prepare('SELECT COUNT(*) count FROM product_favorites').get().count,1,'favorite is idempotent');
setFavorite(buyer,product,false);equal(db.prepare('SELECT COUNT(*) count FROM product_favorites').get().count,0,'favorite can be removed');
assert.throws(()=>setFollow(developer,developer,true),/SELF_FOLLOW/);assertions+=1;
setFollow(buyer,developer,true);setFollow(buyer,developer,true);equal(db.prepare('SELECT COUNT(*) count FROM developer_follows').get().count,1,'follow is unique');
assert.throws(()=>setRating(trialUser,product,5,'trial'),/PERMANENT_LICENSE_REQUIRED/);assertions+=1;
assert.throws(()=>setRating(developer,product,5,'self'),/SELF_RATING/);assertions+=1;
setRating(buyer,product,4,'good');setRating(buyer,product,5,'updated');
equal(db.prepare('SELECT COUNT(*) count FROM product_ratings').get().count,1,'rating upserts instead of accumulating');
equal(db.prepare('SELECT rating FROM product_ratings').get().rating,5,'rating update persists');
const publicSummary=productSocialSummary(product);equal(publicSummary.viewer,null,'public summary exposes no viewer identity');
equal(publicSummary.ratingAverage,5,'aggregate average is correct');equal(publicSummary.ratingCount,1,'aggregate count is correct');
const privateState=listSocialState(buyer);equal(privateState.follows[0].developerUserId,developer,'personal state uses stable developer id');equal(privateState.ratings[0].productId,product,'personal rating uses stable product id');
check(!JSON.stringify(publicSummary).includes('buyer-social'),'public aggregate does not leak username');
db.close();for(const suffix of ['', '-wal', '-shm']){try{fs.rmSync(`${dbPath}${suffix}`);}catch{}}
console.log(`Social tests passed: ${assertions} assertions`);

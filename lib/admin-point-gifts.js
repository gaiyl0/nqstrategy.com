import db from './db.js';
import {applyPointAssetDelta,pointsFromUnits} from './point-assets.js';
import {notifyUser} from './inbox.js';

export function giftPoints(admin,userId,points,reason,requestKey,now=Date.now()) {
  return db.transaction(()=>{
    if(admin?.role!=='admin'||!db.prepare("SELECT 1 FROM users WHERE id=? AND role='admin' AND deleted_at IS NULL").get(admin.id))throw Error('GIFT_FORBIDDEN');
    const units=Math.round(points*100);
    if(!Number.isSafeInteger(units)||units<1||units>100000000||Math.abs(units-points*100)>0.000001||!Number.isSafeInteger(userId))throw Error('GIFT_INVALID');
    if(typeof reason!=='string'||reason.trim().length<3||reason.length>300||!/^[-a-zA-Z0-9]{16,80}$/.test(requestKey))throw Error('GIFT_INVALID');
    const prior=db.prepare('SELECT * FROM admin_point_gifts WHERE request_key=?').get(requestKey);
    if(prior){
      if(prior.admin_id!==admin.id||prior.user_id!==userId||prior.units!==units||prior.reason!==reason.trim())throw Error('GIFT_KEY_CONFLICT');
      return {id:prior.id,points:pointsFromUnits(prior.units),replayed:true};
    }
    if(!db.prepare("SELECT 1 FROM users WHERE id=? AND deleted_at IS NULL AND role<>'banned'").get(userId))throw Error('GIFT_USER_UNAVAILABLE');
    const id=Number(db.prepare('INSERT INTO admin_point_gifts(request_key,user_id,admin_id,units,reason,created_at) VALUES(?,?,?,?,?,?)').run(requestKey,userId,admin.id,units,reason.trim(),now).lastInsertRowid);
    const transaction=applyPointAssetDelta(userId,{bonus:units},`admin-gift:${id}`,'admin_gift',{giftId:id,adminId:admin.id,reason:reason.trim()},now);
    db.prepare('UPDATE admin_point_gifts SET transaction_id=? WHERE id=?').run(transaction.id,id);
    notifyUser(userId,'system','管理员赠送积分',`收到 ${pointsFromUnits(units)} 奖励积分。原因：${reason.trim()}。赠送积分及其产生的奖励分成不可提现。`,'/?route=points',now);
    return {id,points:pointsFromUnits(units),replayed:false};
  }).immediate();
}

export function listPointGifts(admin,userId=null) {
  if(admin?.role!=='admin')throw Error('GIFT_FORBIDDEN');
  return db.prepare(`SELECT g.id,g.user_id userId,u.username,g.admin_id adminId,a.username adminName,g.units/100.0 points,g.reason,g.created_at createdAt
    FROM admin_point_gifts g JOIN users u ON u.id=g.user_id JOIN users a ON a.id=g.admin_id ${userId?'WHERE g.user_id=?':''} ORDER BY g.id DESC LIMIT 100`).all(...(userId?[userId]:[]));
}

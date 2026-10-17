import db from '../lib/db.js';
import {settleReferralRewards} from '../lib/referrals.js';
try {
  console.log(JSON.stringify({success:true,...settleReferralRewards()}));
} finally { db.close(); }

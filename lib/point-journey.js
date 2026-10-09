import db from './db.js';
import {siteFeatureAccess} from './forum-feature.js';
import { pointAssetAccount,pointsFromUnits } from './point-assets.js';

export function publicBrokerReward(){
  const task=db.prepare("SELECT title,reward_points rewardPoints,enabled,review_mode reviewMode,cadence FROM point_tasks WHERE code='tmgm_deposit'").get();
  return {enabled:Boolean(siteFeatureAccess().tasks&&task?.enabled&&task.reviewMode==='manual'&&task.cadence==='once'&&task.rewardPoints>0),rewardPoints:task?.rewardPoints||0};
}

export function pointJourneyState(userId){
  const account=pointAssetAccount(userId);
  const claim=db.prepare("SELECT c.status FROM point_task_claims c JOIN point_tasks t ON t.id=c.task_id WHERE c.user_id=? AND t.code='tmgm_deposit'").get(userId);
  return {balance:pointsFromUnits(account.fundedUnits+account.bonusUnits),brokerClaimStatus:claim?.status||null};
}

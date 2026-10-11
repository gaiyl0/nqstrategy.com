export function ownJourneySummary(result,userId) {
  return userId!=null&&result?.userId===userId?result.data:null;
}

export function journeyQuote(products,balance,reward,claimStatus,catalogMinimum=null) {
  const prices=products.filter(item=>item.status==='active'&&item.currentVersion?.status==='published').map(item=>Number(item.points_price)).filter(value=>Number.isInteger(value)&&value>0);
  const minimum=Number.isInteger(catalogMinimum)&&catalogMinimum>0?catalogMinimum:prices.length?Math.min(...prices):null;
  const known=typeof balance==='number'&&Number.isFinite(balance)&&balance>=0;
  const prospective=claimStatus==='approved'?0:Math.max(0,Number(reward)||0);
  return {minimum,affordable:known?prices.filter(price=>price<=balance).length:null,
    gap:known&&minimum!==null?Math.max(0,minimum-balance):null,
    afterRewardGap:minimum!==null?Math.max(0,minimum-(known?balance:0)-prospective):null};
}

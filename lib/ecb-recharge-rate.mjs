export const ECB_DAILY_RATES_URL='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
export const MAX_REFERENCE_AGE_MS=5*24*60*60*1000;

export function parseEcbUsdCnyRate(xml,now=Date.now()){
  if(typeof xml!=='string'||xml.length>200_000||!xml.includes('European Central Bank'))throw new Error('RECHARGE_RATE_FEED_INVALID');
  const publishedDate=/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]\s*>/.exec(xml)?.[1];
  const usdPerEur=Number(/<Cube\s+currency=['"]USD['"]\s+rate=['"]([0-9.]+)['"]\s*\/>/.exec(xml)?.[1]);
  const cnyPerEur=Number(/<Cube\s+currency=['"]CNY['"]\s+rate=['"]([0-9.]+)['"]\s*\/>/.exec(xml)?.[1]);
  const publishedAt=Date.parse(`${publishedDate}T00:00:00Z`);
  const cnyPerUsd=cnyPerEur/usdPerEur;
  const cnyFenPerUsd=Math.round(cnyPerUsd*100);
  if(!Number.isSafeInteger(publishedAt)||publishedAt>now||now-publishedAt>MAX_REFERENCE_AGE_MS||
    !Number.isFinite(usdPerEur)||usdPerEur<0.5||usdPerEur>2.5||!Number.isFinite(cnyPerEur)||cnyPerEur<2||cnyPerEur>20||
    !Number.isInteger(cnyFenPerUsd)||cnyFenPerUsd<100||cnyFenPerUsd>2000)throw new Error('RECHARGE_RATE_FEED_INVALID');
  return {publishedDate,usdPerEur,cnyPerEur,cnyPerUsd,cnyFenPerUsd};
}

export async function fetchEcbUsdCnyRate(fetchImpl=fetch,now=Date.now()){
  const response=await fetchImpl(ECB_DAILY_RATES_URL,{headers:{Accept:'application/xml,text/xml'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok||Number(response.headers.get('content-length')||0)>200_000)throw new Error('RECHARGE_RATE_FEED_UNAVAILABLE');
  return parseEcbUsdCnyRate(await response.text(),now);
}

import crypto from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';

export const ANALYTICS_COOKIE = 'nq_visitor';
const excluded = /nexusquantverificationbot|headless|playwright|puppeteer|curl\/|wget\/|python|httpclient|monitor|uptime|lighthouse|pagespeed|selenium/i;
const signatures = [['Googlebot', /googlebot/i], ['Bingbot', /bingbot|adidxbot/i], ['Applebot', /applebot/i], ['Baiduspider', /baiduspider/i], ['YandexBot', /yandexbot/i], ['AhrefsBot', /ahrefsbot/i], ['SemrushBot', /semrushbot/i], ['Social preview', /twitterbot|telegrambot|facebookexternalhit|discordbot/i], ['Other crawler', /bot|crawler|spider|scrapy|slurp/i]];
export function agentType(ua) {
  ua = String(ua || '').slice(0,300);
  if (!ua || excluded.test(ua)) return { excluded:true, name:null };
  const found=signatures.find(([,pattern])=>pattern.test(ua));
  return { excluded:false, name:found?.[0] || null, browser:!found && /Mozilla\/5\.0.*(?:Chrome\/|Firefox\/|Safari\/|Edg\/)/i.test(ua) };
}
function sign(text) { return crypto.createHmac('sha256',process.env.JWT_SECRET).update('analytics-v2:'+text).digest('base64url'); }
export function signedValue(payload) { const text=Buffer.from(JSON.stringify(payload)).toString('base64url');return text+'.'+sign(text); }
export function readSigned(value,now=Date.now()) {
  try {
    if(typeof value!=='string'||value.length>2048)return null;
    const [text,sig,...extra]=value.split('.');if(extra.length||!sig)return null;
    const expected=Buffer.from(sign(text)),actual=Buffer.from(sig);
    if(expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual))return null;
    const data=JSON.parse(Buffer.from(text,'base64url'));
    if(!Number.isSafeInteger(data.exp)||data.exp<now||!Number.isSafeInteger(data.at)||data.at>now)return null;
    return data;
  } catch { return null; }
}
export function newVisitor(now=Date.now()) { return signedValue({id:crypto.randomBytes(24).toString('hex'),at:now,exp:now+86400000}); }
export function visitorHash(value) { return crypto.createHmac('sha256',process.env.JWT_SECRET).update('analytics-visitor:'+value).digest('hex'); }
export function cookieVisitor(request,now=Date.now()) {
  const raw=request.cookies?.get(ANALYTICS_COOKIE)?.value || String(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(ANALYTICS_COOKIE+'='))?.slice(ANALYTICS_COOKIE.length+1);
  const payload=readSigned(raw,now);
  return payload && /^[a-f0-9]{48}$/.test(payload.id||'') && payload.exp-payload.at===86400000 ? payload : null;
}

const verificationCache = new Map();
const pending = new Map();
export async function verifyCrawler(ip,name,lookup,now=Date.now()) {
  const suffix={Googlebot:'.googlebot.com',Bingbot:'.search.msn.com'}[name];
  if(!suffix||!isIP(ip||'')||ip==='127.0.0.1'||ip==='::1')return false;
  const key=name+':'+ip,cached=verificationCache.get(key);
  if(!lookup&&cached?.expires>now)return cached.verified;
  if(!lookup&&pending.has(key))return pending.get(key);
  if(!lookup&&pending.size>=32)return false;
  const task=(async()=>{
    const resolver=lookup || new Resolver({timeout:700,tries:1});
    let timer;
    try {
      const verified=await Promise.race([(async()=>{
        const names=(await resolver.reverse(ip)).slice(0,5);
        for(const host of names){
          if(!host.toLowerCase().replace(/\.$/,'').endsWith(suffix))continue;
          const addresses=await (isIP(ip)===6?resolver.resolve6(host):resolver.resolve4(host));
          if(addresses.some(address=>isIP(address) && equalIp(address,ip)))return true;
        }
        return false;
      })(),new Promise(resolve=>{timer=setTimeout(()=>{if(!lookup)resolver.cancel();resolve(false);},1200);})]);
      if(!lookup){if(verificationCache.size>=256)verificationCache.delete(verificationCache.keys().next().value);verificationCache.set(key,{verified,expires:now+(verified?21600000:300000)});}
      return verified;
    } catch { return false; } finally { clearTimeout(timer); }
  })();
  if(!lookup)pending.set(key,task);
  try { return await task; } finally { if(!lookup)pending.delete(key); }
}
function equalIp(a,b) {
  if(isIP(a)===4&&isIP(b)===4)return a===b;
  try{return new URL('http://['+a+']/').hostname===new URL('http://['+b+']/').hostname;}catch{return false;}
}

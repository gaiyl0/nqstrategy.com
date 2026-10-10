import net from 'node:net';

export function networkProbeArguments({domain='nqstrategy.com',path='/api/health',family=4,origin=null}={}) {
  if(!/^(?=.{1,253}$)[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?$/i.test(domain)||domain.includes('..')||!['/','/api/health'].includes(path)||![4,6].includes(family)||
    (origin!==null&&net.isIP(origin)!==4))throw Error('NETWORK_PROBE_INVALID');
  return ['-sS',`-${family}`,'--compressed','--connect-timeout','8','--max-time','15','--user-agent','NexusQuant-Diagnostics/1.0',
    '--output',process.platform==='win32'?'NUL':'/dev/null',
    '--write-out','{"code":"%{http_code}","ip":"%{remote_ip}","dns":%{time_namelookup},"tcp":%{time_connect},"tls":%{time_appconnect},"ttfb":%{time_starttransfer},"total":%{time_total},"bytes":%{size_download}}',
    ...(origin?['--resolve',`${domain}:443:${origin}`]:[]),`https://${domain}${path}`];
}

export function describeNetworkProbe(output,exitCode) {
  let metrics;
  try{metrics=JSON.parse(output);metrics.code=Number(metrics.code);}catch{return {ok:false,exitCode,stage:'probe_unavailable'};}
  const stage=exitCode===6?'dns':exitCode===35||exitCode===60?'tls':exitCode===28?
    metrics.code?'response_transfer':metrics.tls?'response_wait':metrics.tcp?'tls':'connect':metrics.code>=400?'http':exitCode?'transport':'complete';
  return {ok:exitCode===0&&metrics.code>=200&&metrics.code<400,exitCode,stage,...metrics};
}

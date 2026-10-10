import {spawnSync} from 'node:child_process';
import {networkProbeArguments,describeNetworkProbe} from '../lib/network-diagnostics.mjs';

const args=process.argv.slice(2);
if(args.some((value,index)=>index%2===0&&!['--domain','--origin'].includes(value))||args.length%2)throw Error('NETWORK_PROBE_INVALID');
const options=Object.fromEntries(Array.from({length:args.length/2},(_,i)=>[args[i*2].slice(2),args[i*2+1]]));
const domain=options.domain||'nqstrategy.com';
const probes=[{label:'public_ipv4_home',path:'/',family:4},{label:'public_ipv4_health',path:'/api/health',family:4},
  {label:'public_ipv6_health',path:'/api/health',family:6},...(options.origin?[{label:'origin_ipv4_health',path:'/api/health',family:4,origin:options.origin}]:[])];
// Validate every argument before starting requests. No cookies, login tokens, keys or response bodies are recorded.
const commands=probes.map(probe=>({probe,args:networkProbeArguments({...probe,domain})}));
let failures=0;
for(const command of commands) {
  const result=spawnSync(process.platform==='win32'?'curl.exe':'curl',command.args,{encoding:'utf8',timeout:18000,windowsHide:true});
  const report=describeNetworkProbe(result.stdout,result.status??1);
  if(!report.ok)failures++;
  console.log(JSON.stringify({time:new Date().toISOString(),domain,label:command.probe.label,...report}));
}
if(failures)process.exitCode=1;

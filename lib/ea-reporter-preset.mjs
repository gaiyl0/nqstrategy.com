// Only known reporter parameters are emitted; labels and user-provided text never enter SET files.
export function reporterPreset({productId,token,id}={}){
  if(!Number.isSafeInteger(productId)||productId<1||productId>2147483647||!/^NQT-[a-f0-9]{64}$/.test(token)||!Number.isSafeInteger(id)||id<1)throw Error('INVALID_REPORTER_CREDENTIAL');
  return {filename:`NexusAccountReporter_${id}.set`,content:[
    '; Nexus read-only account reporter. Keep this personal configuration private.',
    '; Load into NexusAccountReporter only, on a spare chart.',
    'WebsiteOrigin=https://nqstrategy.com',
    `ProductId=${productId}`,
    `TelemetryToken=${token}`,
    'ConsentToReporting=true',
    'EaMagicNumber=0',
    '',
  ].join('\r\n')};
}

export function presetBytes(content){
  const bytes=new Uint8Array(2+content.length*2);bytes[0]=0xff;bytes[1]=0xfe;
  for(let i=0;i<content.length;i++){const code=content.charCodeAt(i);bytes[2+i*2]=code&255;bytes[3+i*2]=code>>>8;}
  return bytes;
}

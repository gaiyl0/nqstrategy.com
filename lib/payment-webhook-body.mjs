export async function readPaymentWebhookBody(request,maxBytes=128000) {
  const reader=request.body?.getReader();
  if(!reader)throw new Error('PAYMENT_BODY_INVALID');
  const chunks=[];
  let total=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>maxBytes)throw new Error('PAYMENT_BODY_TOO_LARGE');
      chunks.push(value);
    }
    return Buffer.concat(chunks,total).toString('utf8');
  }finally{reader.releaseLock();}
}

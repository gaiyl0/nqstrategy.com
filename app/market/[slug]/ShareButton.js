"use client";

import {useState} from 'react';
import {Share2} from 'lucide-react';

export default function ShareButton({title}){
  const [copied,setCopied]=useState(false);
  const share=async()=>{
    const data={title,url:window.location.href};
    try{
      if(navigator.share)await navigator.share(data);
      else await navigator.clipboard.writeText(data.url);
      setCopied(true);setTimeout(()=>setCopied(false),2000);
    }catch(error){if(error?.name!=='AbortError')setCopied(false);}
  };
  return <button onClick={share} className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-300 hover:bg-cyan-500/20"><Share2 className="h-4 w-4" />{copied?'链接已复制':'分享策略'}</button>;
}

import App from './App';
import db from '@/lib/db';
import {appRoute} from '@/lib/app-navigation.mjs';
import {initialAppData,listMetadata} from '@/lib/public-list-pages';
import {publishedSiteBrand} from '@/lib/site-brand-store';

export const dynamic='force-dynamic';
export async function generateMetadata({searchParams}){
  const params=await searchParams,query=new URLSearchParams(Object.entries(params).filter(([,value])=>typeof value==='string'));
  const route=appRoute(query.toString(),'');
  if(params.post&&/^[1-9]\d*$/.test(params.post))return {alternates:{canonical:`/forum/${params.post}`},robots:{index:false,follow:true}};
  if(params.ea&&/^[1-9]\d*$/.test(params.ea)){
    const product=db.prepare("SELECT slug FROM products WHERE id=? AND status='active' AND moderation_status='visible' AND deleted_at IS NULL").get(Number(params.ea));
    return {alternates:{canonical:product?.slug?`/market/${product.slug}`:'/market'},robots:{index:false,follow:true}};
  }
  if(['forum','market'].includes(route))return {...listMetadata(route,params,publishedSiteBrand()),robots:{index:false,follow:true}};
  return {alternates:{canonical:'/'},robots:{index:route==='home'&&!params.auth,follow:true}};
}
export default async function HomePage({searchParams}){
  const params=await searchParams,query=new URLSearchParams(Object.entries(params).filter(([,value])=>typeof value==='string'));
  const route=appRoute(query.toString(),'');
  return <App initialRoute={route} initialData={initialAppData(route,params)}/>;
}

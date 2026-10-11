import {notFound} from 'next/navigation';
import App from '../App';
import {initialAppData,listMetadata} from '@/lib/public-list-pages';
import {publishedSiteBrand} from '@/lib/site-brand-store';
import {catalogEnabled} from '@/lib/site-brand.mjs';
export const dynamic='force-dynamic';
export async function generateMetadata({searchParams}){return listMetadata('market',await searchParams,publishedSiteBrand());}
export default async function MarketPage({searchParams}){
  if(!catalogEnabled(publishedSiteBrand()))notFound();
  return <App initialRoute="market" initialData={initialAppData('market',await searchParams)}/>;
}

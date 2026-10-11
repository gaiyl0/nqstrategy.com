import {notFound} from 'next/navigation';
import App from '../App';
import {initialAppData,listMetadata} from '@/lib/public-list-pages';
import {publishedSiteBrand} from '@/lib/site-brand-store';
import {forumEnabled} from '@/lib/site-brand.mjs';
export const dynamic='force-dynamic';
export async function generateMetadata({searchParams}){return listMetadata('forum',await searchParams,publishedSiteBrand());}
export default async function ForumPage({searchParams}){
  if(!forumEnabled(publishedSiteBrand()))notFound();
  return <App initialRoute="forum" initialData={initialAppData('forum',await searchParams)}/>;
}

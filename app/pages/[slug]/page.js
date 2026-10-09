import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { readBrandWorkspace } from '@/lib/site-brand-store';
import { publicSiteSettings } from '@/lib/topic-pages';
import CustomPageContent from '@/app/components/CustomPageContent';
import TopicPageFrame from '@/app/components/TopicPageFrame';

export const dynamic = 'force-dynamic';
async function resolvePage(params, searchParams) {
  const { slug } = await params;
  const query = await searchParams;
  const preview = query?.preview === 'draft';
  if (preview && (await getSessionUser())?.role !== 'admin') notFound();
  const workspace = readBrandWorkspace();
  const brand = preview ? workspace.draft : workspace.published;
  const page = brand.pages.find(item => item.slug === slug && (preview || item.enabled));
  if (!page) notFound();
  return { page, brand, preview };
}
export async function generateMetadata({ params, searchParams }) {
  const { page, brand, preview } = await resolvePage(params, searchParams);
  return { title: { absolute: `${page.title} | ${brand.name}` }, description: page.description || brand.seoDescription || brand.description,
    alternates: { canonical: `/pages/${page.slug}` }, robots: { index: !preview, follow: !preview },
    openGraph: { title: page.title, description: page.description, url: `/pages/${page.slug}`, siteName: brand.name, ...(page.heroImageUrl ? {images:[page.heroImageUrl]} : {}) } };
}
export default async function CustomPage({ params, searchParams }) {
  const { page, brand, preview } = await resolvePage(params, searchParams);
  const settings = { ...publicSiteSettings(), siteBrand: brand, siteName: brand.name };
  return <TopicPageFrame settings={settings}><main className="mx-auto w-full max-w-5xl px-8 py-10">
    {preview && <p className="mb-6 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-amber-500">管理员草稿预览 · 尚未发布</p>}
    <CustomPageContent page={page}/>
  </main></TopicPageFrame>;
}

import "./globals.css";
import { InteractionProvider } from './components/ui/UiKit';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_ORIGINS?.split(',')[0] || 'https://nqstrategy.com';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Nexus Quant | MT5 EA 量化策略与 XAUUSD 黄金交易研究', template: '%s | Nexus Quant' },
  description: 'Nexus Quant 提供 MT5 EA 量化策略、XAUUSD 黄金与外汇自动交易研究。查看策略验证资料、风险披露、版本与授权信息。',
  keywords: ['MT5 EA', 'EA量化策略', 'XAUUSD 黄金交易', '黄金EA', '外汇自动交易', '量化交易策略'],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', locale: 'zh_CN', url: '/', siteName: 'Nexus Quant', title: 'Nexus Quant | MT5 EA 量化策略与 XAUUSD 黄金交易研究', description: '查找 MT5 EA 量化策略，研究 XAUUSD 黄金和外汇自动交易的验证资料与风险披露。' },
  twitter: { card: 'summary_large_image', title: 'Nexus Quant | MT5 EA 量化策略与 XAUUSD 黄金交易研究', description: 'MT5 EA、XAUUSD 黄金与外汇量化策略研究。' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body className="bg-zinc-950 text-zinc-300"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context':'https://schema.org', '@type':'WebSite', name:'Nexus Quant', url:siteUrl, inLanguage:'zh-CN', description:'MT5 EA 量化策略、XAUUSD 黄金与外汇自动交易研究平台。' }).replace(/</g, '\\u003c') }} /><InteractionProvider>{children}</InteractionProvider></body>
    </html>
  );
}

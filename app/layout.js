import "./globals.css";
import { InteractionProvider } from './components/ui/UiKit';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_ORIGINS?.split(',')[0] || 'http://localhost:3000'),
  title: "Nexus Quant | MT5 & XAUUSD 量化交易平台",
  description: "Next-Gen Algorithmic Trading Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body className="bg-zinc-950 text-zinc-300"><InteractionProvider>{children}</InteractionProvider></body>
    </html>
  );
}

import TopicGuide from '../components/TopicGuide';
import { topicPageData } from '@/lib/topic-pages';
export const metadata = { title: 'MT5 EA 量化策略市场 | 外汇自动交易程序 | Nexus Quant', description: '浏览 MT5 EA 量化策略，按验证资料、交易品种、最大回撤和策略类型筛选。面向外汇、黄金 XAUUSD 自动交易研究。', keywords: ['MT5 EA', 'EA量化策略', '外汇自动交易程序', '黄金EA', 'XAUUSD EA', '量化交易策略'], alternates: { canonical: '/ea-strategies' } };
const sections = [
  { id: 'verification', title: '验证资料与数据边界', text: '区分未提供资料、截图审核、MT5 报告验证与更高等级认证。认证标签说明已核验的资料范围，历史报告不能保证未来表现。' },
  { id: 'selection', title: '如何筛选 EA 策略', items: ['先选择交易品种，例如 XAUUSD 黄金、EURUSD 或多货币组合。', '查看策略类型、最大回撤、交易次数和适用市场，而不是只比较历史收益。', '核对 MT5 报告与认证资料的披露状态，未提供验证资料不应视为收益承诺。', '阅读版本说明、授权方式和风险提示后，再决定是否试用或获取策略。'] },
  { id: 'versions', title: '版本与授权', text: '查看策略版本与更新说明，按授权规则下载并绑定运行环境。使用前确认终端版本、交易品种与参数设置，与开发者提供的说明保持一致。' },
];
export default function EaStrategiesPage() {
  return <TopicGuide kind="mt5" title="MT5 EA 量化策略与外汇自动交易程序" intro="Nexus Quant 用于查找、比较和研究 MT5 EA 量化策略。策略页面会披露开发者提供的交易品种、策略类型、报告资料和认证等级，帮助交易者在使用前识别数据边界。" sections={sections} {...topicPageData('mt5')} />;
}

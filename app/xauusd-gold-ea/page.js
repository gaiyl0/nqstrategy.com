import TopicGuide from '../components/TopicGuide';
import { topicPageData } from '@/lib/topic-pages';
export const metadata = { title: 'XAUUSD 黄金 EA 策略研究 | MT5 黄金自动交易 | Nexus Quant', description: '研究适用于 XAUUSD 黄金交易的 MT5 EA 策略。查看回测资料、风险披露、最大回撤、验证状态和版本信息。', keywords: ['XAUUSD EA', '黄金EA', '黄金自动交易', 'MT5黄金策略', 'XAUUSD量化交易', '外汇黄金交易'], alternates: { canonical: '/xauusd-gold-ea' } };
const sections = [
  { id: 'execution', title: '报价、点差与交易时段', text: '使用黄金 EA 前，核对经纪商报价、点差、滑点和交易时段是否与回测环境相近。实际执行条件不同，成交与结果也可能不同。' },
  { id: 'reports', title: '报告资料与验证状态', items: ['核对回测数据来源、MT5 终端版本、参数文件与测试区间是否披露。', '查看策略是否有报告验证或实盘观察资料；历史数据不能预测未来结果。'] },
  { id: 'risk', title: '最大回撤与网格风险', text: '结合最大回撤、单笔风险、网格或马丁策略特征，理解高波动行情下的失效风险。研究资料应披露其适用条件，不能只依据收益曲线决定使用。' },
  { id: 'platform', title: '寻找黄金或外汇交易平台时', text: '请独立核对平台的所在地监管、交易规则、XAUUSD 合约规格、隔夜费、出入金政策与风险披露。平台广告或外部链接不构成 Nexus Quant 的推荐、担保或投资建议。' },
];
export default function XauusdGoldEaPage() {
  return <TopicGuide kind="gold" title="XAUUSD 黄金 EA 与 MT5 自动交易策略" intro="黄金市场波动和流动性会随交易时段、宏观事件与报价条件变化。Nexus Quant 的 XAUUSD 策略研究页用于集中查看黄金 EA 的资料披露、策略类型和风险指标，而不是承诺收益。" sections={sections} {...topicPageData('gold')} />;
}

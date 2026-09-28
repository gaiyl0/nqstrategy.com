import { ArrowLeft, CheckCircle2, Code2, FileCode, Image as ImageIcon, Upload } from 'lucide-react';

export default function UploadView({ setRoute, t, user, uploadForm, setUploadForm, eaTypeOptions, toggleEaType, tEaType, setLogoFile, logoFile, setEx4File, ex4File, isParsingReport, handleReportUpload, reportInfo, setEvidenceFiles, parseMetricRows, submitEA, isSubmitting }) {
  return (
<div className="max-w-4xl mx-auto px-4 py-10 animate-in fade-in zoom-in-95 duration-300">
  <button onClick={() => setRoute('market')} className="text-sm font-bold text-cyan-400 hover:text-cyan-300 mb-6 flex items-center gap-2 transition-colors"><ArrowLeft className="w-4 h-4" /> {t('返回市场', 'Back to Market')}</button>
  <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
    <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[80px] pointer-events-none"></div>
    
    {!['developer', 'admin'].includes(user?.role) ? (
      <div className="text-center py-20 relative z-10">
        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6"><Code2 className="w-10 h-10 text-blue-400" /></div>
        <h2 className="text-2xl font-bold text-white mb-4">{t('您当前是普通用户，无法发布策略', 'You are a Standard User, cannot publish EAs')}</h2>
         <p className="text-zinc-500 mb-3">{t('发布 EA 需要管理员完成开发者身份审核。', 'EA publishing requires administrator approval of your developer account.')}</p>
         <p className="text-xs text-zinc-600">{t('请联系平台管理员提交认证资料。', 'Contact the platform administrator to submit your verification details.')}</p>
      </div>
    ) : (
      <>
        <h2 className="text-3xl font-black text-white mb-2 flex items-center gap-3 relative z-10"><Upload className="text-cyan-400 w-8 h-8" /> {uploadForm.id ? t('编辑 EA 策略', 'Edit EA Strategy') : t('部署全新 EA 策略', 'Deploy New EA Strategy')}</h2>
        <div className="space-y-8 relative z-10 mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div><label className="block text-sm font-bold text-zinc-300 mb-2">{t('策略核心名称 *', 'Strategy Core Name *')}</label><input type="text" value={uploadForm.title} onChange={e=>setUploadForm({...uploadForm, title: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white focus:border-cyan-500 focus:outline-none transition-colors" /></div>
              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-3">{t('EA 交易类型配置 (多选)', 'EA Trading Types')}</label>
                <div className="grid grid-cols-2 gap-3 bg-zinc-950 border border-zinc-800/80 p-5 rounded-2xl shadow-inner">
                  {eaTypeOptions.map(type => {
                    const isSelected = (uploadForm.eaTypes || []).includes(type);
                    return (
                      <div key={type} onClick={() => toggleEaType(type)} className="flex items-center gap-3 cursor-pointer group p-2 rounded-xl hover:bg-zinc-900/60 transition-colors">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-cyan-500 border-cyan-500' : 'border-zinc-600 bg-zinc-900'}`}>{isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-zinc-950" />}</div>
                        <span className={`text-sm ${isSelected ? 'text-cyan-400 font-bold' : 'text-zinc-400'}`}>{tEaType(type)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div><label className="block text-xs font-bold text-zinc-500 mb-2">{t('测试交易品种', 'Tested Symbols')}</label><input type="text" value={uploadForm.pairs} onChange={e=>setUploadForm({...uploadForm, pairs: e.target.value})} placeholder="XAUUSD, EURUSD" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white font-mono focus:border-cyan-500 focus:outline-none" /></div>
            </div>
            <div className="space-y-6">
              <div><label className="block text-sm font-bold text-zinc-300 mb-2">{t('策略详细运行逻辑说明', 'Detailed Logic Description')}</label><textarea value={uploadForm.description} onChange={e=>setUploadForm({...uploadForm, description: e.target.value})} rows="5" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white resize-none focus:border-cyan-500 focus:outline-none transition-colors"></textarea></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative h-36 border-2 border-dashed border-zinc-700 hover:border-cyan-500 rounded-2xl bg-zinc-950 flex flex-col items-center justify-center cursor-pointer overflow-hidden group"><input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer z-10" />{logoFile ? (<div className="text-center z-0"><ImageIcon className="w-8 h-8 text-cyan-400 mx-auto mb-2" /><span className="text-xs text-white bg-zinc-900 px-2 py-1 rounded truncate block">{logoFile.name}</span></div>) : (<div className="text-center z-0 text-zinc-500 group-hover:text-cyan-400"><ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" /><span className="text-xs">{t('策略头像/Logo', 'Avatar')}</span></div>)}</div>
                {!uploadForm.id?<div className="relative h-36 border-2 border-dashed border-zinc-700 hover:border-emerald-500 rounded-2xl bg-zinc-950 flex flex-col items-center justify-center cursor-pointer overflow-hidden group"><input type="file" accept=".ex4,.ex5" onChange={e => setEx4File(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer z-10" />{ex4File ? (<div className="text-center z-0"><FileCode className="w-8 h-8 text-emerald-400 mx-auto mb-2" /><span className="text-xs text-white bg-zinc-900 px-2 py-1 rounded truncate block">{ex4File.name}</span></div>) : (<div className="text-center z-0 text-zinc-500 group-hover:text-emerald-400"><FileCode className="w-8 h-8 mx-auto mb-2 opacity-50" /><span className="text-xs">{t('主程序 (.ex4/.ex5)', 'Program (.ex4/.ex5)')}</span></div>)}</div>:<div className="h-36 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 text-xs leading-relaxed text-violet-300">{t('已发布程序不能在产品编辑中覆盖。请到“我发布的策略”使用“提交新版本”。','Published files are immutable. Use Submit Version from My Published EAs.')}</div>}
              </div>
              {!uploadForm.id&&<div className="grid grid-cols-1 gap-3 md:grid-cols-3"><input value={uploadForm.version} onChange={e=>setUploadForm({...uploadForm,version:e.target.value})} placeholder="1.0.0" className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white"/><input value={uploadForm.releaseNotes} onChange={e=>setUploadForm({...uploadForm,releaseNotes:e.target.value})} placeholder={t('初始版本说明','Initial release notes')} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white"/><select value={uploadForm.upgradePolicy} onChange={e=>setUploadForm({...uploadForm,upgradePolicy:e.target.value})} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white"><option value="all_existing">{t('所有已有买家继承','All existing owners')}</option><option value="new_purchases_only">{t('仅发布后新买家','New purchases only')}</option></select></div>}
              <div className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4"><label className="flex items-center gap-2 text-xs font-bold text-zinc-300"><input type="checkbox" checked={Boolean(uploadForm.trialEnabled)} onChange={e=>setUploadForm({...uploadForm,trialEnabled:e.target.checked})}/>{t('开放限时试用','Enable timed trial')}</label>{uploadForm.trialEnabled&&<input type="number" min="1" max="30" value={uploadForm.trialDays} onChange={e=>setUploadForm({...uploadForm,trialDays:e.target.value})} className="w-24 rounded-lg border border-zinc-700 bg-black px-3 py-2 text-white"/>}<span className="text-[10px] text-zinc-600">{t('天（服务器计时，最多 30 天）','days, server-timed, max 30')}</span></div>
            </div>
          </div>
          <div className="rounded-3xl border border-violet-500/20 bg-violet-500/5 p-6">
            <h3 className="font-black text-white">{t('MT5 HTML 原始回测报告 *', 'Original MT5 HTML Report *')}</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t('请在 MT5 策略测试器中导出 HTML 报告。系统将从报告自动提取八项指标，并根据成交明细生成净值、回撤和月度收益；无需手工录入曲线。', 'Export an HTML report from MT5 Strategy Tester. Metrics and curves are generated from the report; manual curve entry is no longer required.')}</p>
            <input type="file" accept=".htm,.html,text/html" disabled={isParsingReport} onChange={e=>handleReportUpload(e.target.files?.[0])} className="mt-4 block w-full text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/10 file:px-3 file:py-2 file:font-bold file:text-violet-300" />
            {isParsingReport && <p className="mt-3 text-xs font-bold text-violet-300">{t('正在解析和验证报告…', 'Parsing and validating report…')}</p>}
            {reportInfo && <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">✅ {reportInfo.originalName || t('已绑定原始报告', 'Original report attached')} · SHA-256 {reportInfo.sha256?.slice(0,16)}… · {reportInfo.metrics?.totalTrades || uploadForm.metrics.totalTrades} {t('笔交易', 'trades')}</div>}
          </div>
          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <h3 className="font-black text-white">{t('MT5 原始回测证据 *', 'Original MT5 Backtest Evidence *')}</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t('必须上传设置、统计、净值曲线三张原始截图；后台保存原图哈希并生成去元数据预览。图片识别结果仍须管理员核对，截图审核不等于实盘认证。', 'Upload original Settings, Statistics and Chart screenshots. Originals are hashed and previews are sanitized. Extraction still requires administrator review and is not live-account verification.')}</p>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {[[ 'settings', t('设置页截图 *', 'Settings screenshot *') ], [ 'statistics', t('统计页截图 *', 'Statistics screenshot *') ], [ 'chart', t('净值曲线截图 *', 'Chart screenshot *') ], [ 'analysis', t('后台分析截图（可选）', 'Analysis screenshot (optional)') ]].map(([key,label]) => (
                <label key={key} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-xs font-bold text-zinc-400">
                  <span className="mb-2 block">{label}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setEvidenceFiles(prev=>({...prev,[key]:e.target.files?.[0] || null}))} className="block w-full text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500/10 file:px-3 file:py-2 file:font-bold file:text-emerald-400" />
                </label>
              ))}
            </div>
            {uploadForm.evidenceIds?.length > 0 && <p className="mt-3 text-[11px] text-emerald-400">{t(`已保留 ${uploadForm.evidenceIds.length} 份现有证据；选择新图片会替换相同类型。`, `${uploadForm.evidenceIds.length} existing evidence files retained; selecting a new file replaces that type.`)}</p>}
          </div>
          <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6">
            <div className="mb-5">
              <h3 className="font-black text-white">{t('报告自动提取结果', 'Automatically Extracted Results')}</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t('这些字段由 MT5 HTML 报告生成并锁定。若结果不正确，请重新导出报告，不要手工修改。管理员仍会对照截图复核。', 'These locked fields come from the MT5 HTML report. Re-export the report if they are incorrect. An administrator still cross-checks the screenshots.')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                ['initialDeposit', t('初始资金 USD', 'Initial Deposit USD')],
                ['netProfit', t('净利润 USD', 'Net Profit USD')],
                ['profitFactor', 'Profit Factor'],
                ['sharpeRatio', 'Sharpe Ratio'],
                ['maxDrawdownPercent', t('最大回撤 %', 'Max Drawdown %')],
                ['recoveryFactor', 'Recovery Factor'],
                ['winRatePercent', t('胜率 %', 'Win Rate %')],
                ['totalTrades', t('交易次数', 'Total Trades')],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="mb-2 block text-[11px] font-bold text-zinc-500">{label}</label>
                  <input type="number" readOnly value={uploadForm.metrics[key]} placeholder={t('等待报告', 'Awaiting report')} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-zinc-300 outline-none read-only:cursor-not-allowed" />
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"><div className="text-xs font-bold text-zinc-400">{t('净值曲线', 'Equity Curve')}</div><div className="mt-2 text-2xl font-black text-emerald-400">{parseMetricRows(uploadForm.metrics.equityCurveText, 'value').length}</div><div className="text-[10px] text-zinc-600">{t('自动生成数据点', 'generated points')}</div></div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"><div className="text-xs font-bold text-zinc-400">{t('回撤曲线', 'Drawdown Curve')}</div><div className="mt-2 text-2xl font-black text-red-400">{parseMetricRows(uploadForm.metrics.drawdownCurveText, 'percent').length}</div><div className="text-[10px] text-zinc-600">{t('自动生成数据点', 'generated points')}</div></div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"><div className="text-xs font-bold text-zinc-400">{t('月度收益', 'Monthly Returns')}</div><div className="mt-2 text-2xl font-black text-cyan-400">{parseMetricRows(uploadForm.metrics.monthlyReturnsText, 'percent').length}</div><div className="text-[10px] text-zinc-600">{t('自动生成月份', 'generated months')}</div></div>
            </div>
          </div>
          <div className="flex items-center gap-4 pt-8 border-t border-zinc-800/80">
            <div className="w-1/3"><label className="block text-xs font-bold text-zinc-500 mb-2">{t('发售价格 (USD)', 'Price (USD)')}</label><input type="number" value={uploadForm.price} onChange={e=>setUploadForm({...uploadForm, price: e.target.value})} placeholder={t('留空免费', 'Blank for Free')} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-emerald-400 font-bold text-lg focus:border-cyan-500 focus:outline-none shadow-inner" /></div>
            <button onClick={submitEA} disabled={isSubmitting} className="flex-1 h-[76px] mt-6 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl text-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50">
              {isSubmitting ? t('处理中...', 'Processing...') : <><Upload className="w-6 h-6" /> {uploadForm.id ? t('保存修改并重新审核', 'Save & Submit Review') : t('部署上链并提交审核', 'Deploy & Submit')}</>}
            </button>
          </div>
        </div>
      </>
    )}
  </div>
</div>
  );
}

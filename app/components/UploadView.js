'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, Upload } from 'lucide-react';
import './upload-view.css';

function Section({ number, title, hint, children }) {
  return <section id={`ea-section-${number}`} className="ea-upload-section" aria-labelledby={`ea-heading-${number}`}><header><span className="ea-upload-number">0{number}</span><div><h2 id={`ea-heading-${number}`}>{title}</h2><p>{hint}</p></div></header>{children}</section>;
}
function Field({ id, label, hint, error, children }) {
  return <div className="ea-upload-field"><label htmlFor={id}>{label}</label>{children}{hint && <p id={`${id}-hint`}>{hint}</p>}{error && <p id={`${id}-error`} className="ea-upload-error">{error}</p>}</div>;
}

export default function UploadView({ setRoute, t, user, uploadForm, setUploadForm, eaTypeOptions, toggleEaType, tEaType, setLogoFile, logoFile, setEx4File, ex4File, reusablePrograms, reuseFileUrl, setReuseFileUrl, reuseProgramInfo, loadReusablePrograms, reuseApprovedProgram, isReusingProgram, isParsingReport, handleReportUpload, reportInfo, evidenceFiles, setEvidenceFiles, parseMetricRows, submitEA, isSubmitting }) {
  const [errors, setErrors] = useState({});
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const formRef = useRef(null);
  const editing = Boolean(uploadForm.id);
  const busy = isSubmitting || isParsingReport || isReusingProgram;
  const update = (key, value) => { setUploadForm(prev => ({ ...prev, [key]: value })); setErrors(prev => ({ ...prev, [`ea-${key}`]: undefined })); };
  const props = id => ({ id, 'aria-invalid': Boolean(errors[id]), 'aria-describedby': `${id}-hint${errors[id] ? ` ${id}-error` : ''}` });
  const hasEvidence = (uploadForm.evidenceIds?.length || 0) > 0 || Object.values(evidenceFiles || {}).some(Boolean);
  const titles = [t('基础信息', 'Basic information'), t('程序与版本', 'Program & version'), t('可选验证资料', 'Optional verification'), t('定价与提交', 'Price & submission')];
  const onSubmit = event => {
    event.preventDefault();
    if (busy) return;
    const next = {};
    if (!uploadForm.title?.trim()) next['ea-title'] = t('请填写策略名称。', 'Enter a strategy name.');
    if (!editing) {
      if (!ex4File && !reuseFileUrl) next['ea-program'] = t('请选择 EX4 / EX5 程序，或由管理员复用已审核程序。', 'Choose an EX4 / EX5 program, or reuse an approved program as an administrator.');
      if (!/^[0-9]+(?:\.[0-9]+){1,3}(?:-[0-9A-Za-z.-]+)?$/.test(uploadForm.version || '')) next['ea-version'] = t('请输入有效版本号，例如 1.0.0。', 'Enter a valid version, such as 1.0.0.');
      if ((uploadForm.releaseNotes || '').trim().length < 3) next['ea-releaseNotes'] = t('版本说明至少填写 3 个字符。', 'Release notes need at least 3 characters.');
    }
    const price = String(uploadForm.price ?? '').trim();
    if (price && (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(price) || Number(price) > 1000000)) next['ea-price'] = t('价格须为 0–1,000,000 USD，最多两位小数。', 'Price must be 0–1,000,000 USD, with at most two decimal places.');
    if (uploadForm.trialEnabled && (!Number.isInteger(Number(uploadForm.trialDays)) || Number(uploadForm.trialDays) < 1 || Number(uploadForm.trialDays) > 30)) next['ea-trialDays'] = t('试用天数须为 1–30 的整数。', 'Trial duration must be an integer from 1 to 30 days.');
    setErrors(next);
    if (Object.keys(next).length) { formRef.current?.querySelector(`#${Object.keys(next)[0]}`)?.focus(); return; }
    submitEA();
  };
  return <div className="ea-upload-page">
    <button type="button" disabled={isSubmitting} onClick={() => setRoute('market')} className="ea-upload-back"><ArrowLeft size={16} />{t('返回市场', 'Back to market')}</button>
    <div className="ea-upload-hero"><p>MT4 / MT5 · EA</p><h1>{editing ? t('编辑 EA 策略', 'Edit EA strategy') : t('发布 EA 策略', 'Publish EA strategy')}</h1><p>{t('填写策略信息并提交审核。报告与截图为可选资料；审核通过后在市场展示。', 'Submit your strategy for review. Reports and screenshots are optional; approved strategies appear in the market.')}</p></div>
    {!['developer', 'admin'].includes(user?.role) ? <section className="ea-upload-section"><h2>{t('发布策略需要开发者身份', 'Developer approval required')}</h2><p>{t('请联系平台管理员提交认证资料，完成开发者身份审核。', 'Contact the platform administrator for developer account approval.')}</p></section> : <>
      <nav className="ea-upload-nav" aria-label={t('发布表单分区', 'Publishing form sections')}>{titles.map((title, i) => <a key={title} href={`#ea-section-${i + 1}`}>0{i + 1} · {title}</a>)}</nav>
      <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={busy}>
        {Object.values(errors).some(Boolean) && <div role="alert" className="ea-upload-errors"><strong>{t('请完善以下信息后提交：', 'Complete the following fields:')}</strong>{Object.entries(errors).filter(([, value]) => value).map(([id, value]) => <button key={id} type="button" onClick={() => formRef.current?.querySelector(`#${id}`)?.focus()}>{value}</button>)}</div>}
        <fieldset disabled={isSubmitting} className="ea-upload-fields">
          <Section number={1} title={titles[0]} hint={t('让用户了解策略用途、交易品种与运行逻辑。', 'Describe the strategy, symbols, and trading logic.')}>
            <Field id="ea-title" label={t('策略名称 *', 'Strategy name *')} hint={t('最多 120 个字符，名称应便于识别。', 'Up to 120 characters; use a recognizable name.')} error={errors['ea-title']}><input {...props('ea-title')} value={uploadForm.title} maxLength={120} required onChange={e => update('title', e.target.value)} /></Field>
            <div className="ea-upload-grid"><Field id="ea-pairs" label={t('交易品种', 'Trading symbols')} hint={t('填写实际支持的品种，例如 XAUUSD、EURUSD。', 'List supported symbols, for example XAUUSD, EURUSD.')}><input {...props('ea-pairs')} value={uploadForm.pairs} maxLength={100} onChange={e => update('pairs', e.target.value)} placeholder="XAUUSD, EURUSD" /></Field>
              <Field id="ea-logo" label={t('策略头像 / Logo（可选）', 'Strategy cover / logo (optional)')} hint={t('PNG、JPEG 或 WebP；编辑时可以再次更换。', 'PNG, JPEG or WebP; you can replace it when editing.')}><div className="ea-upload-logo">{uploadForm.currentLogoUrl && <Image src={uploadForm.currentLogoUrl} width={64} height={64} alt={t('当前策略头像', 'Current strategy cover')} />}<input {...props('ea-logo')} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setLogoFile(e.target.files?.[0] || null)} /></div>{logoFile && <p className="ea-upload-filename">{logoFile.name}</p>}</Field></div>
            <fieldset className="ea-upload-types"><legend>{t('策略类型（可多选）', 'Strategy types (multiple choices)')}</legend><div>{eaTypeOptions.map(type => <label key={type}><input type="checkbox" checked={(uploadForm.eaTypes || []).includes(type)} onChange={() => toggleEaType(type)} />{tEaType(type)}</label>)}</div></fieldset>
            <Field id="ea-description" label={t('运行逻辑与风险说明', 'Trading logic & risks')} hint={t('说明入场、出场、仓位管理及可能失效的环境；最多 10,000 字符。', 'Explain entries, exits, sizing, and failure conditions; up to 10,000 characters.')}><textarea {...props('ea-description')} rows={5} maxLength={10000} value={uploadForm.description} onChange={e => update('description', e.target.value)} /></Field>
          </Section>
          <Section number={2} title={titles[1]} hint={t('程序会经过安全检查，版本与买家升级规则单独记录。', 'Programs undergo security checks; version and upgrade rules are recorded separately.')}>
            {editing ? <p className="ea-upload-notice">{t('当前编辑仅修改策略资料。已发布程序不能覆盖；请从个人中心“我发布的策略”提交新版本。', 'This editor updates strategy information. Published programs cannot be overwritten; submit a new version from My Published EAs in your profile.')}</p> : <>
              <Field id="ea-program" label={t('EA 主程序 *', 'EA program *')} hint={t('选择编译后的 .ex4 / .ex5；文件仍需通过安全扫描与服务端验证。', 'Choose a compiled .ex4 / .ex5; security scanning and server validation remain required.')} error={errors['ea-program']}><input {...props('ea-program')} type="file" disabled={isReusingProgram} accept=".ex4,.ex5" onChange={e => { setReuseFileUrl(''); setEx4File(e.target.files?.[0] || null); setErrors(prev => ({ ...prev, 'ea-program': undefined })); }} />{ex4File && <p className="ea-upload-filename">{ex4File.name}</p>}</Field>
              {user.role === 'admin' && <div className="ea-upload-reuse"><div className="ea-upload-reuse-header"><strong>{t('复用已审核程序（仅管理员）', 'Reuse an approved program (admin only)')}</strong><button type="button" disabled={loadingPrograms || isReusingProgram} onClick={async () => { setLoadingPrograms(true); try { await loadReusablePrograms(); } finally { setLoadingPrograms(false); } }}>{loadingPrograms ? t('载入中…', 'Loading…') : t('载入可复用版本', 'Load approved versions')}</button></div><p>{t('为新策略创建独立安全副本，保留来源审计；订单和授权独立管理。', 'Creates an independent, audited copy; orders and licenses remain separate.')}</p><label htmlFor="ea-reuse">{t('选择已审核版本', 'Choose an approved version')}</label><select id="ea-reuse" value="" disabled={isReusingProgram || loadingPrograms} onChange={e => { if (e.target.value) reuseApprovedProgram(Number(e.target.value)); }}><option value="">{t('请选择程序版本', 'Select a program version')}</option>{reusablePrograms.map(program => <option key={program.uploadId} value={program.uploadId}>{program.productTitle} · v{program.version} · {program.originalName}</option>)}</select><p role="status">{isReusingProgram ? t('正在创建安全副本…', 'Creating a secure copy…') : reuseFileUrl ? t(`已复用：${reuseProgramInfo?.originalName || '已审核程序'}。`, `Reused: ${reuseProgramInfo?.originalName || 'approved program'}.`) : t('尚未选择复用文件；也可以直接上传新程序。', 'No reused file selected; you can upload a new program instead.')}</p></div>}
              <div className="ea-upload-grid"><Field id="ea-version" label={t('初始版本号 *', 'Initial version *')} hint={t('例如 1.0.0 或 1.0.0-beta；最多 40 字符。', 'For example 1.0.0 or 1.0.0-beta; up to 40 characters.')} error={errors['ea-version']}><input {...props('ea-version')} value={uploadForm.version} maxLength={40} onChange={e => update('version', e.target.value)} required /></Field><Field id="ea-upgradePolicy" label={t('版本升级授权规则 *', 'Version upgrade policy *')} hint={t('决定此版本向哪些买家提供授权。', 'Determines which buyers receive access to this version.')}><select {...props('ea-upgradePolicy')} value={uploadForm.upgradePolicy} onChange={e => update('upgradePolicy', e.target.value)}><option value="all_existing">{t('所有已有买家继承', 'All existing owners')}</option><option value="new_purchases_only">{t('仅发布后新买家', 'New purchases only')}</option></select></Field></div>
              <Field id="ea-releaseNotes" label={t('初始版本说明 *', 'Initial release notes *')} hint={t('说明功能与适用环境，3–5,000 个字符。', 'Describe features and supported environment, 3–5,000 characters.')} error={errors['ea-releaseNotes']}><textarea {...props('ea-releaseNotes')} rows={3} value={uploadForm.releaseNotes} maxLength={5000} required onChange={e => update('releaseNotes', e.target.value)} /></Field>
            </>}
          </Section>
          <Section number={3} title={titles[2]} hint={t('不上传报告也能提交审核；资料提供情况会向用户披露。', 'You may submit without a report; available verification materials are disclosed to users.')}>
            <Field id="ea-report" label={t('MT5 HTML 原始回测报告（可选）', 'Original MT5 HTML report (optional)')} hint={t('上传 .htm / .html，自动提取指标与曲线。解析成功不代表策略已经通过认证。', 'Upload .htm / .html to extract metrics and curves. Successful parsing does not mean the strategy is certified.')}><input {...props('ea-report')} type="file" accept=".htm,.html,text/html" disabled={isParsingReport} onChange={e => handleReportUpload(e.target.files?.[0])} /></Field>
            <p role="status" className="ea-upload-filename">{isParsingReport ? t('正在解析和验证报告…', 'Parsing and validating report…') : reportInfo ? `${reportInfo.originalName || t('已绑定原始报告', 'Original report attached')} · SHA-256 ${reportInfo.sha256?.slice(0, 16) || '—'} · ${reportInfo.metrics?.totalTrades ?? uploadForm.metrics.totalTrades} ${t('笔交易', 'trades')}` : t('尚未上传报告。', 'No report uploaded.')}</p>
            <div className="ea-upload-grid">{[['settings', t('设置页截图（可选）', 'Settings screenshot (optional)')], ['statistics', t('统计页截图（可选）', 'Statistics screenshot (optional)')], ['chart', t('净值曲线截图（可选）', 'Equity screenshot (optional)')], ['analysis', t('后台分析截图（可选）', 'Analysis screenshot (optional)')]].map(([key, label]) => <Field key={key} id={`ea-evidence-${key}`} label={label} hint="PNG / JPEG / WebP"><input id={`ea-evidence-${key}`} aria-describedby={`ea-evidence-${key}-hint`} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setEvidenceFiles(prev => ({ ...prev, [key]: e.target.files?.[0] || null }))} />{evidenceFiles?.[key] && <p className="ea-upload-filename">{evidenceFiles[key].name}</p>}</Field>)}</div>
            {uploadForm.evidenceIds?.length > 0 && <p>{t(`已保留 ${uploadForm.evidenceIds.length} 份现有证据；新图片会替换相同类型。`, `${uploadForm.evidenceIds.length} existing evidence files retained; new images replace the same type.`)}</p>}
            {uploadForm.reportId ? <div className="ea-upload-results"><h3>{t('报告自动提取结果 · 只读', 'Extracted report metrics · read only')}</h3><p>{t('如结果不正确，请重新导出报告；管理员将在审核时复核。', 'Re-export an incorrect report; an administrator will review the results.')}</p><div className="ea-upload-metrics">{[['initialDeposit', t('初始资金 USD', 'Initial deposit USD')], ['netProfit', t('净利润 USD', 'Net profit USD')], ['profitFactor', 'Profit Factor'], ['sharpeRatio', 'Sharpe Ratio'], ['maxDrawdownPercent', t('最大回撤 %', 'Max drawdown %')], ['recoveryFactor', 'Recovery Factor'], ['winRatePercent', t('胜率 %', 'Win rate %')], ['totalTrades', t('交易次数', 'Total trades')]].map(([key, label]) => <Field key={key} id={`ea-metric-${key}`} label={label}><input id={`ea-metric-${key}`} readOnly value={uploadForm.metrics[key] ?? ''} /></Field>)}</div><p>{t('自动生成：', 'Generated: ')}{parseMetricRows(uploadForm.metrics.equityCurveText, 'value').length} {t('个净值点', 'equity points')} · {parseMetricRows(uploadForm.metrics.drawdownCurveText, 'percent').length} {t('个回撤点', 'drawdown points')} · {parseMetricRows(uploadForm.metrics.monthlyReturnsText, 'percent').length} {t('个月收益', 'monthly returns')}</p></div> : <div className="ea-upload-disclosure"><strong>{hasEvidence ? t('已提供截图，尚未提供原始报告', 'Screenshots provided; no original report') : t('未提供验证资料', 'No verification materials')}</strong><p>{t('仍可提交基础审核。收益、回撤与初始资金将显示为未披露；不会用手工数字替代已验证数据。', 'You can still submit for basic review. Returns, drawdown and initial deposit remain undisclosed; manual figures do not replace verified data.')}</p></div>}
          </Section>
          <Section number={4} title={titles[3]} hint={t('核对价格与试用规则，再将策略提交审核。', 'Check pricing and trial rules before submitting for review.')}>
            <div className="ea-upload-grid"><Field id="ea-price" label={t('发售价格（USD）', 'Price (USD)')} hint={t('留空或填 0 为免费；最多两位小数。', 'Blank or 0 means free; at most two decimal places.')} error={errors['ea-price']}><input {...props('ea-price')} type="number" min="0" max="1000000" step="0.01" value={uploadForm.price} onChange={e => update('price', e.target.value)} placeholder="0.00" /></Field><div className="ea-upload-field"><label className="ea-upload-trial"><input type="checkbox" checked={Boolean(uploadForm.trialEnabled)} onChange={e => update('trialEnabled', e.target.checked)} />{t('开放限时试用', 'Enable timed trial')}</label>{uploadForm.trialEnabled && <Field id="ea-trialDays" label={t('试用天数', 'Trial days')} hint={t('服务器计时，1–30 天。', 'Server-timed, 1–30 days.')} error={errors['ea-trialDays']}><input {...props('ea-trialDays')} type="number" min="1" max="30" step="1" value={uploadForm.trialDays} onChange={e => update('trialDays', e.target.value)} /></Field>}</div></div>
            <p className="ea-upload-notice">{t('提交后进入管理员审核队列。资料完整度与策略认证分别审核，基础审核通过不等于表现已经验证。', 'Submission enters the administrator review queue. Listing approval and performance verification are separate checks.')}</p>
            <div className="ea-upload-submit"><p aria-live="polite">{busy ? t('请等待当前处理完成。', 'Please wait for processing to finish.') : t('报告可选 · 审核后展示', 'Report optional · listing after review')}</p><button type="submit" disabled={busy}><Upload size={18} />{isSubmitting ? t('正在提交…', 'Submitting…') : editing ? t('保存修改并重新审核', 'Save & submit for review') : t('提交审核', 'Submit for review')}</button></div>
          </Section>
        </fieldset>
      </form>
    </>}
  </div>;
}

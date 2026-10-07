'use client';

const reasons={
  legacy_balance_migration:['旧账户余额转入','Previous account balance transferred'],
  verified_recharge:['充值积分到账','Purchased points credited'],
  strategy_purchase:['积分购买 EA 策略','EA strategy purchased with points'],
  strategy_sale:['EA 策略销售分成','EA strategy sale share'],
  withdrawal_hold:['开发者提现申请','Creator withdrawal requested'],
  withdrawal_refund:['提现驳回，积分退回','Withdrawal rejected; points returned'],
  legacy_withdrawal_refund:['旧提现申请退回','Previous withdrawal request refunded'],
  daily_checkin:['每日签到奖励','Daily check-in reward'],
  daily_post:['每日发帖奖励','Daily post reward'],
  daily_comment:['每日回帖奖励','Daily reply reward'],
  daily_rating:['每日策略评分奖励','Daily strategy rating reward'],
  tmgm_deposit:['交易平台任务奖励','Broker registration task reward'],
  follow_x:['关注 X 账号任务奖励','X follow task reward'],
  join_telegram:['加入 Telegram 群组任务奖励','Telegram group task reward'],
};

export default function PointHistory({transactions,tasks,t}){
  const label=reason=>{
    if(reasons[reason])return t(...reasons[reason]);
    if(reason?.startsWith('custom_')||tasks.some(task=>task.code===reason))return t('自定义任务奖励','Custom task reward');
    return t('其他积分变动','Other points activity');
  };
  return <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
    <h2 className="font-bold">{t('积分明细','Points history')}</h2>
    <div className="mt-3 max-h-72 divide-y divide-slate-800 overflow-auto">{transactions.length?transactions.map(item=><div key={item.id} className="flex justify-between gap-3 py-3 text-sm">
      <div><p className="text-slate-200">{label(item.reason)}</p><p className="mt-1 text-xs text-slate-400">{new Intl.DateTimeFormat(t('zh-CN','en-US'),{dateStyle:'medium'}).format(new Date(item.createdAt))} · {t('变动后余额','Balance after')} {item.balanceAfter}</p>
        {['legacy_balance_migration','strategy_purchase','strategy_sale','verified_recharge'].includes(item.reason)&&<p className="mt-1 text-xs text-slate-400">{t('充值来源','Paid origin')} {item.fundedDelta>0?'+':''}{item.fundedDelta??0} · {t('奖励来源','Reward origin')} {item.bonusDelta>0?'+':''}{item.bonusDelta??0}</p>}
      </div><strong className={item.delta>0?'shrink-0 text-emerald-300':'shrink-0 text-amber-300'}>{item.delta>0?'+':''}{item.delta}</strong>
    </div>):<p className="py-4 text-sm text-slate-400">{t('暂无记录','No history yet')}</p>}</div>
  </div>;
}

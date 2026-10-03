import { Badge } from '@/app/components/ui/UiKit';

export default function AdminNavigation({ groups, items, activeTab, onSelect, counts, mobile = false }) {
  return <nav aria-label="后台功能菜单" className="space-y-3">{groups.map(([group, keys]) => <details key={group} open={mobile || keys.includes(activeTab)} className="rounded-lg">
    <summary className="min-h-11 cursor-pointer px-3 py-3 text-xs font-bold tracking-wide text-slate-500">{group}</summary>
    <div className="space-y-1">{items.filter(item => keys.includes(item[0])).map(([value, label, Icon]) => <button key={value} type="button" aria-current={activeTab === value ? 'page' : undefined} onClick={() => onSelect(value)} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition-colors ${activeTab === value ? 'bg-cyan-400/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/20' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'}`}>
      <Icon className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-words">{label}</span>
      {counts[value] > 0 && <Badge variant={value === 'products' ? 'warning' : 'danger'}>{counts[value]}</Badge>}
    </button>)}</div>
  </details>)}</nav>;
}

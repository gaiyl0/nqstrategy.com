"use client";

import { cloneElement, createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, LoaderCircle, X, XCircle } from 'lucide-react';

const join = (...classes) => classes.filter(Boolean).join(' ');

const buttonVariants = {
  primary: 'border-cyan-300/20 bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_10px_30px_rgba(34,211,238,0.12)]',
  secondary: 'border-slate-700/80 bg-slate-800/80 text-slate-100 hover:border-slate-600 hover:bg-slate-700/80',
  ghost: 'border-transparent bg-transparent text-slate-300 hover:bg-slate-800/70 hover:text-white',
  danger: 'border-red-400/20 bg-red-500/12 text-red-300 hover:bg-red-500/20 hover:text-red-200',
};

const buttonSizes = {
  sm: 'min-h-10 px-3 py-1.5 text-xs',
  md: 'min-h-10 px-4 py-2 text-sm',
  lg: 'min-h-12 px-5 py-3 text-sm',
  icon: 'h-11 w-11 p-0',
};

export function Button({ variant = 'secondary', size = 'md', loading = false, icon: Icon, className = '', children, disabled, ...props }) {
  return (
    <button
      data-ui="button" data-variant={variant} data-size={size}
      className={join('inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45', buttonVariants[variant], buttonSizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : Icon ? <Icon aria-hidden="true" className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function Panel({ as: Component = 'section', interactive = false, className = '', children, ...props }) {
  return <Component className={join('rounded-xl border border-slate-700/45 bg-slate-900/55 shadow-[var(--nq-shadow-panel)] backdrop-blur-sm', interactive && 'transition-colors hover:border-slate-600/70 hover:bg-slate-900/75', className)} {...props}>{children}</Component>;
}

const badgeVariants = {
  neutral: 'border-slate-600/50 bg-slate-800/65 text-slate-300',
  primary: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300',
  success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  warning: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  danger: 'border-red-400/25 bg-red-400/10 text-red-300',
  violet: 'border-violet-400/25 bg-violet-400/10 text-violet-300',
};

export function Badge({ variant = 'neutral', className = '', children }) {
  return <span className={join('inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold leading-none', badgeVariants[variant], className)}>{children}</span>;
}

export function Field({ label, hint, error, required = false, className = '', children }) {
  const id = useId();
  const control = children ? cloneElement(children, {
    id: children.props.id || id,
    'aria-invalid': Boolean(error),
    'aria-describedby': hint || error ? `${id}-description` : undefined,
    className: join('w-full rounded-lg border bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50', error ? 'border-red-400/60 focus:border-red-400' : 'border-slate-700/70 focus:border-cyan-400/70', children.props.className),
  }) : null;
  return (
    <div className={join('space-y-2', className)}>
      {label && <label htmlFor={control?.props.id} className="block text-xs font-semibold text-slate-300">{label}{required && <span className="ml-1 text-red-400">*</span>}</label>}
      {control}
      {(error || hint) && <p id={`${id}-description`} className={join('text-xs leading-5', error ? 'text-red-300' : 'text-slate-500')}>{error || hint}</p>}
    </div>
  );
}

export function Tabs({ items, value, onChange, label = 'Sections', className = '' }) {
  return (
    <div role="tablist" aria-label={label} className={join('flex gap-1 overflow-x-auto border-b border-slate-800/80', className)}>
      {items.map(item => <button key={item.value} type="button" role="tab" aria-selected={value === item.value} onClick={() => onChange(item.value)} className={join('relative shrink-0 px-3 py-3 text-sm font-semibold transition-colors', value === item.value ? 'text-cyan-300 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-cyan-400' : 'text-slate-400 hover:text-slate-200')}>{item.label}{item.count !== undefined && <span className="ml-2 rounded-full bg-slate-800 px-1.5 py-0.5 text-xs nq-number">{item.count}</span>}</button>)}
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, description, action }) {
  return <div className="nq-empty-state flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/60 bg-slate-950/25 px-6 py-10 text-center"><div className="mb-4 rounded-xl border border-slate-700/60 bg-slate-900 p-3 text-cyan-300"><Icon className="h-5 w-5" /></div><h3 className="font-semibold text-slate-100">{title}</h3>{description && <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>}{action && <div className="mt-5">{action}</div>}</div>;
}

export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={join('animate-pulse rounded-lg bg-slate-800/70', className)} />;
}

const noticeStyles = {
  success: { Icon: CheckCircle2, className: 'border-emerald-400/25 bg-emerald-400/8 text-emerald-200' },
  warning: { Icon: AlertTriangle, className: 'border-amber-400/25 bg-amber-400/8 text-amber-200' },
  danger: { Icon: XCircle, className: 'border-red-400/25 bg-red-400/8 text-red-200' },
  info: { Icon: Info, className: 'border-cyan-400/25 bg-cyan-400/8 text-cyan-200' },
};

export function Notice({ tone = 'info', title, children, className = '' }) {
  const { Icon, className: toneClass } = noticeStyles[tone];
  return <div role={tone === 'danger' ? 'alert' : 'status'} className={join('flex gap-3 rounded-xl border p-4', toneClass, className)}><Icon className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-semibold">{title}</p>{children && <div className="mt-1 text-xs leading-5 opacity-75">{children}</div>}</div></div>;
}

function Overlay({ open, onClose, labelledBy, children, side = false }) {
  const contentRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKeyDown = event => {
      if (event.key === 'Escape') onClose?.();
      if (event.key !== 'Tab' || !contentRef.current) return;
      const focusable = [...contentRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    window.requestAnimationFrame(() => contentRef.current?.querySelector('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])')?.focus());
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKeyDown); previous?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className={join('fixed inset-0 z-[100] flex bg-black/70 backdrop-blur-sm', side ? 'justify-end' : 'items-center justify-center p-4')} onMouseDown={event => { if (event.target === event.currentTarget) { event.preventDefault(); onClose?.(); } }}><div ref={contentRef} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={join('border border-slate-700/70 bg-[#0b1119] shadow-[var(--nq-shadow-dialog)]', side ? 'h-full w-full max-w-lg overflow-y-auto' : 'max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl')}>{children}</div></div>;
}

function OverlayHeader({ id, title, description, onClose }) {
  return <div className="flex items-start justify-between gap-6 border-b border-slate-800 px-6 py-5"><div><h2 id={id} className="text-lg font-bold text-white">{title}</h2>{description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}</div><Button aria-label="Close" variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button></div>;
}

export function Dialog({ open, onClose, title, description, children, footer }) {
  const titleId = useId();
  return <Overlay open={open} onClose={onClose} labelledBy={titleId}><OverlayHeader id={titleId} title={title} description={description} onClose={onClose} /><div className="px-6 py-5">{children}</div>{footer && <div className="flex flex-wrap justify-end gap-3 border-t border-slate-800 px-6 py-4">{footer}</div>}</Overlay>;
}

export function Drawer({ open, onClose, title, description, children, footer }) {
  const titleId = useId();
  return <Overlay open={open} onClose={onClose} labelledBy={titleId} side><div className="flex min-h-full flex-col"><OverlayHeader id={titleId} title={title} description={description} onClose={onClose} /><div className="flex-1 px-6 py-5">{children}</div>{footer && <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-slate-800 bg-[#0b1119]/95 px-6 py-4 backdrop-blur">{footer}</div>}</div></Overlay>;
}

const InteractionContext = createContext(null);

export function InteractionProvider({ children }) {
  const [request, setRequest] = useState(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const resolver = useRef(null);

  const close = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setRequest(null);
    setValue('');
    setError('');
  }, []);

  const openRequest = useCallback((configuration) => new Promise(resolve => {
    resolver.current?.(null);
    resolver.current = resolve;
    setValue(String(configuration.initialValue ?? ''));
    setError('');
    setRequest(configuration);
  }), []);

  const confirmAction = useCallback(configuration => openRequest({ type: 'confirm', tone: 'danger', confirmLabel: '确认', ...configuration }), [openRequest]);
  const requestInput = useCallback(configuration => openRequest({ type: 'input', confirmLabel: '继续', ...configuration }), [openRequest]);
  const showValue = useCallback(configuration => openRequest({ type: 'value', confirmLabel: '关闭', ...configuration }), [openRequest]);

  const submit = () => {
    if (request.type === 'confirm') return close(true);
    if (request.type === 'value') return close(true);
    const normalized = request.trim === false ? value : value.trim();
    if (request.required && !normalized) return setError(request.requiredMessage || '请填写此字段');
    if (request.minLength && normalized.length < request.minLength) return setError(request.minLengthMessage || `至少输入 ${request.minLength} 个字符`);
    if (request.maxLength && normalized.length > request.maxLength) return setError(request.maxLengthMessage || `最多输入 ${request.maxLength} 个字符`);
    const validationError = request.validate?.(normalized);
    if (validationError) return setError(validationError);
    close(normalized);
  };

  const requestType = request?.type;
  const cancel = useCallback(() => close(requestType === 'confirm' ? false : null), [close, requestType]);
  const footer = request ? <><Button variant="secondary" onClick={cancel}>{request.cancelLabel || (request.type === 'value' ? '关闭' : '取消')}</Button>{request.type !== 'value' && <Button variant={request.tone === 'danger' ? 'danger' : 'primary'} onClick={submit}>{request.confirmLabel}</Button>}</> : null;

  return (
    <InteractionContext.Provider value={{ confirmAction, requestInput, showValue }}>
      {children}
      <Dialog open={Boolean(request)} onClose={cancel} title={request?.title || '请确认'} description={request?.description} footer={footer}>
        {request?.type === 'confirm' && <Notice tone={request.tone === 'danger' ? 'danger' : request.tone || 'warning'} title={request.noticeTitle || '请检查操作影响'}>{request.notice}</Notice>}
        {request?.type === 'input' && <Field label={request.label} hint={request.hint} error={error} required={request.required}>{request.options ? <select value={value} onChange={event => { setValue(event.target.value); setError(''); }}>{request.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : request.multiline ? <textarea rows={request.rows || 5} value={value} maxLength={request.maxLength} placeholder={request.placeholder} onChange={event => { setValue(event.target.value); setError(''); }} /> : <input type={request.inputType || 'text'} value={value} maxLength={request.maxLength} placeholder={request.placeholder} onChange={event => { setValue(event.target.value); setError(''); }} />}</Field>}
        {request?.type === 'value' && <Field label={request.label} hint={request.hint}><textarea readOnly rows={request.rows || 6} value={request.value || ''} onFocus={event => event.currentTarget.select()} /></Field>}
      </Dialog>
    </InteractionContext.Provider>
  );
}

export function useInteraction() {
  const value = useContext(InteractionContext);
  if (!value) throw new Error('useInteraction must be used inside InteractionProvider');
  return value;
}

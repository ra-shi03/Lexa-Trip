import { useId, useState } from 'react';
import { X, Minus, Plus, Eye, EyeOff } from 'lucide-react';
import { cx } from '../../lib/format';

/** Label + control + hint/error wrapper */
export function Field({ label, hint, error, required, children, className, htmlFor }) {
  return (
    <div className={className}>
      {label && <label className="field-label" htmlFor={htmlFor}>{label}{required && <span className="text-danger"> *</span>}</label>}
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function Input({ label, hint, error, required, className, inputClassName, size, ...props }) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPw = props.type === 'password';
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className} htmlFor={id}>
      <div className={isPw ? 'relative' : undefined}>
        <input id={id} className={cx('input', size === 'sm' && 'input-sm', isPw && '!pr-12', inputClassName)} aria-invalid={Boolean(error)} required={required} {...props} type={isPw && reveal ? 'text' : props.type} />
        {isPw && (
          <button type="button" onClick={() => setReveal((v) => !v)} aria-label={reveal ? 'Hide password' : 'Show password'} aria-pressed={reveal} className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink">
            {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </Field>
  );
}

export function Textarea({ label, hint, error, required, className, rows = 4, ...props }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className} htmlFor={id}>
      <textarea id={id} rows={rows} className="input" aria-invalid={Boolean(error)} {...props} />
    </Field>
  );
}

/** options: [{ value, label }] or ['a','b'] */
export function Select({ label, hint, error, required, className, options = [], placeholder, size, ...props }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className} htmlFor={id}>
      <select id={id} className={cx('input', size === 'sm' && 'input-sm')} aria-invalid={Boolean(error)} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const opt = typeof o === 'object' ? o : { value: o, label: o };
          return <option key={opt.value} value={opt.value}>{opt.label}</option>;
        })}
      </select>
    </Field>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className={cx('flex items-start justify-between gap-4', disabled && 'opacity-60')}>
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-semibold text-ink">{label}</span>}
          {description && <span className="block text-xs text-muted">{description}</span>}
        </span>
      )}
      <button type="button" role="switch" aria-checked={Boolean(checked)} className="toggle" disabled={disabled} onClick={() => onChange(!checked)} />
    </label>
  );
}

export function Checkbox({ checked, onChange, label, className }) {
  return (
    <label className={cx('flex cursor-pointer items-center gap-2.5 text-sm', className)}>
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--lt-primary)]" />
      <span>{label}</span>
    </label>
  );
}

/** Chip-style multi-value input (keywords, amenities, tags). Enter or comma adds. */
export function TagInput({ label, hint, value = [], onChange, placeholder = 'Type and press Enter', className, max, suggestions = [] }) {
  const [draft, setDraft] = useState('');
  const add = (raw) => {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean).filter((s) => !value.includes(s));
    if (parts.length) onChange([...value, ...parts].slice(0, max || 999));
    setDraft('');
  };
  return (
    <Field label={label} hint={hint} className={className}>
      <div className="input flex h-auto min-h-[44px] flex-wrap items-center gap-1.5 py-1.5">
        {value.map((t) => (
          <span key={t} className="badge badge-primary h-7 text-[13px]">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X size={12} /></button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
            if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? '' : placeholder}
          className="min-w-[120px] flex-1 border-0 bg-transparent text-sm outline-none"
        />
        {draft.trim() && <button type="button" onClick={() => add(draft)} className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">Add</button>}
      </div>
      {suggestions.filter((x) => !value.includes(x)).length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted">Quick add:</span>
          {suggestions.filter((x) => !value.includes(x)).map((x) => <button key={x} type="button" onClick={() => add(x)} className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line px-2.5 text-[13px] font-medium text-muted transition hover:border-primary hover:text-primary"><Plus size={12} />{x}</button>)}
        </div>
      )}
    </Field>
  );
}

export function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} className="h-11 w-12 cursor-pointer rounded-brand border border-line bg-card p-1" />
        <input className="input font-mono text-sm uppercase" value={value || ''} onChange={(e) => onChange(e.target.value)} maxLength={7} />
      </div>
    </Field>
  );
}

/** − n + stepper (guests, rooms, passengers) */
export function Counter({ value, onChange, min = 0, max = 20, label, sub }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label}`}><Minus size={14} /></button>
        <span className="w-5 text-center font-bold tabular-nums">{value}</span>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`More ${label}`}><Plus size={14} /></button>
      </div>
    </div>
  );
}

/** Controlled form-state helper: const f = useForm(initial); f.bind('name') */
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));
  const bind = (k) => ({ value: values[k] ?? '', onChange: (e) => set(k, e?.target ? (e.target.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value) : e), error: errors[k] });
  return { values, setValues, set, bind, errors, setErrors };
}

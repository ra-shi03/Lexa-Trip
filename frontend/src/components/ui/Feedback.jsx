import { Loader2, AlertTriangle, Inbox } from 'lucide-react';
import { STATUS_TONE, titleCase, cx } from '../../lib/format';
import { Button } from './Button';

export const Spinner = ({ size = 22, className }) => <Loader2 size={size} className={cx('spin text-primary', className)} />;

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted"><Spinner size={28} /><span className="text-sm">{label}</span></div>
    </div>
  );
}

export const Skeleton = ({ className }) => <div className={cx('skeleton', className)} />;

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary"><Icon size={26} /></div>
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-danger/10 text-danger"><AlertTriangle size={26} /></div>
      <h3 className="text-lg font-bold">Something went wrong</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{error?.message || 'Please try again.'}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Badge({ tone = 'neutral', children, className }) {
  return <span className={cx('badge', `badge-${tone}`, className)}>{children}</span>;
}

export const StatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status] || 'neutral'}>{titleCase(status || '—')}</Badge>;

export function Alert({ tone = 'info', title, children, className }) {
  const tones = { info: 'border-primary/30 bg-primary-soft', warning: 'border-warning/30 bg-warning/10', danger: 'border-danger/30 bg-danger/10', success: 'border-success/30 bg-success/10' };
  return (
    <div className={cx('rounded-brand border px-4 py-3 text-sm', tones[tone], className)}>
      {title && <p className="font-bold text-ink">{title}</p>}
      <div className="text-ink/80">{children}</div>
    </div>
  );
}

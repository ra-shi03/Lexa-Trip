import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '../../lib/format';
import { Button } from './Button';

function useLockScroll(open) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && document.dispatchEvent(new CustomEvent('lt-escape'));
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);
}

/** Centered dialog on desktop, bottom sheet on mobile (app-like). */
export function Modal({ open, onClose, title, children, footer, size = 'md', className }) {
  useLockScroll(open);
  useEffect(() => {
    const h = () => onClose?.();
    document.addEventListener('lt-escape', h);
    return () => document.removeEventListener('lt-escape', h);
  }, [onClose]);
  if (!open) return null;
  const widths = { sm: 'md:max-w-md', md: 'md:max-w-xl', lg: 'md:max-w-3xl', xl: 'md:max-w-5xl' };
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-secondary/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('animate-fade-up relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-card shadow-pop md:rounded-3xl', widths[size], className)}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="safe-bottom flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Side panel (filters on mobile, admin quick-edit) */
export function Drawer({ open, onClose, title, children, footer, side = 'right', width = 'max-w-md' }) {
  useLockScroll(open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-secondary/50" onClick={onClose} />
      <aside className={cx('animate-fade-up relative flex h-full w-full flex-col bg-card shadow-pop', width, side === 'right' ? 'ml-auto' : 'mr-auto')}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="safe-bottom border-t border-line p-4">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

/** Promise-free confirm dialog with optional reason input */
export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmLabel = 'Confirm', tone = 'danger', withReason, reasonLabel = 'Reason', loading }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} disabled={withReason && reason.trim().length < 3} onClick={() => onConfirm(reason)}>{confirmLabel}</Button>
        </>
      }
    >
      {message && <p className="text-sm text-muted">{message}</p>}
      {withReason && (
        <div className="mt-4">
          <label className="field-label">{reasonLabel}</label>
          <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}
    </Modal>
  );
}

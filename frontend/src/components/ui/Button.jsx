import { Link } from 'react-router';
import { Loader2 } from 'lucide-react';
import { cx } from '../../lib/format';

/**
 * <Button variant="primary|secondary|outline|ghost|soft|danger" size="xs|sm|md|lg" loading icon={Icon} to="/path" block />
 */
export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, iconRight: IconRight, to, href, block, className, children, disabled, ...rest }) {
  const cls = cx('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', !children && 'btn-icon', className);
  const iconSize = size === 'xs' ? 14 : size === 'sm' ? 16 : 18;
  const content = (
    <>
      {loading ? <Loader2 size={iconSize} className="spin" /> : Icon ? <Icon size={iconSize} /> : null}
      {children}
      {IconRight && !loading ? <IconRight size={iconSize} /> : null}
    </>
  );
  if (to) return <Link to={to} className={cls} {...rest}>{content}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{content}</a>;
  return <button type="button" className={cls} disabled={disabled || loading} {...rest}>{content}</button>;
}

export function IconButton({ icon: Icon, label, className, size = 18, ...rest }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx('inline-grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink', className)} {...rest}>
      <Icon size={size} />
    </button>
  );
}

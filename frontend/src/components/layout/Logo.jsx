import { Link } from 'react-router';
import { useSettings } from '../../context/SettingsContext';
import { cx } from '../../lib/format';

/**
 * Brand lock-up: circular orange mark + "LEXA TRIP" word-mark (navy + orange),
 * matching the client logo. Mark image and app name come from Admin → Appearance.
 */
export function Logo({ to = '/', compact, light, className, suffix }) {
  const { brand } = useSettings();
  const name = (brand.appName || 'LexaTrip').replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase().split(' ');
  return (
    <Link to={to} className={cx('inline-flex items-center gap-2.5', className)} aria-label={`${brand.appName} home`}>
      <img src={brand.markUrl || '/lexatrip-mark.jpg'} alt="" onError={(e) => { if (!e.currentTarget.src.endsWith('/lexatrip-mark.jpg')) e.currentTarget.src = '/lexatrip-mark.jpg'; }} className="h-9 w-9 rounded-full object-cover" width="36" height="36" />
      {!compact && (
        <span className="flex items-baseline gap-1 font-display text-[19px] font-extrabold leading-none tracking-wide">
          <span className={light ? 'text-white' : 'text-secondary'}>{name[0]}</span>
          {name[1] && <span className="font-bold text-primary">{name.slice(1).join(' ')}</span>}
          {suffix && <span className={cx('ml-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-normal',light ? 'bg-white/15 text-white' : 'bg-surface text-muted')}>{suffix}</span>}
        </span>
      )}
    </Link>
  );
}

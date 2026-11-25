import { useEffect, useRef } from 'react';
import { cx } from '../../lib/format';

/**
 * 6-box one-time-password input: auto-advance, backspace navigation, paste a full code,
 * SMS autofill (autocomplete=one-time-code) and onComplete when the last digit is entered.
 */
export function OtpInput({ value, onChange, onComplete, length = 6, error, disabled }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');
  useEffect(() => { refs.current[Math.min(value.length, length - 1)]?.focus(); /* focus first empty box */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (next) => {
    const v = next.replace(/\D/g, '').slice(0, length);
    onChange(v);
    if (v.length === length) onComplete?.(v);
  };
  const setAt = (i, ch) => {
    const arr = digits.slice();
    arr[i] = ch;
    commit(arr.join(''));
    if (ch && i < length - 1) refs.current[i + 1]?.focus();
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="One-time password">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length} // allows pasting/auto-fill into any box
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (v.length > 1) return commit(v); // pasted or autofilled whole code
            setAt(i, v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) { e.preventDefault(); setAt(i - 1, ''); refs.current[i - 1]?.focus(); }
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onFocus={(e) => e.target.select()}
          className={cx(
            'h-14 w-full min-w-0 rounded-brand border-2 bg-card text-center text-2xl font-extrabold text-ink outline-none transition',
            'focus:border-primary focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--lt-primary)_16%,transparent)]',
            d ? 'border-secondary' : 'border-line',
            error && 'animate-shake border-danger',
          )}
        />
      ))}
    </div>
  );
}

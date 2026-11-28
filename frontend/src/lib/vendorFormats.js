/**
 * Input masks + checks for Indian business and bank identifiers (the server checks the same patterns).
 * `clean` shapes what is typed; `pattern` decides whether it is complete and valid.
 */
const upper = (max) => (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, max);
const digits = (max) => (v) => v.replace(/\D/g, '').slice(0, max);

export const FORMATS = {
  phone: { clean: digits(10), pattern: /^[6-9]\d{9}$/, placeholder: '9876543210', hint: '10-digit mobile number', inputMode: 'numeric' },
  gstin: { clean: upper(15), pattern: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, placeholder: '08ABCDE1234F1Z5', hint: '15 characters: state code, PAN, then 3 more' },
  pan: { clean: upper(10), pattern: /^[A-Z]{5}\d{4}[A-Z]$/, placeholder: 'ABCDE1234F', hint: '5 letters, 4 digits, 1 letter' },
  pincode: { clean: digits(6), pattern: /^[1-9]\d{5}$/, placeholder: '302001', hint: '6-digit pincode', inputMode: 'numeric' },
  accountNumber: { clean: digits(18), pattern: /^\d{9,18}$/, placeholder: '123456789012', hint: '9 to 18 digits', inputMode: 'numeric' },
  ifsc: { clean: upper(11), pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/, placeholder: 'HDFC0001234', hint: '4 letters, then 0, then 6 characters' },
  upiId: { clean: (v) => v.toLowerCase().replace(/[^a-z0-9.@_-]/g, '').slice(0, 100), pattern: /^[\w.-]{2,256}@[a-z][a-z0-9.-]{1,64}$/i, placeholder: 'name@okhdfcbank', hint: 'name@bank' },
};

/** Empty is fine here — what is required is decided by the onboarding checklist */
export const isValid = (type, value) => !value || FORMATS[type].pattern.test(value);

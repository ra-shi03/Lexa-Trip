import { useEffect, useState } from 'react';
import { ArrowRight, CircleCheck, Circle, Clock, FileWarning, ShieldAlert, Send } from 'lucide-react';
import { Button, Alert } from '../ui';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { cx } from '../../lib/format';

/**
 * Vendor onboarding: complete profile → submit → admin review → approved.
 * `vendor.onboarding` ({ stage, missing }) comes from the server, which enforces the same gate on every route.
 */
const SECTIONS = [
  ['business', 'Business details'],
  ['bank', 'Bank & payouts'],
  ['docs', 'Documents'],
];

export const STAGE_LABEL = { incomplete: 'Profile incomplete', review: 'Under review', approved: 'Approved', rejected: 'Changes needed', suspended: 'Suspended' };

/** Picks up the admin's decision without a manual reload: every 20 s and whenever the tab is focused */
export function useApprovalWatch() {
  const { vendor, update } = useAuth();
  const waiting = Boolean(vendor) && vendor.status !== 'approved';
  useEffect(() => {
    if (!waiting) return undefined;
    const check = () => { if (!document.hidden) api.get('/auth/vendor/me').then(({ data }) => update('vendor', data)).catch(() => {}); };
    const timer = setInterval(check, 20000);
    window.addEventListener('focus', check);
    return () => { clearInterval(timer); window.removeEventListener('focus', check); };
  }, [waiting, update]);
}

function useSubmitProfile() {
  const { update } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/vendor/profile/submit');
      update('vendor', data);
      toast.success('Sent to the admin for approval');
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  return { submit, busy };
}

/** What is done and what is left, plus the next action. `onSection` switches profile tabs; without it the rows link to the profile. */
export function OnboardingCard({ onSection }) {
  const { vendor } = useAuth();
  const { submit, busy } = useSubmitProfile();
  const { stage, missing } = vendor.onboarding;
  if (stage === 'approved') return null;

  if (stage === 'suspended') {
    return <Alert tone="danger" title="Your account is suspended">{vendor.statusNote || 'Contact support to know more.'}</Alert>;
  }
  if (stage === 'review') {
    return (
      <div className="card card-pad flex items-start gap-4">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-warning/10 text-warning"><Clock size={22} /></span>
        <div>
          <h2 className="font-extrabold">Your profile is under review</h2>
          <p className="mt-1 text-sm text-muted">The LexaTrip team is checking your details and documents. Adding properties, inventory, deals and bookings opens as soon as you are approved — this page updates by itself.</p>
        </div>
      </div>
    );
  }

  const done = SECTIONS.filter(([key]) => !missing.some((m) => m.section === key)).length;
  const rejected = stage === 'rejected';
  const Icon = rejected ? FileWarning : ShieldAlert;
  return (
    <div className="card card-pad">
      <div className="flex items-start gap-4">
        <span className={cx('grid h-11 w-11 flex-none place-items-center rounded-xl', rejected ? 'bg-danger/10 text-danger' : 'bg-primary-soft text-primary')}><Icon size={22} /></span>
        <div className="min-w-0">
          <h2 className="font-extrabold">{rejected ? 'Your profile needs changes' : 'Complete your business profile first'}</h2>
          <p className="mt-1 text-sm text-muted">{rejected ? 'Fix the points below and submit again.' : 'Fill in all three sections and submit them for approval. You can add properties only after the admin approves your account.'}</p>
          {rejected && vendor.statusNote && <p className="mt-2 text-sm font-semibold text-danger">Reason: {vendor.statusNote}</p>}
        </div>
      </div>

      <ul className="mt-4 divide-y divide-line border-y border-line">
        {SECTIONS.map(([key, label]) => {
          const left = missing.filter((m) => m.section === key);
          const Row = onSection ? 'button' : 'div';
          return (
            <li key={key}>
              <Row {...(onSection && { type: 'button', onClick: () => onSection(key) })} className={cx('flex w-full items-start gap-3 py-3 text-left', onSection && 'hover:text-primary')}>
                {left.length ? <Circle size={19} className="mt-0.5 flex-none text-muted" /> : <CircleCheck size={19} className="mt-0.5 flex-none text-success" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="block text-xs text-muted">{left.length ? `Missing: ${left.map((m) => m.label).join(', ')}` : 'Completed'}</span>
                </span>
              </Row>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted">{done} of {SECTIONS.length} sections completed</p>
        <div className="flex flex-wrap gap-2">
          {!onSection && Boolean(missing.length) && <Button to="/vendor/profile" iconRight={ArrowRight}>Complete profile</Button>}
          {!onSection && !missing.length && <Button variant="outline" to="/vendor/profile">Check details</Button>}
          {(onSection || !missing.length) && <Button icon={Send} loading={busy} disabled={Boolean(missing.length)} onClick={submit}>Submit for approval</Button>}
        </div>
      </div>
    </div>
  );
}

/** Wraps every vendor screen that needs an approved account */
export function ApprovedOnly({ children }) {
  const { vendor } = useAuth();
  if (vendor.status === 'approved') return children;
  return <div className="mx-auto max-w-2xl"><OnboardingCard /></div>;
}

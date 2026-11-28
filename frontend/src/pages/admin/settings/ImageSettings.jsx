import { useEffect, useState } from 'react';
import { Save, HardDrive, Cloud, CloudUpload, CheckCircle2, Info, ArrowRight } from 'lucide-react';
import { PageHeader, Button, PageLoader, Alert, Badge } from '../../../components/ui';
import { api } from '../../../lib/api';
import { cx } from '../../../lib/format';
import { useToast } from '../../../context/ToastContext';

const OPTIONS = [
  { key: 'local', icon: HardDrive, title: 'Local storage', text: 'Saved on this server’s disk' },
  { key: 'cloudinary', icon: Cloud, title: 'Cloudinary', text: 'Saved on Cloudinary (CDN-hosted)' },
];
const FOLDERS = [['development', 'Development', 'backend/uploads'], ['production', 'Production', '/var/www/uploads']];

const Code = ({ children }) => <code className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-xs text-ink">{children}</code>;

/** Admin → Developer → Image setting (master admin only). Where new uploads are stored on this server. */
export function ImageSettings() {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [choice, setChoice] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get('/admin/settings').then(({ data }) => { setStatus(data.storageStatus); setChoice(data.storageStatus.selected); }).catch((e) => toast.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!status) return <PageLoader />;

  const dirty = choice !== status.selected;
  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put('/admin/settings/storage', { provider: choice });
      setStatus(data.storageStatus);
      toast.success(`New uploads now go to ${data.storageStatus.active === 'cloudinary' ? 'Cloudinary' : data.storageStatus.folder}`);
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader
        title="Image setting"
        subtitle="Control where uploaded images and PDFs are stored."
        actions={(
          <div className="flex items-center gap-2 whitespace-nowrap">
            {dirty && <Badge tone="warning">Unsaved</Badge>}
            {dirty && <Button variant="ghost" onClick={() => setChoice(status.selected)}>Discard</Button>}
            <Button icon={Save} loading={busy} disabled={!dirty} onClick={save}>Save changes</Button>
          </div>
        )}
      />

      <section className="card card-pad space-y-4">
        <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-secondary text-white"><CloudUpload size={20} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold">Image upload storage</h2>
            <p className="text-sm text-muted">Choose where newly uploaded images and PDFs are stored.</p>
          </div>
          <Badge tone={status.mode === 'production' ? 'success' : 'warning'}>Server mode: {status.mode}</Badge>
        </div>

        <div role="radiogroup" aria-label="Storage" className="grid gap-3 md:grid-cols-2">
          {OPTIONS.map(({ key, icon: I, title, text }) => {
            const on = choice === key;
            return (
              <button key={key} type="button" role="radio" aria-checked={on} onClick={() => setChoice(key)}
                className={cx('flex items-center gap-3 rounded-brand-lg border-2 p-4 text-left transition', on ? 'border-primary bg-primary-soft' : 'border-line hover:border-primary/50')}>
                <span className={cx('grid h-12 w-12 flex-none place-items-center rounded-xl', on ? 'bg-primary text-white' : 'bg-surface text-muted')}><I size={22} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-bold">{title}{key === 'cloudinary' && !status.cloudinaryReady && <Badge tone="warning">Keys missing</Badge>}</span>
                  <span className="block text-sm text-muted">{text}</span>
                </span>
                {on && <CheckCircle2 size={22} className="flex-none text-primary" />}
              </button>
            );
          })}
        </div>

        {choice === 'cloudinary' && !status.cloudinaryReady && (
          <Alert tone="warning" title="Cloudinary is not connected yet">
            Add <Code>CLOUDINARY_CLOUD_NAME</Code> <Code>CLOUDINARY_API_KEY</Code> <Code>CLOUDINARY_API_SECRET</Code> to the server’s <Code>.env</Code> and restart it. Until then uploads are saved to <Code>{status.folder}</Code>.
          </Alert>
        )}
        {status.active === 'local' && !status.folderWritable && (
          <Alert tone="danger" title="Uploads will fail">The server can’t write to <Code>{status.folder}</Code>. Create the folder and give the app’s user write access.</Alert>
        )}

        <div className="rounded-brand-lg border border-warning/30 bg-warning/10 p-4">
          <p className="flex items-center gap-2 font-extrabold"><Info size={17} className="text-warning" />How uploads are stored</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-brand border border-line bg-card p-4 text-sm">
              <p className="font-bold">If Cloudinary is selected</p>
              <p className="mt-1 text-muted">Files go to Cloudinary, whatever the server mode is. The server needs the <Code>CLOUDINARY_*</Code> keys.</p>
            </div>
            <div className="rounded-brand border border-line bg-card p-4 text-sm">
              <p className="font-bold">If Local storage is selected</p>
              <p className="mt-1 text-muted">Files are saved on the server’s disk. The folder depends on the server mode (<Code>NODE_ENV</Code>):</p>
              <ul className="mt-2 space-y-1.5">
                {FOLDERS.map(([mode, label, folder]) => (
                  <li key={mode} className="flex flex-wrap items-center gap-2">
                    <Badge tone={mode === 'production' ? 'success' : 'warning'}>{label}</Badge><ArrowRight size={14} className="text-muted" /><Code>{folder}</Code>
                    {status.mode === mode && <span className="text-xs text-muted">this server</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>The choice is saved separately for development and production.</li>
            <li>Switching only affects new uploads; existing files stay where they are.</li>
            <li>New uploads right now go to: <Code>{status.active === 'cloudinary' ? 'Cloudinary' : status.folder}</Code></li>
          </ul>
        </div>
      </section>
    </div>
  );
}

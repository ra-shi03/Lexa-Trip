import { useRef, useState } from 'react';
import { Upload, X, Link2, GripVertical } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Img, Button } from '../ui';
import { compressForUpload } from '../../lib/compressImage';

/**
 * Multi-image manager with alt text (SEO) — upload files or paste URLs, reorder, remove.
 * value: [{ url, alt }]; uploadUrl: endpoint accepting multipart "images"
 */
export function ImageUploader({ value = [], onChange, uploadUrl, max = 30, field = 'images' }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(null);
  const toast = useToast();

  const upload = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const fd = new FormData();
      (await compressForUpload([...files].slice(0, max - value.length))).forEach((f) => fd.append(field, f));
      const { data } = await api.upload(uploadUrl, fd);
      onChange([...value, ...data.map((d) => ({ url: d.url, alt: d.alt || '' }))]);
    } catch (e) { toast.error(e); } finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  };
  const addUrl = () => {
    const url = window.prompt('Paste image URL');
    if (url) onChange([...value, { url, alt: '' }]);
  };
  const move = (from, to) => {
    const next = [...value];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {value.map((im, i) => (
          <div key={`${im.url}-${i}`} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); }} className="group overflow-hidden rounded-brand border border-line bg-card">
            <div className="relative">
              <Img src={im.url} alt={im.alt} className="aspect-[4/3] w-full" />
              {i === 0 && <span className="badge badge-navy absolute left-2 top-2">Cover</span>}
              <span className="absolute left-2 bottom-2 hidden cursor-grab rounded bg-white/90 p-1 text-ink group-hover:block"><GripVertical size={14} /></span>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-danger shadow" aria-label="Remove image"><X size={14} /></button>
            </div>
            <input className="w-full border-t border-line bg-transparent px-2.5 py-2 text-xs outline-none placeholder:text-muted" placeholder="Alt text (describe the photo)" value={im.alt || ''} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
          </div>
        ))}
        {value.length < max && (
          <button type="button" onClick={() => ref.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }} className="grid aspect-[4/3] place-items-center rounded-brand border-2 border-dashed border-line text-muted transition hover:border-primary hover:text-primary">
            <span className="flex flex-col items-center gap-1.5 text-xs font-semibold"><Upload size={20} />{busy ? 'Uploading…' : 'Upload or drop'}</span>
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      <Button variant="ghost" size="xs" icon={Link2} className="mt-2" onClick={addUrl}>Add by URL</Button>
    </div>
  );
}

/** Single image (hero/cover) with alt */
export function SingleImage({ value, onChange, uploadUrl, label = 'Image', field = 'images' }) {
  return (
    <div>
      <p className="field-label">{label}</p>
      <ImageUploader value={value?.url ? [value] : []} onChange={(arr) => onChange(arr[arr.length - 1] || null)} uploadUrl={uploadUrl} max={1} field={field} />
    </div>
  );
}
